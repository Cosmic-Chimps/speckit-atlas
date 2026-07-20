import cytoscape from "cytoscape";
import type { Core, EdgeSingular, NodeSingular } from "cytoscape";
import type { EdgeTier } from "../../core/index.js";
import type { HostToPanel, NodePosition, PanelToHost, Viewport } from "../protocol.js";
import { toCytoscapeElements, type CyEdgeData, type CyNodeData } from "./elements.js";
import { centroidFor, classifySeed } from "./layout.js";
import { buildAdjacency, computeFocusVisible } from "./focus.js";

/** Bucket used when the map shows all projects (must match layoutModel.ALL_PROJECTS_BUCKET). */
const ALL_PROJECTS = "__all__";

/** Host bridge injected by VS Code. */
interface VsCodeApi {
  postMessage(message: PanelToHost): void;
}
declare function acquireVsCodeApi(): VsCodeApi;
const vscode = acquireVsCodeApi();
function post(message: PanelToHost): void {
  vscode.postMessage(message);
}

/** Which bucket the current render belongs to (feature 006 — tags persistLayout reports). */
let currentProjectId: string = ALL_PROJECTS;

/** Coalesce rapid drag/zoom/layout events into one persistLayout report. */
function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number): (...args: A) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: A) => {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => fn(...args), ms);
  };
}

// Theme-aware colors resolved from CSS variables on the document.
function cssVar(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}
function statusColor(statusClass: string): string {
  switch (statusClass) {
    case "status-implemented":
    case "status-complete":
      return cssVar("--vscode-charts-green", "#4caf50");
    case "status-draft":
      return cssVar("--vscode-charts-yellow", "#c9a227");
    case "status-other":
      return cssVar("--vscode-charts-blue", "#3794ff");
    default:
      return cssVar("--vscode-descriptionForeground", "#888");
  }
}
function tierColor(tier: EdgeTier): string {
  switch (tier) {
    case "definitive":
      return cssVar("--vscode-charts-blue", "#3794ff");
    case "strong":
      return cssVar("--vscode-charts-purple", "#b180d7");
    case "medium":
      return cssVar("--vscode-charts-orange", "#d18616");
    default:
      return cssVar("--vscode-descriptionForeground", "#888");
  }
}

function stylesheet(): cytoscape.StylesheetStyle[] {
  const fg = cssVar("--vscode-foreground", "#ccc");
  return [
    {
      selector: "node",
      style: {
        label: "data(label)",
        color: fg,
        "font-size": 9,
        "text-wrap": "wrap",
        "text-max-width": "120px",
        "text-valign": "bottom",
        "text-margin-y": 4,
        width: 26,
        height: 26,
        "background-color": (n: NodeSingular) => statusColor(n.data("statusClass")),
        // task-completion as a pie fill
        "pie-size": "100%",
        "pie-1-background-color": cssVar("--vscode-charts-green", "#4caf50"),
        "pie-1-background-size": (n: NodeSingular) =>
          Math.round((n.data("completion") as number) * 100),
        "border-width": (n: NodeSingular) => (n.data("hasWarnings") ? 3 : 0),
        "border-color": cssVar("--vscode-editorWarning-foreground", "#b89500"),
      } as cytoscape.Css.Node,
    },
    {
      selector: "node:selected",
      style: { "border-width": 3, "border-color": cssVar("--vscode-focusBorder", "#007fd4") },
    },
    {
      selector: "edge",
      style: {
        width: (e: EdgeSingular) => e.data("widthPx") as number,
        "line-color": (e: EdgeSingular) => tierColor(e.data("tier")),
        "line-style": (e: EdgeSingular) => e.data("lineStyle"),
        "target-arrow-shape": (e: EdgeSingular) => e.data("arrow"),
        "target-arrow-color": (e: EdgeSingular) => tierColor(e.data("tier")),
        "curve-style": "bezier",
        opacity: 0.8,
      } as cytoscape.Css.Edge,
    },
    { selector: ".dimmed", style: { opacity: 0.12 } },
  ];
}

let cy: Core | undefined;

/** Feature 010 — the single currently-selected spec id (at most one); null when cleared. */
let selectedNodeId: string | null = null;
/** Feature 010 — whether focus-on-selection is enabled. Transient (not persisted). */
let focusModeOn = false;

function fullRelayout(): void {
  cy?.layout({ name: "cose", animate: false, padding: 30 }).run();
}

/**
 * Feature 006 — report the settled/dragged arrangement so the host can persist it.
 * Debounced so dragging/zooming never floods postMessage (research D4, Principle IV).
 */
