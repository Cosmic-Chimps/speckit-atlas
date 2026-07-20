---

description: "Task list for feature 014 — View Graph JSON"
---

# Tasks: View Graph JSON

**Input**: Design documents from `/specs/014-view-graph-json/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: INCLUDED. The constitution mandates pure-core tests, and the spec defines per-story
Independent Tests + measurable Success Criteria. Pure `graphEnvelope` uses `node:test` (plain
Node); the command is covered by `@vscode/test-electron` integration.

**Organization**: Grouped by user story (US1 P1 → US2 P2). The pure `graphEnvelope` is shared, so
it lives in Foundational; US1 opens the whole-workspace JSON (MVP), US2 adds scope-to-selection.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 / US2 (Setup, Foundational & Polish carry no story label)

## Path Conventions

Single TypeScript project. Source under `src/`, tests under `test/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: None required — no new dependencies, fixtures, or config. Reuses the existing
`fixtures/graph/render-demo` workspace and the 004 query layer.

_(No tasks.)_

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The pure `graphEnvelope` that both user stories consume.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T001 Implement `graphEnvelope(graph, scope?)` in `src/core/query/queries.ts`: `data = getGraph(graph, scope)`; `warnings = "projects" in data ? data.projects.flatMap(p => p.warnings) : data.warnings`; `return toEnvelope("graph", data, warnings)`. Import `toEnvelope` from `./envelope.js`. Pure & total (per data-model.md / contracts/query-graph-envelope.md).
- [x] T002 Export `graphEnvelope` from `src/core/query/index.ts` and re-export from `src/core/index.ts`.
- [x] T003 [P] `node:test` for `graphEnvelope` in `test/core/query.graph-envelope.test.ts`: unscoped whole-workspace envelope (`schemaVersion===1`, `kind==="graph"`); scoped → single `ProjectGraph` in `data` + only that project's warnings; unknown project id → valid empty `ProjectGraph`; empty workspace → valid empty envelope; determinism (two calls deep-equal + JSON-string-equal). (depends on T001)

**Checkpoint**: Pure envelope builder is complete, exported, and green in plain Node.

---

## Phase 3: User Story 1 — Inspect the graph data behind the map (Priority: P1) 🎯 MVP

**Goal**: A palette command opens the current graph as pretty-printed JSON in a new (untitled)
editor tab; nothing is written to the workspace.

**Independent Test**: Run **SpecKit Atlas: View Graph JSON** in a Spec Kit workspace → a new tab
opens with valid, formatted `kind:"graph"` JSON matching the rendered graph; no workspace file
changes.

### Tests for User Story 1 ⚠️

- [x] T004 [P] [US1] Integration test `test/integration/view-graph-json.test.ts` (using `test/integration/harness.ts`), and wire a `view-graph-json` scenario (render-demo target) into `test/integration/suite/index.ts` + `test/integration/runTest.ts`: `getGraphJson()` parses as valid JSON with `schemaVersion:1`/`kind:"graph"`; executing the command opens a document whose `languageId === "json"` and whose text parses; asserts no workspace file is created/modified (read-only).

### Implementation for User Story 1

- [x] T005 [US1] In `src/extension/extension.ts`, add a `viewGraphJson()` handler: build `JSON.stringify(graphEnvelope(graph), null, 2)` (whole workspace for now), `openTextDocument({ content, language: "json" })`, `showTextDocument(doc, { preview: true })`; register the command `speckitAtlas.viewGraphJson`; add `getGraphJson(): string` to the returned API **and** to the `AtlasApi` interface.
- [x] T006 [P] [US1] In `package.json`, add the `speckitAtlas.viewGraphJson` command (title "SpecKit Atlas: View Graph JSON"). Palette-only — no menus, no `activationEvents` change, no `engines` bump (per contracts/command-view-graph-json.md).
- [x] T007 [US1] Update `test/integration/activate.test.ts` E-2: add `speckitAtlas.viewGraphJson` to the contributed-commands deep-equal and to the registered-commands assertions (adding a command otherwise breaks that exact-list check).

