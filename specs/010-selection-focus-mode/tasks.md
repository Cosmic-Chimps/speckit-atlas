---
description: "Task list for Selection & Focus Mode"
---

# Tasks: Selection & Focus Mode

**Input**: Design documents from `/specs/010-selection-focus-mode/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/protocol.md, quickstart.md

**Tests**: INCLUDED — the plan (research D8) and the constitution's fixture-driven /
two-tier testing gate require a pure unit suite plus a `@vscode/test-electron` integration
suite for any webview behavior change.

**Organization**: Grouped by user story. US1 (P1, the selection bug fix) is the MVP and is
fully independent. US2 (P2, focus mode) builds on the single-selection state introduced in
US1 but is independently testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1 / US2 (setup, foundational, polish carry no story label)

## Path Conventions

VS Code extension layout (per plan.md): pure `src/core/` (untouched), `src/extension/`
adapters, `src/webview/` renderer; tests under `test/contracts/` (plain Node) and
`test/integration/` (electron).

---

## Phase 1: Setup

**Purpose**: Establish a green baseline so regressions are attributable to this feature.

- [X] T001 Confirm baseline is green before any change: run `npm run build`, the pure suite, and `npm run test:integration`; note current pass counts for the `render`, `layout-*`, and `controls-help` suites.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared prerequisites for the user stories.

No new shared infrastructure is required — this feature builds entirely on the existing
`003-graph-rendering` map webview, `005`/`006` controls, and the established two-tier test
harness. Proceed directly to Phase 3.

**Checkpoint**: Existing build/test infra suffices; user-story work can begin.

---

## Phase 3: User Story 1 - Single active selection (Priority: P1) 🎯 MVP

**Goal**: Selecting a spec (from the SPECS list or a map node) replaces any prior
selection, so exactly one node is highlighted at any moment — no accumulating blue borders.

**Independent Test**: Open the map, click three different specs in the SPECS list in
sequence; confirm only the last-clicked node carries the selection highlight. Click empty
space; confirm the selection clears.

### Tests for User Story 1 ⚠️ (write first, ensure they FAIL before implementation)

- [X] T002 [P] [US1] Create integration test `test/integration/selection-focus.test.ts` covering the single-selection invariant: sequential SPECS-list `focus` messages leave exactly one `:selected` node (SC-001, US1-1); a subsequent map-node tap supersedes it (US1-2); a background tap clears it (US1-3); and an incremental update preserves the single selection without adding highlights (US1-4). Drive the panel via the `test/integration/harness.ts` + `layoutApi.ts` pattern.

### Implementation for User Story 1

- [X] T003 [US1] In `src/webview/map/main.ts`, fix `focus(nodeId)` to `cy.$(":selected").unselect()` before `n.select()` so programmatic selection from the SPECS list replaces the prior selection (research D1, FR-001).
- [X] T004 [US1] In `src/webview/map/main.ts`, introduce module-level `selectedNodeId: string | null`; set it in `focus()` and in the node-`tap` handler, and clear it in the background-`tap` handler (research D2, FR-002/FR-003).
- [X] T005 [US1] In `src/webview/map/main.ts`, update `updateInPlace` so it re-selects only the single preserved id and, when that id is no longer present, nulls `selectedNodeId` (FR-009, US1-4; groundwork for the US2 "removed selection" edge case).

**Checkpoint**: US1 is fully functional and testable — exactly one spec is ever highlighted.

---

## Phase 4: User Story 2 - Focus on selection's neighborhood (Priority: P2)

**Goal**: A sidebar "Focus on selection" toggle scopes the map to the selected spec, its
one-hop neighbors, and the edges induced among that set; toggling off (or clearing the
selection) restores the full graph. Composes with the tier/status dimming filter.

**Independent Test**: Select a spec with neighbors, enable focus → only that spec, its
direct neighbors, and their interconnecting edges are shown; toggle off → full graph
returns with unchanged layout.

### Tests for User Story 2 ⚠️ (write first, ensure they FAIL before implementation)

- [X] T006 [P] [US2] Create pure unit test `test/contracts/focus-set.test.ts` for `computeFocusVisible(adjacency, selectedId)` (node:test, mirroring `layout-seed.test.ts`): closed one-hop membership incl. neighbor↔neighbor via induced edges (FR-005); isolated node → just itself; `selectedId` null or absent → `showAll: true` (data-model.md rules).
- [X] T007 [P] [US2] Extend `test/integration/selection-focus.test.ts` with focus-mode cases: enabling focus hides non-neighbors and shows the induced subgraph (SC-002/SC-003, US2-1); selecting a different spec re-scopes (US2-2); toggling off restores the full graph with identical node positions (SC-003, US2-3); focus composes with an active tier/status filter without either resetting the other (SC-004, US2-5); a re-parse that removes the selected spec falls back to the full graph (US2 edge case).

### Implementation for User Story 2

- [X] T008 [P] [US2] In `src/webview/protocol.ts`, add `ControlsToHost` variant `{ type: "setFocusMode"; enabled: boolean }` and `HostToPanel` variant `{ type: "focusMode"; enabled: boolean }` (contracts/protocol.md; additive, back-compatible).
- [X] T009 [P] [US2] Create pure helper `src/webview/map/focus.ts` exporting `computeFocusVisible(adjacency, selectedId)` returning `{ nodes, showAll }` — no `vscode`/DOM imports (data-model.md, Principle I).
- [X] T010 [P] [US2] In `src/extension/mapPanel.ts`, add `setFocusMode(enabled: boolean)` that posts `{ type: "focusMode", enabled }` (depends on T008).
- [X] T011 [US2] In `src/extension/extension.ts` `onControlMessage`, add a `setFocusMode` case that calls `panel.setFocusMode(msg.enabled)`, mirroring the `focusSpec` relay (depends on T008, T010).
- [X] T012 [P] [US2] In `src/webview/controls/main.ts`, add a "Focus on selection" checkbox in a new **VIEW** section (default off) that emits `{ type: "setFocusMode", enabled }` on change (research D7; depends on T008).
- [X] T013 [US2] In `src/webview/map/main.ts`, add `focusModeOn` state, handle the `focusMode` message, and implement `applyFocus()`: build an undirected adjacency from current edges, call `computeFocusVisible`, then `show()` the visible nodes + induced edges (`nodes.edgesWith(nodes)`) and `hide()` the rest — leaving the `.dimmed` class untouched; on `showAll`, `cy.elements().show()`. Call `applyFocus()` after `focus()`, node tap, background tap, and at the end of `updateInPlace` (research D3/D4/D5; depends on T009 and US1 selection state from T004/T005).

**Checkpoint**: US1 and US2 both work independently; focus and the dimming filter compose.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [X] T014 [P] Run `specs/010-selection-focus-mode/quickstart.md` manual validation in the Extension Development Host (US1 steps 2–4, US2 steps 5–9).
- [X] T015 [P] Confirm no regressions: `render`, `layout-drag`, `layout-restore`, `layout-evolve`, `controls-help`, `no-telemetry`, and `offline-readonly` suites still pass (Principles I/III/VI unaffected).
- [X] T016 Add a CHANGELOG entry for the user-visible behavior change (single-selection fix + focus-mode toggle), per the constitution's versioning gate.

---

## Phase 6: Post-review Refinements (FR-011 / FR-012)

**Purpose**: Address user feedback after the first working build — the SPECS list did not
keep the clicked spec visibly selected, and the number of related specs was not shown.
Delivered as a host-as-source-of-truth selection echo (both tasks landed together).

- [X] T017 [US1] Echo the selection from the host to the SPECS list so the selected row stays highlighted and stays in sync with map-node clicks, persisting across control re-renders (FR-011, SC-006). Adds a `selection` `HostToControls` message (`src/webview/protocol.ts`), `ControlsViewProvider.setSelection` + re-push on `ready` (`src/extension/controlsView.ts`), host-side `selectedSpecId`/`pushSelection` wired into the `focusSpec` + `selectNode` paths and re-echoed after refresh/rebuild (`src/extension/extension.ts`), and `applySelectionHighlight` + `data-spec-id` rows in `src/webview/controls/main.ts`; row styling in `media/controls.css`.
- [X] T018 [US1] Show the related-spec count for the selection in the list (FR-012, SC-006): host `relatedCountFor(nodeId)` counts distinct direct neighbors in the current graph and sends it with the `selection` message; the controls webview renders it as a "N related" badge on the selected row (`src/webview/controls/main.ts`, `media/controls.css`).
- [X] T019 [P] Extend `test/integration/selection-focus.test.ts` with the selection-echo cases (SF-5: related count for a hub vs. a leaf; SF-6: selection persists across an incremental re-parse and clears if the spec is gone) via a new `getSelection()` API seam; update the CHANGELOG.

**Checkpoint**: Selecting a spec (from the list or the map) highlights and keeps its row
selected in the sidebar and shows how many specs relate to it.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none — start immediately.
- **Foundational (Phase 2)**: empty (no new shared infra).
- **US1 (Phase 3)**: independent MVP; only touches `src/webview/map/main.ts` + its test.
- **US2 (Phase 4)**: reuses US1's `selectedNodeId` state (T013 depends on T004/T005) but is
  otherwise self-contained; other US2 tasks depend only on the protocol addition (T008).
- **Polish (Phase 5)**: after the desired stories are complete.

### User Story Dependencies

- **US1 (P1)**: no dependency on other stories.
- **US2 (P2)**: builds on US1's single-selection state; test T007 extends the file created
  by T002, so US1 test scaffolding lands first.

### Within Each Story

- Write the test task(s) first and confirm they fail, then implement.
- US1: T003 → T004 → T005 (same file, sequential).
- US2: T008 & T009 first (parallel) → T010/T012 (parallel) → T011 → T013 (convergence).

### Parallel Opportunities

- **US1**: T002 (test) can be authored while reading the code; implementation T003–T005 are
  sequential (same file).
- **US2**: T006 and T007 (tests, different files) run in parallel; T008 and T009 in
  parallel; then T010 and T012 in parallel; T011 after T010; T013 last.
- **Polish**: T014 and T015 in parallel.

---

## Parallel Example: User Story 2

```bash
# Tests (different files) together:
Task: "Unit test computeFocusVisible in test/contracts/focus-set.test.ts"
Task: "Extend focus cases in test/integration/selection-focus.test.ts"

# After T008 (protocol), independent files together:
Task: "computeFocusVisible in src/webview/map/focus.ts"
Task: "MapPanel.setFocusMode in src/extension/mapPanel.ts"
Task: "Focus toggle in src/webview/controls/main.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 baseline → 2. US1 (T002–T005) → 3. **STOP & VALIDATE** single-selection via
   quickstart US1 steps → ship the bug fix on its own if desired.

### Incremental Delivery

1. US1 (single-selection fix) → validate → demo (MVP).
2. US2 (focus mode) → validate → demo.
3. Polish (quickstart + regression + CHANGELOG).

---

## Notes

- No `src/core/` file is touched (Principle I). No workspace write (Principle III). No
  network / telemetry / new dependency (Principle VI).
- Focus uses Cytoscape `show()/hide()` (display), which preserves positions from
  `006-persist-map-layout`; the dimming filter from `005-help-and-clear-filters` uses
  opacity — the two layers compose without either clobbering the other.
- Commit after each task or logical group; verify tests fail before implementing.