const reportLayout = debounce((): void => {
  if (!cy) {
    return;
  }
  const positions: Record<string, NodePosition> = {};
  cy.nodes().forEach((n) => {
    const p = n.position();
    positions[n.id()] = { x: p.x, y: p.y };
  });
  const pan = cy.pan();
  const viewport: Viewport = { pan: { x: pan.x, y: pan.y }, zoom: cy.zoom() };
  post({ type: "persistLayout", projectId: currentProjectId, positions, viewport });
}, 200);

/**
 * Feature 006 — seed a freshly-created graph from a saved arrangement:
 * all nodes saved → `preset` (no drift); some new → place new only; none → `cose`.
 */
function seedLayout(
  core: Core,
  saved: Record<string, NodePosition> | null | undefined,
  viewport: Viewport | null | undefined,
): void {
  const plan = classifySeed(
    saved,
    core.nodes().map((n) => n.id()),
  );
  if (plan.mode === "none") {
    fullRelayout();
    return;
  }
  const positions = saved ?? {};
  core.batch(() => {
    for (const id of plan.knownIds) {
      core.getElementById(id).position({ ...positions[id] });
    }
  });
  if (plan.mode === "preset") {
    core.layout({ name: "preset", animate: false, fit: true, padding: 30 }).run();
  } else {
    placeNewNodes(core, plan.newIds);
  }
  if (viewport) {
    core.zoom(viewport.zoom);
    core.pan({ ...viewport.pan });
  }
}

/**
 * Place nodes that have no saved position without moving the saved ones (FR-006): seed each
 * near its already-placed neighbours (graph centroid if isolated), then settle just those.
 */
function placeNewNodes(core: Core, newIds: string[]): void {
  if (newIds.length === 0) {
    return;
  }
  const isNew = new Set(newIds);
  const posOf = (n: NodeSingular): NodePosition => ({ x: n.position().x, y: n.position().y });
  const placed = core.nodes().filter((n: NodeSingular) => !isNew.has(n.id()));
  const graphCentroid = centroidFor(placed.map(posOf)) ?? { x: 0, y: 0 };
  core.batch(() => {
    for (const id of newIds) {
      const node = core.getElementById(id) as NodeSingular;
      const neighbours = node
        .neighborhood("node")
        .filter((n: NodeSingular) => !isNew.has(n.id()))
        .map(posOf);
      node.position(centroidFor(neighbours) ?? graphCentroid);
    }
  });
  // Lay out only the new nodes (Cytoscape collection layout) so saved nodes stay put.
  const newCollection = core.nodes().filter((n: NodeSingular) => isNew.has(n.id()));
  newCollection.layout({ name: "cose", randomize: false, animate: false, fit: false }).run();
}

function render(msg: Extract<HostToPanel, { type: "render" }>): void {
  currentProjectId = msg.activeProjectId ?? ALL_PROJECTS;
  const elements = toCytoscapeElements(msg.graph, msg.activeProjectId);
  const nodeCount = elements.filter((e) => e.group === "nodes").length;
  const edgeCount = elements.filter((e) => e.group === "edges").length;

  document.body.classList.toggle("is-empty", nodeCount === 0);

  try {
    if (!cy) {
      cy = cytoscape({
        container: document.getElementById("cy"),
        elements,
        style: stylesheet(),
        wheelSensitivity: 0.2,
      });
      wireInteractions(cy);
      wireReporting(cy);
      seedLayout(cy, msg.savedPositions, msg.savedViewport);
    } else {
      updateInPlace(cy, elements);
    }
    post({ type: "rendered", nodeCount, edgeCount, ok: true });
  } catch (err) {
    // Never leave a broken panel; report failure so the host/tests see it (R-9, I1).
    post({ type: "rendered", nodeCount, edgeCount, ok: false });
    console.error("[speckit-atlas] cytoscape render failed", err);
  }
}

/**
 * Incremental in-place update (SC-003): preserve pan/zoom/selection; re-run layout only
 * when the NODE set changes (adding/removing nodes needs positions). Node-data and
 * edge-only changes update without a full relayout, so the user's view is not disturbed.
 */