**Checkpoint**: US1 is fully functional and independently testable — the MVP (whole-workspace JSON).

---

## Phase 4: User Story 2 — Scope the JSON to what I'm currently viewing (Priority: P2)

**Goal**: The command honors the controls' active project selection — one project when selected,
the whole workspace when "All projects".

**Independent Test**: Select a single project in the controls, run the command → JSON contains
only that project; switch to "All projects", re-run → all projects appear.

### Tests for User Story 2 ⚠️

- [x] T008 [P] [US2] Extend `test/integration/view-graph-json.test.ts`: after `applyControlMessage({ type: "selectProject", projectId })`, `getGraphJson()`'s `data` is that single `ProjectGraph`; after selecting "All projects" (`projectId: null`), `data.projects` covers the workspace (matches rendered scope, SC-003).

### Implementation for User Story 2

- [x] T009 [US2] In `src/extension/extension.ts` `viewGraphJson()` (and the shared `getGraphJson()` builder), derive `scope`: `activeProjectId != null && the graph still contains that project` → `{ projectId: activeProjectId }`, else `undefined` (stale/absent selection → whole workspace, per research R-4). Pass `scope` into `graphEnvelope`.

**Checkpoint**: US1 and US2 both work; the JSON mirrors the on-screen scope.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [x] T010 [P] Run `npm run check:size` (production build + bundle budget) and confirm no new dependency and no `engines.vscode` change were introduced.
- [x] T011 [P] Run `npm test` (core + contracts + cli + mcp + integration) and `npm run lint`; run prettier on the touched files; fix any fallout.
- [x] T012 Execute `specs/014-view-graph-json/quickstart.md` (Extension Development Host command; CLI `graph` parity) and tick the Success-Criteria checklist.
- [x] T013 Add a CHANGELOG entry under `[Unreleased] → Added` for the "View Graph JSON" command (versioning quality gate).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none.
- **Foundational (Phase 2)**: T001 → T002 → T003; **blocks all user stories**.
- **US1 (Phase 3)**: depends on Foundational. MVP.
- **US2 (Phase 4)**: depends on US1 (extends the same command handler + integration test).
- **Polish (Phase 5)**: after US1 (+ US2 if included).

### Within Foundational

- T001 (function) → T002 (exports) → T003 (test).

### User Story Dependencies

- US1 (P1): independent once Foundational is done.
- US2 (P2): builds directly on US1's handler and test file (adds scope).

### Parallel Opportunities

- T003 runs alongside nothing else in Foundational (single new test file), but is [P] vs later phases.
- T004 (integration test) and T006 (package.json) are [P] against T005 (extension.ts) — different files.
- T008 is [P] as a test extension; T010/T011 are [P] build/test/lint checks in Polish.

---

## Parallel Example: User Story 1

```bash
# Different files, no interdependency — can proceed together:
Task: "Integration test in test/integration/view-graph-json.test.ts (+ suite/runTest wiring)"  # T004
Task: "package.json command contribution for speckitAtlas.viewGraphJson"                        # T006
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 2 Foundational (`graphEnvelope` + test green).
2. Phase 3 US1 (palette command opens whole-workspace JSON in a tab).
3. **STOP and VALIDATE**: command opens valid, formatted graph JSON; no workspace write.

### Incremental Delivery

1. Foundation ready (pure `graphEnvelope`).
2. US1 → whole-workspace JSON view → validate (MVP).
3. US2 → scope to the active project selection → validate.

### Notes

- [P] = different files, no incomplete-task dependency.
- Delivery is an **untitled** document — the extension writes no workspace file (Principle III).
- Payload is the existing 004 `kind:"graph"` envelope — same shape as CLI `graph` / MCP `atlas_graph`.
- No `platform`/CLI/MCP/protocol/webview change; no new dependency; no engine bump.
- Commit after each task or logical group.
