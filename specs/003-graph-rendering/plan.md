# Implementation Plan: Graph Rendering

**Branch**: `003-graph-rendering` | **Date**: 2026-07-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-graph-rendering/spec.md`

## Summary

Render the feature-002 graph in the editor: a center **`WebviewPanel`** (the map, drawn
with **Cytoscape.js** + built-in `cose` force layout) opened via `speckitAtlas.openMap`,
and the existing sidebar view **repurposed into controls** (legend, per-heuristic toggles,
spec search/list, project selector). The extension host is the message hub: control
changes rebuild the graph (reusing 002) and re-render; node clicks open specs read-only. A
**debounced `FileSystemWatcher`** drives incremental per-feature re-parse and in-place map
updates that preserve pan/zoom/selection. Pure `core/` is unchanged; all work is in the
extension and webview layers, under a strict CSP, offline, within a stated bundle budget.

## Technical Context

**Language/Version**: TypeScript (`strict`); VS Code `^1.90.0`.

**Primary Dependencies**: **Cytoscape.js** (new runtime dependency — the constitution
permits a bundled, local, size-budgeted graph library) using its built-in `cose` layout
(no extra layout package). No other new runtime deps.

**Storage**: N/A — view state (pan/zoom/selection) lives in the webview for the session;
nothing persisted to the workspace.

**Testing**: pure style/element helpers via `node:test` (plain Node); `@vscode/test-electron`
for panel/controls/watcher integration.

**Target Platform**: VS Code desktop webview (canvas rendering — no WebGPU/WASM).

**Performance Goals**: opening the panel is non-blocking; a single spec change reflects in
the map within ~200 ms on a 200-spec workspace via debounced watcher + incremental
per-feature re-parse (reusing 002), preserving pan/zoom/selection; responsive on hundreds
of nodes.

**Constraints**: strict CSP + per-load nonce; no remote sources; cytoscape needs no
`unsafe-eval`; read-only (only opens a spec for viewing); offline; no telemetry; packaged
`.vsix` ≤ 2 MB and webview JS ≤ 800 KB; renderer receives the model via `postMessage` and
does no fs/network I/O.

**Scale/Scope**: rendering + interaction only; consumes 002's model unchanged.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Gate | Status |
|---|-----------|------|--------|
| I | Pure Domain Core, Thin Editor Shell | Core unchanged; all new code in `extension/` + `webview/`; renderer gets the model via messages, no fs access; style/element mapping factored into pure helpers. | ✅ PASS |
| II | Resilient Parsing Over Rigid Schemas | Empty/isolated/warning/malformed models render sensible states; never a blank panel or crash. | ✅ PASS — R-9, FR-017. |
| III | Read-Only by Default | Only interaction with files is opening a spec for viewing; no writes; no layout persistence to workspace. | ✅ PASS — FR-012/021. |
| IV | Responsive at Workspace Scale | Non-blocking panel; debounced watcher + incremental per-feature re-parse; in-place update < 200 ms preserving viewport; bundle-size budget asserted. | ✅ PASS — FR-016a, SC-003, research D5/D6. |
| V | Complement the Ecosystem | Vanilla repo; `speckitAtlas.*` ids; center panel + sidebar coexist with speckit-companion; no file associations. | ✅ PASS. |
| VI | Offline, Private, Telemetry-Free | Cytoscape bundled locally (no CDN), strict CSP + nonce, no `unsafe-eval`, no network, no telemetry; ≤ 800 KB webview / ≤ 2 MB vsix. | ✅ PASS — research D9, R-19/20/21. |
| — | Tech constraints (TS strict, layering, esbuild, minimal audited deps, size budget) | One new **local, audited, size-budgeted** graph lib (explicitly allowed). | ✅ PASS. |

**Result**: All gates pass. The one new runtime dependency (Cytoscape.js) is expressly
permitted by the constitution ("a graph/layout library MAY be bundled, but MUST be local
and MUST not pull the bundle past a stated size budget"). No deviations → Complexity
Tracking empty.

## Project Structure

### Documentation (this feature)

```text
specs/003-graph-rendering/
├── plan.md · research.md · data-model.md · quickstart.md
├── contracts/rendering.md
└── checklists/requirements.md
```

### Source Code (repository root) — additions/changes in **bold**

```text
src/
├── core/                       # UNCHANGED (pure; still consumed as-is)
├── extension/
│   ├── extension.ts            # ** update ** openMap opens the panel; wire watcher + controls
│   ├── mapPanel.ts             # ** NEW ** WebviewPanel manager: HTML+CSP, post render, handle openSpec/select
│   ├── controlsView.ts         # ** NEW/repurpose ** sidebar WebviewViewProvider → controls (was mapViewProvider welcome)
│   ├── specWatcher.ts          # ** NEW ** debounced FileSystemWatcher → incremental rebuild
│   ├── projectScan.ts          # ** update ** per-feature content + FeatureFacts cache for incremental
│   ├── webviewHtml.ts          # ** update/reuse ** shared CSP+nonce HTML builder (panel + controls)
│   └── mapViewProvider.ts      # ** removed/renamed ** → controlsView.ts
└── webview/
    ├── map/main.ts             # ** NEW ** Cytoscape renderer (→ media/map.js): elements, cose layout,
    │                           #           pan/zoom/select/hover, in-place diff update, viewport/selection preserve
    ├── map/elements.ts         # ** NEW pure ** toCytoscapeElements / nodeStyleFor / edgeStyleFor (R-23..R-25)
    ├── controls/main.ts        # ** NEW ** sidebar controls (→ media/controls.js): toggles, legend, search, project select
    └── protocol.ts             # ** update ** HostToPanel/PanelToHost/HostToControls/ControlsToHost

media/                          # ** + map.css, controls.css, cytoscape bundled into map.js **
esbuild.js                      # ** update ** add map + controls webview entry points
test/
├── contracts/                  # ** + elements/style helper tests + panel CSP test **
└── integration/                # ** + panel/controls/watcher/openSpec/incremental scenarios **
fixtures/graph/                 # reuse 002's fixtures (cross-links, two-projects, malformed, …)
```

**Structure Decision**: `core/` is untouched — this is purely adapter + renderer work.
The map is a `WebviewPanel`; the sidebar becomes controls; the host mediates between them
and owns the watcher + the (cached) scan. The style/element mapping is isolated in a pure
`webview/map/elements.ts` so it unit-tests in plain Node without a webview. Cytoscape is
bundled into `media/map.js` (esbuild), keeping the webview offline and CSP-clean.

## Complexity Tracking

> No constitution violations. The new runtime dependency is explicitly permitted.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
