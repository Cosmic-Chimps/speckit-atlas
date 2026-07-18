---
description: "Task list for Graph Rendering implementation"
---

# Tasks: Graph Rendering

**Input**: Design documents from `/specs/003-graph-rendering/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: INCLUDED. The constitution mandates a passing CI test gate; the contracts define
assertable behaviors (R-1…R-25). Pure helpers are unit-tested in plain Node; panel/controls/
watcher behavior under `@vscode/test-electron`.

**Organization**: By user story. US1 (see the map) is the MVP; US2 adds controls; US3 adds
explore/navigate. A cross-cutting phase adds the live-update watcher; polish closes budgets.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallelizable (different files, no dependency on an incomplete task)
- **[Story]**: US1 / US2 / US3 (Setup, Foundational, cross-cutting, Polish carry no label)
- `core/` is UNCHANGED; all work is in `src/extension/`, `src/webview/`, `media/`.

---

## Phase 1: Setup

- [X] T001 Add `cytoscape` runtime dependency and `@types/cytoscape` (dev) to `package.json`; run `npm install`
- [X] T002 [P] Add esbuild entry points in `esbuild.js`: `src/webview/map/main.ts` → `media/map.js` and `src/webview/controls/main.ts` → `media/controls.js` (browser/IIFE, minify in production)
- [X] T003 [P] Add `media/map.css` and `media/controls.css` with theme-aware base styles (VS Code CSS variables)

**Checkpoint**: build produces the two new webview bundles; existing suites still green.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Message protocol + the pure element/style mapping every surface needs.

**⚠️ CRITICAL**: No user-story work begins until this phase is complete.

- [X] T004 Extend `src/webview/protocol.ts` with `HostToPanel` / `PanelToHost` / `HostToControls` / `ControlsToHost` message types per data-model.md
- [X] T005 [P] Implement pure `src/webview/map/elements.ts`: `toCytoscapeElements(graph, activeProjectId)`, `nodeStyleFor(node)`, `edgeStyleFor(edge)` — plain serializable descriptors, no `cytoscape`/DOM import
- [X] T006 [P] Contract tests for the pure helpers in `test/contracts/elements.test.ts` (R-23/R-24/R-25): one element per node/edge, isolated nodes included, no cross-project edges, JSON round-trip, deterministic styles by status/tier/weight/symmetric

**Checkpoint**: `test:contracts` green; element/style mapping proven without a webview.

---

## Phase 3: User Story 1 - See the specification map (Priority: P1) 🎯 MVP

**Goal**: "Open Map" shows a center panel with the model's nodes and edges, tiers visually
distinct, node status/progress encoded.

**Independent Test**: Open `fixtures/graph/cross-links`, run "Open Map," confirm a center
panel shows one node per spec + the expected edges with distinct tiers; empty fixture → empty state.

- [X] T007 [US1] Update `src/extension/webviewHtml.ts` to build the panel HTML (strict CSP + per-load nonce; script `media/map.js`, style `media/map.css`; `localResourceRoots` = media)
- [X] T008 [US1] Implement `src/extension/mapPanel.ts`: create/reveal a center `WebviewPanel` ("SpecKit Atlas Map"), post `render` (graph + options + activeProjectId), handle `ready`/`openSpec`/`selectNode`; retain context when hidden
- [X] T009 [US1] Implement `src/webview/map/main.ts`: on `render`, build Cytoscape with `toCytoscapeElements` + built-in `cose` force layout + `nodeStyleFor`/`edgeStyleFor`; pan/zoom/select; edge evidence on hover/select; post `ready`/`selectNode`; defensive on unknown `schemaVersion`. **Verify early that Cytoscape initializes and lays out under the strict nonce CSP with NO `unsafe-eval`/workers (Principle VI); if it needs eval, stop and reassess the library choice before building further.**
- [X] T010 [US1] Empty/malformed render state in `src/webview/map/main.ts` (empty-state message; render only valid elements) (R-9)
- [X] T011 [US1] Update `src/extension/extension.ts`: `speckitAtlas.openMap` creates/reveals the map panel and posts the current `WorkspaceGraph` + `GraphOptions` (replaces the sidebar-focus behavior)
- [X] T012 [P] [US1] Contract test `test/contracts/panel-csp.test.ts`: panel HTML has `default-src 'none'`, a nonce, no remote origin, no `unsafe-eval`, no inline handlers (R-19)
- [X] T013 [P] [US1] Integration test `test/integration/panel.test.ts`: `openMap` creates a center panel (R-1); opening `fixtures/graph/cross-links` renders expected node/edge counts (R-5); empty fixture → empty state (R-9); **assert the webview reports it initialized Cytoscape successfully under the CSP (no eval/CSP error) — the runtime confirmation of the I1 check in T009**

**Checkpoint**: MVP — a real, interactive map of the current workspace renders center-stage.

---

## Phase 4: User Story 2 - Steer the map (controls) (Priority: P2)

**Goal**: The sidebar becomes controls: legend, per-heuristic toggles that re-render the
map, spec search/list, project selector.

**Independent Test**: With the map open, toggle a heuristic → its edges appear/disappear;
search a spec → it focuses in the map.

**Depends on**: US1 (panel + host render loop).

- [X] T014 [US2] Replace `src/extension/mapViewProvider.ts` with `src/extension/controlsView.ts` (WebviewViewProvider): serve controls HTML, post `state`, handle `setOption`/`selectProject`/`focusSpec`; update the registration in `extension.ts` and the view `name` in `package.json`
- [X] T015 [US2] Implement `src/webview/controls/main.ts`: render legend + per-heuristic toggles (`links` locked on) + spec search/list + project selector; emit `setOption`/`focusSpec`/`selectProject`; post `ready`
- [X] T016 [US2] Wire host in `src/extension/extension.ts`: on `setOption`, rebuild the `WorkspaceGraph` with updated `GraphOptions` (reuse feature 002) and re-`render` the panel + re-`state` the controls
- [X] T017 [US2] Wire `focusSpec`/`selectProject` in `extension.ts` + `mapPanel.ts`: host posts `focus`/updated `render` so the panel centers the node or switches active project
- [X] T018 [P] [US2] Integration test `test/integration/controls.test.ts`: toggling a heuristic rebuilds + re-renders (edge set changes); risky off by default; `links` cannot be disabled (R-13)
- [X] T031 [US2] Implement filter/highlight by relationship tier and by implementation status (FR-013): add a `setFilter` (controls→host) + `filter` (host→panel) message pair to `src/webview/protocol.ts` carrying `filterTier`/`filterStatus`; controls emit it, and `src/webview/map/main.ts` dims/hides non-matching edges/nodes (a **visual** filter — not a model rebuild, distinct from the heuristic toggles). Cover in `test/integration/controls.test.ts`.

**Checkpoint**: US1 + US2 — the map is steerable; toggles map to feature 002's options.

---

## Phase 5: User Story 3 - Explore a spec and jump to it (Priority: P3)

**Goal**: Select a node for detail; open its spec file read-only; per-project sub-graphs.

**Independent Test**: Select a node → detail matches the model; "open spec" opens the right
file read-only; multi-root shows separate sub-graphs.

**Depends on**: US1 (panel).

- [X] T019 [US3] Node detail on selection in `src/webview/map/main.ts` (+ detail surface): show status, task-completion, warnings, artifact completeness for the selected node (R-10)
- [X] T020 [US3] Open-spec navigation in `src/extension/mapPanel.ts` + `extension.ts`: on `openSpec`, resolve `{projectId,nodeId}` → the spec's file URI and open it read-only via the editor API; a missing/moved file surfaces a message, not an exception (R-11, SC-005)
- [X] T021 [US3] Multi-project rendering: the project selector sets `activeProjectId`; the panel renders that sub-graph only and never draws cross-project edges (R-16)
- [X] T022 [P] [US3] Integration test `test/integration/explore.test.ts`: `openSpec` opens the correct file read-only and handles a missing target; `fixtures/graph/two-projects` shows per-project sub-graphs with zero cross edges; zero workspace writes (R-11/R-16, SC-005/SC-007, Principle III)

**Checkpoint**: All three stories functional — view, steer, explore.

---

## Phase 6: Live update & performance (FR-016a / SC-003)

**Purpose**: Make the map update automatically and incrementally when specs change.

- [X] T023 Add a per-feature content + `FeatureFacts` cache to `src/extension/projectScan.ts` so a single changed feature is re-read/re-parsed in isolation (reuse feature 002's `parseFeature`)
- [X] T024 Implement `src/extension/specWatcher.ts`: a debounced (~150–200 ms) `FileSystemWatcher` on `**/specs/**/*.md` and `**/.specify/**`; on change, identify the affected feature, incrementally rebuild the `WorkspaceGraph`, and post `render`; register/dispose it in `extension.ts`
- [X] T025 In-place update in `src/webview/map/main.ts`: diff the incoming graph against current elements (add/remove/update), re-run layout only on structural change, and capture+restore pan/zoom/selection (R-17)
- [X] T026 [P] Integration test `test/integration/incremental.test.ts`: simulate a single spec file change → the model updates incrementally and the panel preserves pan/zoom/selection (R-17, SC-003)

**Checkpoint**: editing a spec reflects in the map in place, within budget.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T027 [P] Bundle-size gate: a check (script or `test:contracts` case) asserting the packaged `.vsix` ≤ 2 MB and `media/map.js` ≤ 800 KB after bundling cytoscape (R-21/SC-009)
- [X] T032 [P] Extend the no-telemetry/no-network contract test (from feature 001) to also scan `media/map.js` and `media/controls.js` — the new webview bundles must contain no network/telemetry sinks (`fetch`/`XMLHttpRequest`/`WebSocket`/`https?://`/telemetry) so SC-004 / FR-021 hold for the cytoscape bundle too
- [X] T028 [P] Update `CHANGELOG.md` (map rendering + controls) and `README.md` (map/controls usage)
- [X] T029 [P] Update `package.json` view/title metadata: the sidebar view **display name** becomes "Controls" (the map is now the center panel). **Keep the view id `speckitAtlas.mapView` unchanged** (renaming it is a breaking contribution change); add a code comment noting the intentional id/name mismatch (the "mapView" id now hosts controls). Confirm `.vscodeignore` ships `media/*.js|css` while `node_modules` stays unbundled.
- [X] T030 Validate `quickstart.md` steps 2–8 and run the full gate (typecheck, lint, format, test:core, test:contracts, test:integration, `package` + size check)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (P1)** → **Foundational (P2, blocks all stories)** → **US1** → US2, US3 → **Live update (P6)** → **Polish (P7)**.
- **US2** and **US3** both depend on US1's panel + host render loop; they are independent of
  each other and can proceed in parallel after US1.
- **Live update (P6)** depends on US1 (panel render) and the `projectScan` cache; benefits
  from US2's option handling but does not require it.

### Within Each Story

- Protocol + pure helpers (P2) before any rendering.
- Panel HTML/host (T007/T008) before the renderer wiring (T009); `openMap` (T011) after the panel exists.
- Controls provider (T014) before the controls webview wiring (T015/T016).

---

## Parallel Opportunities

- **Setup**: T002, T003 [P] after T001.
- **Foundational**: T005 + T006 [P] (helper + its tests); T004 first (types).
- **US1**: T012, T013 [P] (tests); T007→T008→T009→T010 is the panel/renderer chain; T011 after.
- **US2**: T018 [P] (test); T014→T015→T016→T017 largely sequential (shared files/flow); T031 (filter/highlight) after T015/T016.
- **US3**: T022 [P] (test); T019/T020/T021 touch different concerns, mostly parallelizable.
- **Live update**: T026 [P]; T023→T024→T025 sequential (cache → watcher → in-place diff).
- **Polish**: T027/T028/T029/T032 [P]; T030 last.

### Parallel Example: User Story 1

```bash
Task: "T012 panel CSP contract test"
Task: "T013 integration: open panel + render cross-links"
# while the panel/renderer chain (T007→T008→T009→T010) is implemented
```

---

## Implementation Strategy

### MVP First (US1 only)

1. Setup → 2. Foundational → 3. US1 → **STOP & VALIDATE**: "Open Map" shows the real
   center-panel map for `fixtures/graph/cross-links`, tiers distinct, no crash on empty.

### Incremental Delivery

1. Foundational ready. 2. US1 → the map renders (demo). 3. US2 → steerable via controls.
4. US3 → explore + open specs + multi-project. 5. Live update → auto-refresh in place.
6. Polish → bundle budget + docs + gate.

---

## Notes

- [P] = different files, no dependency on an incomplete task.
- `core/` is not modified; the renderer receives the model via `postMessage` and does no
  fs/network I/O (Principles I & VI).
- Reuse feature 002's `fixtures/graph/*` for panel/controls/multi-project/incremental tests.
- Keep the strict CSP + nonce; cytoscape is bundled locally (no CDN) and must stay within
  the ≤ 800 KB webview / ≤ 2 MB vsix budget.
