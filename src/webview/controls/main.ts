import type { EdgeTier, GraphOptions } from "../../core/index.js";
import type { ControlsToHost, HostToControls, SpecRef } from "../protocol.js";
import { ENCODING_NOTES, HELP_ENTRIES, hasActiveFilter } from "./help.js";

interface VsCodeApi {
  postMessage(message: ControlsToHost): void;
}
declare function acquireVsCodeApi(): VsCodeApi;
const vscode = acquireVsCodeApi();
function post(message: ControlsToHost): void {
  vscode.postMessage(message);
}

const TOGGLES: { key: keyof GraphOptions; label: string; locked?: boolean }[] = [
  { key: "links", label: "Links (definitive)", locked: true },
  { key: "slugMentions", label: "Slug mentions (strong)" },
  { key: "sharedEntities", label: "Shared entities (medium)" },
  { key: "bareNumbers", label: "Bare numbers (risky)" },
  { key: "specToCode", label: "Spec → code layer" },
];

const TIERS: EdgeTier[] = ["definitive", "strong", "medium", "risky"];

let lastSpecs: readonly SpecRef[] = [];
/** Feature 010 — remember the focus toggle across control re-renders (state pushes). */
let focusModeOn = false;
/** Feature 010 — the selected spec (echoed by the host) and how many specs relate to it. */
let selectedSpecId: string | null = null;
let relatedCount = 0;

function el(tag: string, text?: string): HTMLElement {
  const n = document.createElement(tag);
  if (text !== undefined) {
    n.textContent = text;
  }
  return n;
}

function renderState(state: Extract<HostToControls, { type: "state" }>): void {
  lastSpecs = state.specs;
  const root = document.getElementById("app");
  if (!root) {
    return;
  }
  root.replaceChildren();
  root.append(el("h1", "SpecKit Atlas"));

  // ── Relationship toggles ──
  const toggles = el("section");
  toggles.append(el("h2", "Relationships"));
  for (const t of TOGGLES) {
    const label = document.createElement("label");
    label.className = "toggle";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = Boolean(state.options[t.key]);
    input.disabled = t.locked === true;
    input.addEventListener("change", () =>
      post({ type: "setOption", key: t.key, value: input.checked }),
    );
    label.append(input, document.createTextNode(" " + t.label));
    toggles.append(label);
  }
  root.append(toggles);

  // ── Tier filter (visual highlight) ──
  const filter = el("section");
  filter.append(el("h2", "Filter by tier"));
  const tierChecks: HTMLInputElement[] = [];
  for (const tier of TIERS) {
    const label = document.createElement("label");
    label.className = "toggle";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = true;
    input.addEventListener("change", onFilterChange);
    tierChecks.push(input);
    label.append(input, document.createTextNode(" " + tier));
    filter.append(label);
  }
  root.append(filter);

  // ── Status filter ──
  const statuses = [...new Set(state.specs.map((s) => s.status).filter((s): s is string => !!s))];
  const statusSection = el("section");
  statusSection.append(el("h2", "Filter by status"));
  const statusSelect = document.createElement("select");
  statusSelect.multiple = true;
  statusSelect.size = Math.min(4, Math.max(1, statuses.length));
  for (const s of statuses) {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = s;
    opt.selected = true;
    statusSelect.append(opt);
  }
  statusSelect.addEventListener("change", onFilterChange);
  statusSection.append(statusSelect);

  // ── Clear filters (US1) ──
  const clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.className = "clear-filters";
  clearBtn.textContent = "Clear filters";
  clearBtn.addEventListener("click", () => {
    for (const c of tierChecks) {
      c.checked = true;
    }
    for (const opt of Array.from(statusSelect.options)) {
      opt.selected = true;
    }
    onFilterChange(); // emits setFilter(null, null) since everything is now selected
  });
  statusSection.append(clearBtn);
  root.append(statusSection);

  // ── Layout (feature 006) — reset the saved arrangement for the current view ──
  const layoutSection = el("section");
  layoutSection.append(el("h2", "Layout"));
  const resetBtn = document.createElement("button");
  resetBtn.type = "button";
  resetBtn.className = "reset-layout";
  resetBtn.textContent = "Reset layout";
  resetBtn.title = "Discard the saved node positions and re-run the automatic layout";
  resetBtn.disabled = state.resetEnabled !== true; // nothing saved yet ⇒ nothing to reset
  resetBtn.addEventListener("click", () => post({ type: "resetLayout" }));
  layoutSection.append(resetBtn);
  root.append(layoutSection);

  // ── View (feature 010) — focus the map on the selected spec's neighborhood ──
  const viewSection = el("section");
  viewSection.append(el("h2", "View"));
  const focusLabel = document.createElement("label");
  focusLabel.className = "toggle";
  const focusInput = document.createElement("input");
  focusInput.type = "checkbox";
  focusInput.className = "focus-mode";
  focusInput.checked = focusModeOn; // preserved across state re-renders
  focusInput.title = "Show only the selected spec, its direct neighbors, and their links";
  focusInput.addEventListener("change", () => {
    focusModeOn = focusInput.checked;
    post({ type: "setFocusMode", enabled: focusInput.checked });
  });
  focusLabel.append(focusInput, document.createTextNode(" Focus on selection"));
  viewSection.append(focusLabel);
  root.append(viewSection);

  function onFilterChange(): void {
    emitFilter(tierChecks, statusSelect);
    const tierAll = tierChecks.every((c) => c.checked);
    const statusAll =
      Array.from(statusSelect.selectedOptions).length === statusSelect.options.length;
    clearBtn.disabled = !hasActiveFilter(tierAll, statusAll);
  }
  clearBtn.disabled = true; // nothing filtered on first render

  // ── Project selector ──
  if (state.projects.length > 1) {
    const projSection = el("section");
    projSection.append(el("h2", "Project"));
    const select = document.createElement("select");
    const all = document.createElement("option");
    all.value = "";
    all.textContent = "All projects";
    select.append(all);
    for (const p of state.projects) {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.name;
      opt.selected = p.id === state.activeProjectId;
      select.append(opt);
    }
    select.addEventListener("change", () =>
      post({ type: "selectProject", projectId: select.value || null }),
    );
    projSection.append(select);
    root.append(projSection);
  }

  // ── Spec search / list ──
  const specSection = el("section");
  specSection.append(el("h2", "Specs"));
  const search = document.createElement("input");
  search.type = "search";
  search.placeholder = "Search specs…";
  const list = document.createElement("ul");
  list.className = "spec-list";
  const renderList = (q: string): void => {
    list.replaceChildren();
    for (const s of lastSpecs.filter((x) => x.title.toLowerCase().includes(q.toLowerCase()))) {
      const li = el("li", s.title);
      li.dataset.specId = s.id;
      li.addEventListener("click", () => post({ type: "focusSpec", nodeId: s.id }));
      list.append(li);
    }
    applySelectionHighlight(); // keep the selected row highlighted across re-renders (feature 010)
  };
  search.addEventListener("input", () => renderList(search.value));
  renderList("");
  specSection.append(search, list);
  root.append(specSection);

  root.append(renderHelp());
}

