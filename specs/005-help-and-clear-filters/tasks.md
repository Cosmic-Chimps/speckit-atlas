---
description: "Task list for Help & Clear Filters implementation"
---

# Tasks: Help & Clear Filters

**Input**: Design documents from `/specs/005-help-and-clear-filters/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: INCLUDED for the pure seam (`help.ts`: content consistency + `hasActiveFilter`),
per the contract (HLP-2…HLP-5, H-4). The webview-visual bits (dim-clear, help open/close) are
manual/quickstart — same disposition as feature 003's filter-highlight.

**Organization**: Everything is in feature 003's controls sidebar. US1 (clear filters) is the
MVP; US2 (help/legend) layers on. No core/model/query/host/protocol changes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallelizable (different files, no dependency on an incomplete task)
- **[Story]**: US1 / US2 (Foundational, Polish carry no label)
- No setup phase needed — reuses the feature-003 controls webview, build, and test scripts.

---

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: The pure, DOM-free module both stories consume.

**⚠️ CRITICAL**: Both user stories depend on this.

- [X] T001 Create pure `src/webview/controls/help.ts` (no DOM/`vscode`/`cytoscape` imports): `HELP_ENTRIES` — the five relationship types (`link`/`slug`/`shared-entity`/`bare-number`/`spec-code`) each with `label`, `tier`, `defaultOn`, plain-language `description`; `ENCODING_NOTES` — node (status, task-completion, warnings) and edge (tier→line-style, weight→thickness, direction vs symmetric); and `hasActiveFilter(tierAll: boolean, statusAll: boolean): boolean`
- [X] T002 Contract test `test/contracts/controls-help.test.ts`: `HELP_ENTRIES` has exactly the five ids with correct tiers + non-empty descriptions (HLP-2/HLP-3); `defaultOn` matches `DEFAULT_GRAPH_OPTIONS` (HLP-4); `ENCODING_NOTES` covers node + edge (HLP-5); `hasActiveFilter` truth table (H-4a/H-4b)

**Checkpoint**: `test:contracts` green; help content proven consistent with the model defaults.

---

## Phase 2: User Story 1 - Clear the filters (Priority: P1) 🎯 MVP

**Goal**: A one-click "Clear filters" that restores full map visibility.

**Independent Test**: Apply tier/status filters (dimming), click "Clear filters" → all dimming
removed and the filter controls reset to "all"; button disabled when nothing is filtered.

- [X] T003 [US1] Add a "Clear filters" `<button>` in `src/webview/controls/main.ts`: on activate, emit the existing `setFilter { filterTier: null, filterStatus: null }` message AND reset the tier checkboxes to all-checked + the status `<select>` to all-selected; enable/disable it via `hasActiveFilter` and refresh that state whenever a tier/status control changes. MUST NOT emit `setOption`/`selectProject`/`focusSpec` (H-2/H-3); keyboard-operable (H-6)
- [X] T004 [P] [US1] Style the "Clear filters" button incl. its disabled state in `media/controls.css`

**Checkpoint**: MVP — filtering is no longer a dead-end; one click restores the full map.

---

## Phase 3: User Story 2 - Help / legend (Priority: P2)

**Goal**: An accessible help section explaining the relationship types and visual encodings.

**Independent Test**: Open help → all five relationship types explained with tiers (bare-number
& spec-code marked off-by-default) + node/edge encodings; dismiss leaves the map unchanged.

**Depends on**: US1 (shares `controls/main.ts` + `controls.css`).

- [X] T005 [US2] Render a collapsible **help** section in `src/webview/controls/main.ts` from `HELP_ENTRIES` + `ENCODING_NOTES` (a disclosure/"What do these mean?" toggle; open/dismiss does not alter the map or other controls; keyboard-operable) (HLP-1/HLP-5/HLP-7)
- [X] T006 [US2] Style the help section (disclosure + entry rows) in `media/controls.css`

**Checkpoint**: US1 + US2 — steerable *and* self-explaining controls.

---

## Phase 4: Polish & Cross-Cutting Concerns

- [X] T007 Run the gate — typecheck, lint, format, `test:core`, `test:contracts`, `build` — and confirm only the controls bundle changed (no core/model/query/host/protocol edits; `.vsix` budget untouched)
- [X] T008 [P] Validate `quickstart.md` manual checks 2–6 in the Extension Development Host (clear-filters resets + disabled state; help lists all five types + encodings; offline; no workspace writes; keyboard-only operation)

---

## Dependencies & Execution Order

- **Foundational (P1)** → **US1** → **US2** → **Polish**.
- **US1** and **US2** both edit `controls/main.ts` and `controls.css`, so their `main.ts`
  edits are sequential (US2 after US1); the CSS edits touch different sections.
- **US2** depends on US1 only for shared-file ordering; functionally it reuses the same
  foundational `help.ts`.

### Within a story

- `help.ts` (Foundational) before any wiring.
- T003 (button) before T005 (help section) — same file.

---

## Parallel Opportunities

- **Foundational**: T002 after T001 (it imports `help.ts`).
- **US1**: T004 [P] (CSS) alongside T003 (main.ts) — different files.
- **US2**: T006 follows T004 (same `controls.css`); T005 follows T003 (same `main.ts`).
- **Polish**: T008 [P]; T007 last.

---

## Implementation Strategy

### MVP First (US1 only)

1. Foundational → 2. US1 → **STOP & VALIDATE**: filtering can be cleared in one click; the
   button disables when nothing is filtered.

### Incremental Delivery

1. Foundational (`help.ts` + test). 2. US1 → clear filters (demo). 3. US2 → help/legend.
4. Polish → gate + manual validation.

---

## Notes

- [P] = different files, no dependency on an incomplete task.
- Reuses feature 003's `setFilter(null, null)` path — no new protocol/host/panel code.
- `help.ts` stays pure (no DOM/`vscode`/`cytoscape`) so content consistency (FR-008) and the
  clear-button logic are asserted in plain Node.
- Offline, read-only, telemetry-free; no new dependency; no `.vsix` bundle-size impact.
