# Phase 0 Research: Graph Rendering

The library/layout/budget/live-update questions were resolved by `/speckit-clarify`
(recorded in the spec's Clarifications). Research below fixes the remaining design
choices and confirms the clarified ones fit the constitution. No NEEDS CLARIFICATION
items remain.

## Decision 1: Cytoscape.js as the graph renderer (clarified)

- **Decision**: Render the map with **Cytoscape.js**, bundled locally into the webview.
- **Rationale**: Mature, MIT, canvas-based (no WebGPU/WASM needed → works in any VS Code
  webview), rich built-in interaction (pan/zoom/select/hover), pluggable layouts, and it
  does **not** require `unsafe-eval` — so it runs under our strict CSP with a nonce.
  Handles our scale (hundreds of nodes) comfortably. Chosen over d3-force+SVG (more custom
  work), vis-network (heavier, less flexible styling), and CodeGraphy's custom WebGPU+WASM
  engine (overkill/risky at our scale, extra toolchain).
- **Alternatives considered**: d3-force + SVG/Canvas; vis-network; sigma.js; custom
  WebGPU+WASM (CodeGraphyV4's approach) — rejected per clarify.

## Decision 2: Built-in `cose` force layout (no extra layout dependency)

- **Decision**: Use Cytoscape's **built-in `cose`** force-directed layout (ships inside
  cytoscape core — no extra package). Treat `fcose`/`cose-bilkent` as an optional upgrade
  only if the bundle stays within the 800 KB webview budget.
- **Rationale**: Force-directed was clarified as the default; the built-in layout keeps the
  webview bundle lean (cytoscape minified is well under the 800 KB budget on its own, and
  adds zero further deps). fcose is higher-quality but pulls `cose-base`/`layout-base`.
- **Alternatives considered**: `fcose` (nicer but adds deps/size — defer), `dagre`
  (hierarchical — not the chosen default), manual layout (unnecessary).

## Decision 3: Bundle budget & measurement (clarified)

- **Decision**: Packaged `.vsix` ≤ **2 MB**; webview JS bundle ≤ **800 KB**. A CI/gate check
  measures both after bundling cytoscape.
- **Rationale**: Cytoscape minified (~a few hundred KB) fits comfortably; the check
  prevents accidental bloat (constitution's stated size budget). If `fcose` is added and
  the budget is threatened, fall back to built-in `cose`.

## Decision 4: Two surfaces, host as message hub

- **Decision**: The **map** is a center **`WebviewPanel`** (opened by `speckitAtlas.openMap`,
  which today focuses the sidebar). The **controls** repurpose the existing sidebar
  **`WebviewView`** (legend, per-heuristic toggles, spec search/list, project selector).
  The extension host is the hub: control events → host updates options / rebuilds graph →
  posts the new model to the panel; panel events (openSpec/select) → host acts.
- **Rationale**: Matches the clarified hybrid layout and keeps each webview dumb (renders
  what it's sent). Revisits feature-001's sidebar placeholder (now controls) and its
  `openMap` (now opens the panel).
- **Alternatives considered**: single webview doing both (cramped, per earlier decision);
  panel-to-sidebar direct messaging (not possible — must route through the host).

## Decision 5: Incremental live update via a debounced watcher (clarified)

- **Decision**: Add a **`FileSystemWatcher`** on spec artifacts (`**/specs/**/*.md`,
  `**/.specify/**`), **debounced (~150–200 ms)**. On a change, re-read only the affected
  feature's files, re-run `parseFeature` for that feature (reusing feature 002's
  per-feature build via a cache in `projectScan`), rebuild the workspace graph (cheap), and
  post the new model to the panel, which updates elements **in place**.
- **Rationale**: Fulfils FR-016a/FR-016/SC-003 and the constitution's Principle IV
  (debounced fs events, incremental, no full re-scan). The per-feature cache makes a single
  change O(1) in parsing.
- **Alternatives considered**: full re-scan on every change (misses the 200 ms budget);
  polling (wasteful); no watcher / manual refresh only (rejected by clarify).

## Decision 6: Preserve viewport & selection across updates

- **Decision**: On an incremental `render`, the panel **diffs** the incoming graph against
  the current one — adds/removes/updates only changed nodes/edges and re-runs layout only
  for structural changes (or with existing positions fixed) — never a blind full re-layout.
  Current pan/zoom and the selected node are captured and restored.
- **Rationale**: SC-003 requires the update not to discard the user's pan/zoom/selection.

## Decision 7: Node/edge visual encoding (theme-aware)

- **Decision**: Nodes: label = title; **fill/border color by status**; a **ring/arc by
  task-completion %**; a **badge/indicator for warnings**; completeness shown compactly
  (e.g. small pips or opacity). Edges: **line style by tier** (definitive solid → strong →
  medium → risky dashed), **thickness by weight**, **arrowhead for directed vs none for
  symmetric**. All colors reference VS Code theme CSS variables so light/dark match.
- **Rationale**: Encodes exactly the model's node/edge attributes (FR-004/006); theme-aware
  per constitution/webview norms. Exact palette is a design detail, tuned at implementation.

## Decision 8: Open-spec navigation

- **Decision**: Opening a node's spec uses the editor's document-open API to show
  `spec.md` (read-only viewing); a missing/moved target is caught and surfaced as a message.
- **Rationale**: FR-012/SC-005; read-only (Principle III). The host resolves the node id +
  project to the file URI (the panel never touches the file system).

## Decision 9: CSP & offline for a JS graph library

- **Decision**: Keep the strict CSP + per-load nonce from feature 001; cytoscape and the
  renderer load only from local `media/`. No remote origins; canvas rendering needs no
  network and no `unsafe-eval`.
- **Rationale**: Principle VI; cytoscape is compatible with a nonce-based strict CSP.

## Open items carried to later features

- The agent-facing CLI/MCP surface (feature 004).
- Optional richer layouts (fcose) or layout-position persistence (out of scope here).