function updateInPlace(
  core: cytoscape.Core,
  elements: ReturnType<typeof toCytoscapeElements>,
): void {
  const pan = { ...core.pan() };
  const zoom = core.zoom();

  const newNodeIds = new Set(elements.filter((e) => e.group === "nodes").map((e) => e.data.id));
  const oldNodeIds = new Set(core.nodes().map((n) => n.id()));
  const nodeSetChanged =
    newNodeIds.size !== oldNodeIds.size ||
    [...newNodeIds].some((id) => !oldNodeIds.has(id)) ||
    [...oldNodeIds].some((id) => !newNodeIds.has(id));

  // Feature 006 — preserve existing (possibly hand-dragged) positions across a node-set
  // change so adding/removing a spec never scrambles what's already placed (FR-006/US3).
  const preserved = new Map(core.nodes().map((n) => [n.id(), { ...n.position() }]));
  const addedIds = [...newNodeIds].filter((id) => !oldNodeIds.has(id));

  core.batch(() => {
    if (nodeSetChanged) {
      core.elements().remove();
      core.add(
        elements.map((el) =>
          el.group === "nodes" && preserved.has(el.data.id)
            ? { ...el, position: preserved.get(el.data.id) }
            : el,
        ),
      );
    } else {
      // Same nodes: update node data in place, and replace all edges (cheap, no relayout).
      for (const el of elements) {
        if (el.group === "nodes") {
          core.getElementById(el.data.id).data(el.data);
        }
      }
      core.edges().remove();
      core.add(elements.filter((e) => e.group === "edges"));
    }
  });

  if (nodeSetChanged && addedIds.length > 0) {
    placeNewNodes(core, addedIds); // lay out only the new nodes; saved ones stay put
  }
  core.pan(pan);
  core.zoom(zoom);
  // Feature 010 — re-apply the single tracked selection; drop it if the spec is gone
  // (US1-4 / US2 "removed selection" edge case), then re-derive focus visibility.
  if (selectedNodeId) {
    const still = core.getElementById(selectedNodeId);
    if (still && still.length > 0) {
      still.select();
    } else {
      selectedNodeId = null;
    }
  }
  applyFocus();
}

function wireInteractions(core: Core): void {
  core.on("tap", "node", (evt) => {
    const n = evt.target as NodeSingular;
    // Cytoscape single-selects on tap; track the id so focus mode can anchor to it (US1/US2).
    selectedNodeId = n.id();
    showDetail(n.data() as CyNodeData);
    post({ type: "selectNode", nodeId: n.id() });
    applyFocus();
  });
  core.on("tap", "edge", (evt) => {
    const e = evt.target as EdgeSingular;
    showEdgeDetail(e.data() as CyEdgeData);
  });
  core.on("tap", (evt) => {
    if (evt.target === core) {
      selectedNodeId = null;
      hideDetail();
      post({ type: "selectNode", nodeId: null });
      applyFocus();
    }
  });
}

/**
 * Feature 006 — capture the arrangement whenever it settles or the user changes it:
 * `dragfree` (manual placement, FR-004), `layoutstop` (auto-layout result), and viewport
 * changes. All routed through the debounced reporter.
 */
function wireReporting(core: Core): void {
  core.on("dragfree", "node", () => reportLayout());
  core.on("layoutstop", () => reportLayout());
  core.on("pan zoom", () => reportLayout());
}

function focus(nodeId: string): void {
  const n = cy?.getElementById(nodeId);
  if (n && n.length > 0) {
    // Feature 010 (FR-001) — programmatic select is additive in Cytoscape, so clear the
    // prior selection first; otherwise SPECS-list clicks accumulate blue borders.
    cy?.$(":selected").unselect();
    n.select();
    selectedNodeId = nodeId;
    cy?.animate({ center: { eles: n }, zoom: 1.4 }, { duration: 200 });
    showDetail(n.data() as CyNodeData);
    applyFocus();
  }
}

/**
 * Feature 010 — derive and apply focus visibility from `{ focusModeOn, selectedNodeId }`.
 * Focus HIDES out-of-neighborhood elements (display); it never touches the `.dimmed`
 * opacity class owned by the tier/status filter (they compose orthogonally). Uses
 * `show()/hide()` so persisted layout positions (feature 006) are undisturbed.
 */
function applyFocus(): void {
  if (!cy) {
    return;
  }
  const core = cy;
  const adjacency = buildAdjacency(
    core.edges().map((e) => ({
      source: String(e.data("source")),
      target: String(e.data("target")),
    })),
  );
  const knownNodeIds = new Set(core.nodes().map((n) => n.id()));
  const decision = computeFocusVisible(
    adjacency,
    focusModeOn ? selectedNodeId : null,
    knownNodeIds,
  );
  core.batch(() => {
    if (decision.showAll) {
      core.elements().style("display", "element");
      return;
    }
    const visibleNodes = core.nodes().filter((n) => decision.nodes.has(n.id()));
    const inducedEdges = visibleNodes.edgesWith(visibleNodes);
    core.elements().style("display", "none");
    visibleNodes.style("display", "element");
    inducedEdges.style("display", "element");
  });
}

