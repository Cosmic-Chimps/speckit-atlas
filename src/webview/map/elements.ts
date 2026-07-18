import type {
  EdgeTier,
  ProjectGraph,
  RelationEdge,
  SpecNode,
  WorkspaceGraph,
} from "../../core/index.js";

/**
 * Pure mapping from the feature-002 graph model to renderer-agnostic element and style
 * descriptors. No `cytoscape`/DOM imports, so this unit-tests in plain Node (R-23..R-25).
 * The webview renderer (map/main.ts) feeds these into Cytoscape.
 */

export interface CyNodeData {
  readonly id: string;
  readonly projectId: string;
  readonly label: string;
  readonly status: string | null;
  readonly done: number | null;
  readonly total: number | null;
  readonly completeness: number; // 0..1 fraction of standard artifacts present
  readonly hasWarnings: boolean;
  // presentational (from nodeStyleFor) — read directly by the cytoscape stylesheet
  readonly statusClass: string;
  readonly completion: number; // 0..1 task completion
}

export interface CyEdgeData {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly heuristic: string;
  readonly tier: EdgeTier;
  readonly weight: number;
  readonly symmetric: boolean;
  // presentational (from edgeStyleFor)
  readonly lineStyle: EdgeStyle["lineStyle"];
  readonly widthPx: number;
  readonly arrow: EdgeStyle["targetArrow"];
}

export interface CyElement {
  readonly group: "nodes" | "edges";
  readonly data: CyNodeData | CyEdgeData;
}

/** Style descriptor for a node — deterministic from the node's attributes. */
export interface NodeStyle {
  readonly statusClass: string; // e.g. "status-implemented"
  readonly completion: number; // 0..1
  readonly warn: boolean;
}

/** Style descriptor for an edge — deterministic from tier/weight/symmetry. */
export interface EdgeStyle {
  readonly tier: EdgeTier;
  readonly lineStyle: "solid" | "dashed" | "dotted";
  readonly width: number; // px
  readonly targetArrow: "triangle" | "none";
}

const STANDARD_ARTIFACTS = 8; // ArtifactPresence has 8 boolean fields

function completenessFraction(node: SpecNode): number {
  const c = node.completeness;
  if (!c) {
    return 0;
  }
  const present = [
    c.spec,
    c.plan,
    c.tasks,
    c.research,
    c.dataModel,
    c.quickstart,
    c.contracts,
    c.checklists,
  ].filter(Boolean).length;
  return present / STANDARD_ARTIFACTS;
}

/** Normalize a status string into a stable CSS-safe class suffix. */
export function statusClass(status: string | null): string {
  if (!status) {
    return "status-unknown";
  }
  const key = status.toLowerCase();
  if (key.startsWith("implement")) {
    return "status-implemented";
  }
  if (key.startsWith("complete")) {
    return "status-complete";
  }
  if (key.startsWith("draft")) {
    return "status-draft";
  }
  return "status-other";
}

export function nodeStyleFor(node: SpecNode): NodeStyle {
  return {
    statusClass: statusClass(node.status),
    completion:
      node.taskCompletion && node.taskCompletion.total > 0
        ? node.taskCompletion.done / node.taskCompletion.total
        : 0,
    warn: (node.warnings?.length ?? 0) > 0,
  };
}

const TIER_LINE: Record<EdgeTier, EdgeStyle["lineStyle"]> = {
  definitive: "solid",
  strong: "solid",
  medium: "dashed",
  risky: "dotted",
};

export function edgeStyleFor(edge: RelationEdge): EdgeStyle {
  const width = Math.min(6, 1 + Math.max(0, (edge.weight ?? 1) - 1)); // 1..6 px by weight
  return {
    tier: edge.tier,
    lineStyle: TIER_LINE[edge.tier] ?? "solid",
    width,
    targetArrow: edge.symmetric ? "none" : "triangle",
  };
}

function nodeElement(node: SpecNode): CyElement {
  const style = nodeStyleFor(node);
  return {
    group: "nodes",
    data: {
      id: node.id,
      projectId: node.projectId,
      label: node.title,
      status: node.status,
      done: node.taskCompletion?.done ?? null,
      total: node.taskCompletion?.total ?? null,
      completeness: completenessFraction(node),
      hasWarnings: (node.warnings?.length ?? 0) > 0,
      statusClass: style.statusClass,
      completion: style.completion,
    },
  };
}

function edgeElement(edge: RelationEdge, index: number): CyElement {
  const style = edgeStyleFor(edge);
  return {
    group: "edges",
    data: {
      id: `e${index}:${edge.source}->${edge.target}:${edge.heuristic}`,
      source: edge.source,
      target: edge.target,
      heuristic: edge.heuristic,
      tier: edge.tier,
      weight: edge.weight,
      symmetric: edge.symmetric === true,
      lineStyle: style.lineStyle,
      widthPx: style.width,
      arrow: style.targetArrow,
    },
  };
}

/**
 * Flatten the workspace graph into Cytoscape elements for the active project (or all
 * projects when activeProjectId is null). Never emits cross-project edges. Total.
 */
export function toCytoscapeElements(
  graph: WorkspaceGraph | null,
  activeProjectId: string | null,
): CyElement[] {
  const projects: readonly ProjectGraph[] = graph?.projects ?? [];
  const scoped = activeProjectId
    ? projects.filter((p) => p.projectId === activeProjectId)
    : projects;

  const elements: CyElement[] = [];
  let edgeIndex = 0;
  for (const project of scoped) {
    const nodeIds = new Set(project.nodes.map((n) => n.id));
    for (const node of project.nodes) {
      elements.push(nodeElement(node));
    }
    for (const edge of project.edges) {
      // Defensive: never emit an edge whose endpoints are not both in this project.
      if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
        elements.push(edgeElement(edge, edgeIndex++));
      }
    }
  }
  return elements;
}
