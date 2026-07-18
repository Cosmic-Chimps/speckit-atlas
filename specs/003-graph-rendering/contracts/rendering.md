# Contract: Rendering & Interaction

What the map panel and controls must do, asserted where possible in
`@vscode/test-electron` (host-observable) and in plain-Node tests (pure helpers).
Message types: see `data-model.md`. Graph data: feature 002 (unchanged).

## Editor contributions (delta from feature 001)

- **R-1**: `speckitAtlas.openMap` opens (or reveals) a **center `WebviewPanel`** titled
  "SpecKit Atlas Map"; it no longer merely focuses the sidebar.
- **R-2**: The sidebar view `speckitAtlas.mapView` is repurposed to **controls** (legend,
  per-heuristic toggles, spec search/list, project selector).
- **R-3**: No new activation events beyond feature 001's; the panel is created on demand.
- **R-4**: All new ids remain namespaced `speckitAtlas.*`; no file associations added.

## Rendering (map panel)

- **R-5**: Given a `render` with a graph of N nodes, the panel shows exactly N node
  visuals (isolated nodes included) and every edge in the (active project's) graph.
- **R-6**: Definitive/strong/medium/risky edges are visually distinct; edge thickness
  reflects `weight`; directed vs `symmetric` edges are distinguishable.
- **R-7**: Each node visually encodes `status` and `taskCompletion`; warnings are indicated.
- **R-8**: With the risky heuristic off (default), no risky edges are drawn.
- **R-9**: An empty graph shows an empty-state message; a malformed/partial model renders
  what is valid — never a blank panel or an uncaught error.

## Interaction

- **R-10**: The user can pan and zoom; selecting a node emits `selectNode` and shows its
  detail (status, completion, warnings, completeness).
- **R-11**: Triggering "open spec" on a node emits `openSpec`; the host opens that spec's
  file read-only; a missing/moved file yields a message, not an exception (SC-005).
- **R-12**: An edge's evidence is viewable on hover/selection.

## Controls (sidebar) → model

- **R-13**: Toggling a heuristic emits `setOption`; the host rebuilds the graph with the
  new `GraphOptions` and re-renders; toggling it back restores the prior edges. `links`
  cannot be disabled.
- **R-14**: The legend documents node encodings and every edge tier.
- **R-15**: Selecting a spec in the search/list emits `focusSpec`; the panel centers/
  highlights that node. The project selector switches the active sub-graph.

## Multi-project

- **R-16**: A multi-root workspace exposes one sub-graph per project (selector or
  clustered); the panel never draws an edge between two projects.

## Incremental & performance

- **R-17**: A single spec file change triggers a debounced, incremental per-feature
  re-parse + rebuild, and an in-place panel update within ~200 ms on a 200-spec workspace,
  **preserving** the panel's pan/zoom/selection (SC-003).
- **R-18**: Opening the panel does not block the extension host (R-1 is async).

## Security / offline / budget

- **R-19**: The panel HTML uses a strict CSP with a per-load nonce; `localResourceRoots`
  limited to `media/`; no remote origins; no `unsafe-eval`. (Assertable on the served HTML.)
- **R-20**: Zero network requests occur during open/render/interaction (offline).
- **R-21**: The packaged `.vsix` is ≤ 2 MB and the webview JS bundle is ≤ 800 KB
  (measured in CI/gate; SC-009).
- **R-22**: The renderer receives the model via `postMessage` and performs no file-system
  or network access itself (Principle I/VI).

## Pure, unit-testable helpers (plain Node)

The style/encoding mapping is factored into pure functions so they test without a webview:

- **R-23**: `nodeStyleFor(node)` → a serializable style descriptor deterministically
  derived from `status`/`taskCompletion`/`completeness`/warnings.
- **R-24**: `edgeStyleFor(edge)` → a style descriptor derived from `tier`/`weight`/
  `symmetric` (e.g. dash pattern, width, arrow).
- **R-25**: `toCytoscapeElements(graph, activeProjectId)` → the elements array, containing
  no cross-project edges and one element per node/edge; JSON-serializable.