// ── Help / legend (US2) — a keyboard-operable disclosure; open/close never
// touches the map or other controls (it posts no messages). ──
function renderHelp(): HTMLElement {
  const details = document.createElement("details");
  details.className = "help";
  const summary = document.createElement("summary");
  summary.textContent = "What do these mean?";
  details.append(summary);

  const rels = el("section", undefined);
  rels.className = "help-group";
  rels.append(el("h3", "Relationship types"));
  for (const e of HELP_ENTRIES) {
    const row = el("div");
    row.className = "help-entry";
    const head = el("span");
    head.className = "help-entry-label";
    head.textContent = e.defaultOn
      ? `${e.label} (${e.tier})`
      : `${e.label} (${e.tier}, off by default)`;
    row.append(head, el("p", e.description));
    rels.append(row);
  }
  details.append(rels);

  const enc = el("section");
  enc.className = "help-group";
  enc.append(el("h3", "Visual encodings"));
  for (const kind of ["node", "edge"] as const) {
    for (const n of ENCODING_NOTES.filter((x) => x.kind === kind)) {
      const row = el("div");
      row.className = "help-entry";
      const head = el("span");
      head.className = "help-entry-label";
      head.textContent = n.label;
      row.append(head, el("p", n.description));
      enc.append(row);
    }
  }
  details.append(enc);

  return details;
}

/**
 * Feature 010 — reflect the current selection in the SPECS list: highlight the selected
 * row and show how many specs relate to it. Operates on the existing DOM (no re-render),
 * and is also called at the end of renderList so the highlight survives state re-pushes.
 */
function applySelectionHighlight(): void {
  const items = document.querySelectorAll<HTMLElement>("ul.spec-list li");
  items.forEach((li) => {
    const isSel = li.dataset.specId != null && li.dataset.specId === selectedSpecId;
    li.classList.toggle("selected", isSel);
    li.querySelector(".rel-count")?.remove();
    if (isSel) {
      const badge = document.createElement("span");
      badge.className = "rel-count";
      badge.textContent = relatedCount === 1 ? "1 related" : `${relatedCount} related`;
      li.append(badge);
    }
  });
}

function emitFilter(tierChecks: HTMLInputElement[], statusSelect: HTMLSelectElement): void {
  const selectedTiers = TIERS.filter((_, i) => tierChecks[i]?.checked);
  const allTiers = selectedTiers.length === TIERS.length;
  const selectedStatuses = Array.from(statusSelect.selectedOptions).map((o) => o.value);
  const allStatuses = selectedStatuses.length === statusSelect.options.length;
  post({
    type: "setFilter",
    filterTier: allTiers ? null : selectedTiers,
    filterStatus: allStatuses ? null : selectedStatuses,
  });
}

window.addEventListener("message", (event: MessageEvent<HostToControls>) => {
  const data = event.data;
  if (data?.type === "state") {
    renderState(data);
  } else if (data?.type === "selection") {
    selectedSpecId = data.nodeId;
    relatedCount = data.relatedCount;
    applySelectionHighlight();
  }
});

post({ type: "ready" });
