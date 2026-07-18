---
description: "Task list for feature 006 — Persist Map Layout Across Close/Reopen"
---

# Tasks: Persist Map Layout Across Close/Reopen

**Input**: Design documents from `/specs/006-persist-map-layout/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/layout-persistence.md

**Tests**: Included — the constitution mandates fixture-driven, CI-gated tests
(pure helpers via `node:test`, editor behavior via `@vscode/test-electron`). Pure
tests live under `test/contracts/`; electron tests under `test/integration/`.

**Organization**: Grouped by user story (US1 P1 → US2 P2 → US3 P3) for independent
implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 / US2 / US3 (setup, foundational, polish have no story label)
- Exact file paths are included in each task.

## Path Conventions

Single VS Code extension project. Host: `src/extension/`; webview: `src/webview/`;
shared protocol: `src/webview/protocol.ts`; pure tests: `test/contracts/`; electron
tests: `test/integration/`. `src/core/` is **not** touched by this feature.

---

## Phase 1: Setup

**Purpose**: Confirm a clean baseline before changing the shell layers.

- [X] T001 Confirm baseline green: run `npm run build` and `npm test`; note the current `.vsix` size for the budget check in T025. No code changes.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared protocol, pure layout model, and storage wrapper that every user
story depends on. Node positions are a shell concern — **no `src/core/` changes**.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 Extend postMessage contracts in `src/webview/protocol.ts`: add optional `savedPositions`/`savedViewport` to `HostToPanel` `render`; add `HostToPanel` `{ type: "relayout" }`; add `PanelToHost` `{ type: "persistLayout"; projectId; positions; viewport }`; add `ControlsToHost` `{ type: "resetLayout" }`. Keep all additions backward-compatible (per contracts/layout-persistence.md).
- [X] T003 [P] Create pure layout model in `src/extension/layoutModel.ts`: export `MAP_LAYOUT_KEY = "speckitAtlas.mapLayout"`, `LAYOUT_SCHEMA_VERSION = 1`, types (`NodePosition`, `Viewport`, `ProjectLayout`, `SavedMapLayout`), and pure functions `parseStored(raw): SavedMapLayout` (resilient — bad/version-mismatched → empty, never throws), `mergeReport(store, projectId, positions, viewport, currentNodeIds): SavedMapLayout` (prunes stale ids + empty buckets, drops non-finite), `positionsForProject(store, projectId)`, `resetEnabled(store, projectId): boolean`. No `vscode`/DOM imports.
- [X] T004 [P] Create pure seeding classifier in `src/webview/map/layout.ts`: export `classifySeed(savedPositions, currentNodeIds): { mode: "preset" | "partial" | "none"; knownIds: string[]; newIds: string[] }` and a `centroidFor(neighbourPositions)` fallback helper. Pure — no `cytoscape`/DOM imports so it unit-tests in Node.
- [X] T005 Create `src/extension/layoutStore.ts`: thin `workspaceState` (Memento) wrapper over `layoutModel` — `load()`, `save(projectId, positions, viewport, currentNodeIds)`, `clear(projectId)`, `enabled(projectId)`. Uses `context.workspaceState` only; **writes no workspace files** (FR-011).
- [X] T006 [P] Unit-test the layout model in `test/contracts/layout-store.test.ts` (`node:test`): merge+prune, stale/empty-bucket pruning, corrupt/absent/version-mismatch resilience (FR-009), non-finite rejection, `resetEnabled`.
- [X] T007 [P] Unit-test the seeding classifier in `test/contracts/layout-seed.test.ts` (`node:test`): all-known → `preset`, some-new → `partial` with correct `newIds`, none/empty → `none`, centroid fallback for isolated new nodes.

**Checkpoint**: Protocol, pure model + classifier, and storage wrapper exist and are unit-tested. User stories can begin.

---

## Phase 3: User Story 1 - Reopening the map restores my arrangement (Priority: P1) 🎯 MVP

**Goal**: After closing and reopening the Map tab (and after an editor restart), each
node returns to its last-known position and the viewport is restored — no re-scramble.

**Independent Test**: Open the map, note a few node positions, close the Map tab,
reopen it → same positions and same pan/zoom (SC-001, SC-002, FR-002/FR-003).

- [X] T008 [US1] Wire the layout store into the host in `src/extension/extension.ts` and `src/extension/mapPanel.ts`: construct `LayoutStore`; give `MapPanel` a `savedLayoutProvider(activeProjectId)` so `reveal()`/`render()` include `savedPositions`+`savedViewport` for the active project in the `render` message.
- [X] T009 [US1] Handle `persistLayout` in `src/extension/mapPanel.ts` `onMessage` → forward to a host handler in `src/extension/extension.ts` that calls `layoutStore.save(...)`. (Uses current graph node ids for pruning.)
- [X] T010 [US1] Seed Cytoscape in `src/webview/map/main.ts` using `classifySeed` from `src/webview/map/layout.ts`: `preset` layout when saved positions cover all nodes (else `cose`); apply `savedViewport` (pan/zoom) after layout. Replaces the unconditional `cose` on first render (`main.ts:95,115`).
- [X] T011 [US1] Report the settled layout from `src/webview/map/main.ts`: on `layoutstop`, collect node positions + `{pan,zoom}` and post a **debounced** (~200 ms) `persistLayout` (add a small local debounce helper). Tag it with the render's `activeProjectId` (or `"__all__"`).
- [X] T012 [US1] Add deterministic test hooks to `AtlasApi` in `src/extension/extension.ts` (and relay in `src/extension/mapPanel.ts`): `getSavedLayout()` and `simulatePersistLayout(msg)` so integration tests exercise persist/restore without real drag.
- [X] T013 [P] [US1] Integration test `test/integration/layout-restore.test.ts` (`@vscode/test-electron`): render → simulate persist → dispose panel → reopen → assert `render` carries the saved positions/viewport and nodes are restored (no full `cose`); assert store lives in `workspaceState` (survives dispose).

**Checkpoint**: MVP — the reported bug is fixed; reopening restores the arrangement and viewport.

---

## Phase 4: User Story 2 - My manual placement is kept (Priority: P2)

**Goal**: Nodes the user drags stay where they put them across close/reopen and across
incremental updates.

**Independent Test**: Drag two nodes to deliberate spots, close and reopen → both are
where dragged; drag then trigger a spec-save update → dragged node keeps its spot
(SC-005, FR-004).

- [X] T014 [US2] In `src/webview/map/main.ts`, emit a debounced `persistLayout` (incl. viewport) on `dragfree` so manual placement is captured (FR-004), reusing the T011 debounce/report path.
- [X] T015 [US2] Verify/adjust `updateInPlace` in `src/webview/map/main.ts` so an incremental update with an unchanged node set never re-runs layout or resets dragged positions (preserve existing pan/zoom/selection behavior and now node positions too).
- [X] T016 [P] [US2] Integration test `test/integration/layout-drag.test.ts`: simulate a drag report → dispose → reopen keeps dragged positions; a same-node-set incremental update leaves the dragged position unmoved.

**Checkpoint**: US1 + US2 both work independently; hand-placed layouts survive reopen and updates.

---

## Phase 5: User Story 3 - New and removed specs don't scramble what I have (Priority: P3)

**Goal**: As specs are added/removed and projects switched, saved nodes stay put, new
nodes are placed without disturbing them, dead entries are pruned, each project keeps
its own arrangement, and a Reset control provides an escape hatch.

**Independent Test**: With a saved arrangement, add one spec and remove another → saved
nodes unmoved, new node placed, removed node gone; arrange two projects independently;
click Reset → automatic layout re-runs (SC-003, FR-006/FR-007/FR-008/FR-010).

- [X] T017 [US3] Implement the `partial` case in `src/webview/map/main.ts` (using `classifySeed`/`centroidFor` from `src/webview/map/layout.ts`): seed known nodes at saved positions (`preset`) and place only `newIds` — run `cose` constrained to the new nodes (`{ eles }`, `randomize:false`), falling back to neighbour/graph centroid — so zero saved nodes move (FR-006, SC-003).
- [X] T018 [US3] Ensure per-project bucketing + pruning in `src/extension/layoutModel.ts` / `src/extension/layoutStore.ts`: positions keyed by `(projectId, nodeId)` with a `"__all__"` bucket for the all-projects view; prune stale nodeIds and empty buckets on every save (FR-007, FR-008).
- [X] T019 [US3] In `src/webview/map/main.ts`, tag reported positions with each node's `data.projectId` (bucket per project; `"__all__"` when the map shows all projects) and store viewport per project, so switching the active project restores that project's own layout.
- [X] T020 [US3] Add a "Reset layout" control to the controls sidebar (`src/webview/controls/` renderer + `media/controls.css`): a button whose disabled state is driven by a pure `resetEnabled` check; on click it posts `ControlsToHost` `{ type: "resetLayout" }`.
- [X] T021 [US3] Wire reset end-to-end: in `src/extension/extension.ts` handle `resetLayout` → `layoutStore.clear(activeProject)` + `panel` posts `relayout`; add `relayout()` to `src/extension/mapPanel.ts`; in `src/webview/map/main.ts` handle `relayout` → discard seeded positions, run a fresh `cose`, then re-persist via the T011 path (FR-010).
- [X] T022 [P] [US3] Integration test `test/integration/layout-evolve.test.ts`: add a node with no saved position → existing saved nodes unmoved (SC-003); remove a node → its position pruned; two projects keep independent layouts; `resetLayout` clears the bucket and triggers a `relayout`.

**Checkpoint**: All three user stories independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T023 [P] Keep contracts green: confirm `test/contracts/no-telemetry.test.ts` and `test/contracts/panel-csp.test.ts` still pass with the new messages (no new remote sources, no network, CSP/nonce unchanged); extend the protocol/CSP assertion if a new field warrants it.
- [X] T024 [P] Update `CHANGELOG.md` (and a short `README.md` note): layout persists across close/reopen via `workspaceState`, read-only, with a Reset control.
- [X] T025 Verify quality gates & budgets: `npm run lint`, TypeScript `strict` typecheck, and confirm no new runtime dependency and `.vsix`/webview-JS size within budget (compare to T001 baseline).
- [X] T026 Run `specs/006-persist-map-layout/quickstart.md` validation (SC-001…SC-006) and confirm `git status` shows **no** workspace-file writes from the extension (FR-011) and it works offline (FR-012).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none — start immediately.
- **Foundational (Phase 2)**: depends on Setup — **BLOCKS all user stories**. Within it: T002/T003/T004 are independent ([P]); T005 depends on T003; T006 depends on T003; T007 depends on T004.
- **User Stories (Phase 3–5)**: all depend on Foundational. US1 is the MVP; US2 and US3 build on US1's report/persist path.
- **Polish (Phase 6)**: after the desired stories are complete.

### User Story Dependencies

- **US1 (P1)**: needs T002–T005. Establishes the persist/restore round-trip (the report path in T011 is reused by US2/US3).
- **US2 (P2)**: needs US1's report path (T011). Otherwise independent; testable on its own.
- **US3 (P3)**: needs US1's seeding (T010) and report path; adds partial/prune/per-project/reset. Testable on its own.

### Within Each User Story

- Host wiring (extension/mapPanel) before webview seeding where the message shape is shared; tests after the behavior they exercise.
- Tasks touching the same file run sequentially (e.g. T008/T009 both edit `mapPanel.ts`; T010/T011/T014/T015/T017/T019/T021 all edit `map/main.ts`).

### Parallel Opportunities

- Foundational: **T003, T004** in parallel; then **T006, T007** in parallel.
- Each story's integration test (**T013 / T016 / T022**) is its own file → [P] within its phase.
- Polish: **T023, T024** in parallel.
- With multiple developers, US2 and US3 can proceed in parallel once US1's report path (T011) lands.

---

## Parallel Example: Foundational

```bash
# Independent module creation:
Task: "Create pure layout model in src/extension/layoutModel.ts"      # T003
Task: "Create pure seeding classifier in src/webview/map/layout.ts"   # T004

# Then their unit tests in parallel:
Task: "Unit-test the layout model in test/contracts/layout-store.test.ts"   # T006
Task: "Unit-test the seeding classifier in test/contracts/layout-seed.test.ts" # T007
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 Setup → 2. Phase 2 Foundational (T002–T007) → 3. Phase 3 US1 (T008–T013).
4. **STOP and VALIDATE**: close/reopen the Map tab → arrangement + viewport restored.
5. This alone fixes the reported bug and is shippable.

### Incremental Delivery

- Foundational → US1 (MVP, close/reopen restore) → US2 (manual-drag persistence) →
  US3 (evolving specs, per-project, reset). Each story adds value without breaking the
  previous ones.

---

## Notes

- [P] = different files, no incomplete dependencies.
- `src/core/` is intentionally untouched — positions are a shell/rendering concern.
- Persistence uses `workspaceState` only; verify no workspace-file writes (T026).
- Commit after each task or logical group; stop at any checkpoint to validate a story.