function applyFilter(tiers: readonly EdgeTier[] | null, statuses: readonly string[] | null): void {
  if (!cy) {
    return;
  }
  cy.batch(() => {
    cy!.elements().removeClass("dimmed");
    if (tiers) {
      cy!.edges().forEach((e) => {
        if (!tiers.includes(e.data("tier"))) {
          e.addClass("dimmed");
        }
      });
    }
    if (statuses) {
      cy!.nodes().forEach((n) => {
        if (!statuses.includes(String(n.data("status")))) {
          n.addClass("dimmed");
        }
      });
    }
  });
}

// ── detail panel ─────────────────────────────────────────────────────────────
function el(tag: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (text !== undefined) {
    node.textContent = text;
  }
  return node;
}
function detailRoot(): HTMLElement | null {
  return document.getElementById("detail");
}
function showDetail(data: CyNodeData): void {
  const root = detailRoot();
  if (!root) {
    return;
  }
  root.replaceChildren();
  root.append(el("h2", data.label));
  root.append(el("p", `Status: ${data.status ?? "—"}`));
  root.append(el("p", data.total ? `Tasks: ${data.done}/${data.total}` : "Tasks: —"));
  root.append(el("p", `Artifacts: ${Math.round(data.completeness * 100)}%`));
  if (data.hasWarnings) {
    const w = el("p", "⚠ has warnings");
    w.className = "warn";
    root.append(w);
  }
  const open = document.createElement("button");
  open.type = "button";
  open.textContent = "Open spec";
  open.addEventListener("click", () =>
    post({ type: "openSpec", nodeId: data.id, projectId: data.projectId }),
  );
  root.append(open);
  root.append(filesSection(data));
  document.body.classList.add("has-selection");
}

/** Feature 011 — the Files section: name-sorted, de-duplicated, each entry opens read-only.
 *  Feature 012 — a spec-level "See all changes" action and a per-file "Open changes" affordance. */
function filesSection(data: CyNodeData): HTMLElement {
  const section = document.createElement("div");
  section.className = "files";

  const header = document.createElement("div");
  header.className = "files-header";
  header.append(el("h3", "Files"));
  const seeAll = document.createElement("button");
  seeAll.type = "button";
  seeAll.className = "changeset-link";
  seeAll.textContent = "See all changes";
  seeAll.title = "Open the diff of everything changed to fulfill this spec";
  seeAll.addEventListener("click", () =>
    post({ type: "showChangeset", nodeId: data.id, projectId: data.projectId }),
  );
  header.append(seeAll);
  section.append(header);

  const files = data.files ?? [];
  if (files.length === 0) {
    const empty = el("p", "No source files referenced");
    empty.className = "files-empty";
    section.append(empty);
    return section;
  }
  const list = document.createElement("ul");
  list.className = "files-list";
  for (const path of files) {
    const item = document.createElement("li");
    const link = document.createElement("button");
    link.type = "button";
    link.className = "file-link";
    link.textContent = path;
    link.title = path;
    link.addEventListener("click", () =>
      post({ type: "openFile", path, projectId: data.projectId }),
    );
    const diff = document.createElement("button");
    diff.type = "button";
    diff.className = "file-diff";
    diff.textContent = "changes";
    diff.title = `Open before/after changes for ${path}`;
    diff.addEventListener("click", () =>
      post({ type: "openFileDiff", path, projectId: data.projectId, nodeId: data.id }),
    );
    item.append(link, diff);
    list.append(item);
  }
  section.append(list);
  return section;
}
function showEdgeDetail(data: CyEdgeData): void {
  const root = detailRoot();
  if (!root) {
    return;
  }
  root.replaceChildren();
  root.append(el("h2", `${data.source} → ${data.target}`));
  root.append(el("p", `${data.heuristic} · ${data.tier} · weight ${data.weight}`));
  document.body.classList.add("has-selection");
}
function hideDetail(): void {
  document.body.classList.remove("has-selection");
}

window.addEventListener("message", (event: MessageEvent<HostToPanel>) => {
  const msg = event.data;
  switch (msg?.type) {
    case "render":
      render(msg);
      break;
    case "focus":
      focus(msg.nodeId);
      break;
    case "filter":
      applyFilter(msg.filterTier, msg.filterStatus);
      break;
    case "relayout":
      // Reset layout (feature 006): discard seeded positions, re-run cose; the resulting
      // `layoutstop` re-persists the fresh arrangement via wireReporting.
      fullRelayout();
      break;
    case "focusMode":
      // Feature 010 — toggle focus-on-selection and re-derive visibility.
      focusModeOn = msg.enabled;
      applyFocus();
      break;
    default:
      break;
  }
});

post({ type: "ready" });
