---

description: "Task list for feature 013 — Show Specs for File"
---

# Tasks: Show Specs for File

**Input**: Design documents from `/specs/013-show-specs-for-file/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: INCLUDED. The constitution mandates fixture-driven tests for any parsing/model
behavior, and the spec defines per-story Independent Tests + measurable Success Criteria. Pure
core uses `node:test` (plain Node); the command is covered by `@vscode/test-electron` integration.

**Organization**: Grouped by user story (US1 P1 → US2 P2 → US3 P3). The pure lookup is shared, so
it lives in Foundational; each story then adds one surface. US1 is the MVP.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 / US2 / US3 (Setup & Foundational & Polish carry no story label)

## Path Conventions

Single TypeScript project. Source under `src/`, tests under `test/`, fixtures under `fixtures/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Test fixtures the pure-core suite needs.

- [x] T001 [P] Add reverse-lookup fixtures under `fixtures/graph/code-references/specs/` covering: a spec with an **exact** code reference to a file (extend `001-with-code`), a spec referencing only a **folder** (no exact file), a **root-level** file reference (no folder segment), and two specs referencing the **same** file (multi-match ordering). Reuse the existing `002-no-code` fixture for the `specToCode`-off / no-refs case.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The pure reverse-lookup + its types + shared path normalizer. Every user story
(command, map reveal, CLI/MCP) consumes this.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T002 Create `src/core/path.ts` exporting pure `normalizeWorkspacePath(raw)` (backslashes → `/`, trim, strip leading `./`/`../` segments), per data-model.md. No imports.
- [x] T003 Refactor `src/core/graph/heuristics.ts` private `normalizeCodePath` to delegate to `normalizeWorkspacePath` (behavior-preserving; the existing 011 code-reference behavior must be unchanged).
- [x] T004 Extend `src/core/query/types.ts`: add `"file"` to `QueryKind`; add `MatchKind`, `RelatedSpec`, `SpecsForFile`; add `SpecsForFile` to the `QueryResult["data"]` union (see data-model.md).
- [x] T005 Implement `specsForFile(graph, path, scope?)` in `src/core/query/queries.ts`: normalize the path, exact-match against `SpecNode.codeReferences`, folder-fallback **only when no exact match** (guard empty dir), label `matchKind`, order by (matchKind exact→folder, projectId, specId). Reuse the existing `scopedProjects` helper. Pure & total. (depends on T002, T004)
- [x] T006 Add a `case "file"` to `formatText` in `src/core/query/format.ts` rendering `SpecsForFile` (header with match count/kind + one line per related spec, labeled exact/folder). (depends on T004)
- [x] T007 Export `specsForFile`, `SpecsForFile`, `RelatedSpec`, `MatchKind` from `src/core/query/index.ts`, and re-export via `src/core/index.ts` as needed. (depends on T004, T005)
- [x] T008 [P] `node:test` for `specsForFile` in `test/core/query.specs-for-file.test.ts`: exact single/multiple + ordering, folder fallback fires only with zero exact, root-level file → no fallback → empty, empty path → empty, `scope.projectId` isolation (no cross-project conflation), `specToCode`-off node → contributes nothing, determinism (two calls deep-equal). Uses Phase-1 fixtures. (depends on T005)
- [x] T009 [P] `node:test` for the `formatText` `"file"` case in `test/core/query.specs-for-file.test.ts` (or a sibling) — exact-vs-folder rendering snapshot. (depends on T006)
- [x] T010 [P] `node:test` for `normalizeWorkspacePath` + a 011 regression assertion in `test/core/path.test.ts`: `./src/a.ts`, `..\\src\\a.ts`, `src/a.ts` all normalize to `src/a.ts`; confirm existing code-reference extraction output is unchanged. (depends on T002, T003)

**Checkpoint**: Pure core reverse-lookup is complete, exported, and green in plain Node.

---

## Phase 3: User Story 1 — Discover the specs behind a file (Priority: P1) 🎯 MVP

**Goal**: From an open (or right-clicked) source file, run a command and get the related spec(s)
in a quick pick; selecting one opens its `spec.md` read-only.

**Independent Test**: Open a file referenced by a spec, invoke the command, confirm the spec is
listed, select it, confirm `specs/<id>/spec.md` opens. A file no spec references → clean
"no related specs" message.

### Tests for User Story 1 ⚠️

- [x] T011 [P] [US1] Integration test in `test/integration/specs-for-file.test.ts` (using `test/integration/harness.ts`): active file referenced by a spec → the API/command returns the expected matches; single-match resolves directly; unreferenced file → info message, no throw; no active file / non-file target → "open or select a file first"; explorer `uri` (file not open) resolves; asserts no workspace file is written (read-only).

### Implementation for User Story 1

- [x] T012 [US1] In `src/extension/extension.ts`, register `speckitAtlas.showSpecsForFile(uri?)`: resolve target = `uri ?? activeTextEditor.document.uri`; find the owning project (its `projectId` root); compute the file path relative to that root (reuse `openFile`'s path-safety rejection of absolute/root-escaping); call the pure `specsForFile(graph, relPath, { projectId })` over the in-memory `graph`. Handle no-file / no-project / empty-matches / `specToCode`-off-hint messages (FR-014, FR-018, research R-2/R-5).
- [x] T013 [US1] In `src/extension/extension.ts`, build the quick pick from `result.matches` (label = specId, description = title + `· folder` for folder matches) with an **Open spec** action wired to the existing `openSpec(specId, projectId)`; apply the single-match shortcut (FR-013). (depends on T012)
- [x] T014 [P] [US1] In `package.json`, add the `speckitAtlas.showSpecsForFile` command (title "SpecKit Atlas: Show Specs for File") and menu contributions: `commandPalette`, `editor/context`, `explorer/context`, `editor/title` (each `when: resourceScheme == file`), per contracts/command-show-specs-for-file.md. No `activationEvents` change, no `engines` bump.
- [x] T015 [US1] Add `specsForFile(path, projectId?): SpecsForFile` to `AtlasApi` in `src/extension/extension.ts` (mirrors the command's core call) so the integration test can assert results without the quick-pick UI. (depends on T012)

**Checkpoint**: US1 is fully functional and independently testable — the MVP.

---

## Phase 4: User Story 2 — Reveal and focus the file's specs on the map (Priority: P2)

**Goal**: From the same quick pick, "Reveal + focus on map" reveals the map, selects the spec,
and scopes the view to it + one-hop neighbors (feature 010), keeping the sidebar toggle in sync.

**Independent Test**: Invoke the command, choose "Reveal + focus on map"; the panel reveals, the
spec becomes the single selection, focus mode is on, and the controls focus-mode toggle reflects it.

### Tests for User Story 2 ⚠️

- [x] T016 [P] [US2] Extend `test/integration/specs-for-file.test.ts` (or add to `test/integration/selection-focus.test.ts`): "Reveal + focus" reveals the panel, makes the spec the single selection (`getSelection`), enables focus mode, and the emitted controls state reflects `focusMode: true`.

### Implementation for User Story 2

- [x] T017 [US2] In `src/webview/protocol.ts`, add `{ type: "focusMode"; enabled: boolean }` to `HostToControls` (data-model.md); in `src/extension/extension.ts` track a host `focusMode` boolean and emit this echo whenever focus mode changes (from the existing `setFocusMode` control path **and** the new reveal action).
- [x] T018 [US2] In `src/webview/controls/main.ts`, handle the `focusMode` message to reflect the current state on the focus-mode toggle (keep it in sync with programmatic changes). (depends on T017)
- [x] T019 [US2] In `src/extension/extension.ts`, add the **Reveal + focus on map** quick-pick action: `panel.reveal()` → `panel.focus(specId)` → `pushSelection(specId)` → enable focus mode via the shared path (so the T017 echo fires). Reuses 010; no new map/webview code. (depends on T013, T017)

**Checkpoint**: US1 and US2 both work; map reveal composes with the existing selection/focus behavior.

---

## Phase 5: User Story 3 — Reverse lookup from CLI and AI agents (Priority: P3)

**Goal**: `speckit-atlas specs-for-file <path>` and the MCP tool `atlas_specs_for_file` return the
same matches as the editor, in the standard versioned envelope.

**Independent Test**: Run the CLI reverse lookup for a known file on a fixture; the JSON envelope
matches the core result; the MCP tool returns identical data.

### Tests for User Story 3 ⚠️

- [x] T020 [P] [US3] CLI test in `test/cli/cli.test.ts`: `specs-for-file <path>` returns the `kind:"file"` envelope (json), `--format text` snapshot, exit `0` on zero matches, exit `2` on missing `<path>`; parity with the core `specsForFile` result.
- [x] T021 [P] [US3] MCP test in `test/mcp/tools.test.ts`: `atlas_specs_for_file` appears in `list tools` with `required:["path"]`; calling it returns JSON that deep-equals the CLI/core result (SC-003 parity).

### Implementation for User Story 3

- [x] T022 [US3] In `src/platform/runQuery.ts`, add `path?: string` to `RunQueryInput` and a `case "file": toEnvelope("file", specsForFile(graph, input.path ?? "", scope), warnings)`.
- [x] T023 [US3] In `src/cli/main.ts`, add the `specs-for-file <path>` command (map to `kind:"file"`, pass `positionals[1]` as `path`; require `<path>` → exit 2; honor `--root`/`--project`/`--format`); add it to `USAGE`. (depends on T022)
- [x] T024 [US3] In `src/mcp/main.ts`, add the `atlas_specs_for_file` tool to `TOOLS` (`kind:"file"`, `required:["path"]`, `path` + `COMMON`); the shared handler already forwards `args.path`. (depends on T022)

**Checkpoint**: All three surfaces answer the reverse lookup identically.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T025 [P] Run `npm run build` (esbuild) and confirm the bundle builds; confirm no `engines.vscode` bump and no new runtime dependency were introduced.
- [x] T026 [P] Run `npm test` (full core + integration) and lint/format; fix any fallout.
- [x] T027 Execute `specs/013-show-specs-for-file/quickstart.md` end-to-end (CLI, MCP, and the Extension Development Host command across all four menus) and tick the Success-Criteria checklist.
- [x] T028 Add a CHANGELOG entry for the user-visible "Show Specs for File" command (versioning quality gate).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none — start immediately.
- **Foundational (Phase 2)**: depends on fixtures (T001); **blocks all user stories**.
- **US1 (Phase 3)**: depends on Foundational. MVP.
- **US2 (Phase 4)**: depends on Foundational + US1's quick pick (T013) for the reveal action.
- **US3 (Phase 5)**: depends on Foundational only — independent of US1/US2 (headless surfaces).
- **Polish (Phase 6)**: after the desired stories are complete.

### Within Foundational

- T002 → T003 (delegate) and T002 → T005 (query normalizes via it).
- T004 → T005, T006, T007. T005 → T007, T008. T006 → T009. T003 → T010.

### User Story Dependencies

- US1 (P1): independent — the command over the in-memory graph.
- US2 (P2): builds on US1's quick pick; otherwise independent.
- US3 (P3): fully independent of US1/US2 (CLI/MCP via `runQuery`).

### Parallel Opportunities

- T008, T009, T010 (Foundational tests) run in parallel once their targets exist.
- T014 (package.json) is [P] against T012/T013 (extension.ts) — different files.
- US3's T020 and T021 run in parallel; T022 precedes T023/T024.
- If staffed, US1 and US3 can proceed in parallel after Foundational; US2 follows US1.

---

## Parallel Example: Foundational tests

```bash
# After T002–T007 land, run the three pure-core suites together:
Task: "specsForFile tests in test/core/query.specs-for-file.test.ts"   # T008
Task: "formatText 'file' case snapshot in test/core/query.specs-for-file.test.ts"  # T009
Task: "normalizeWorkspacePath + 011 regression in test/core/path.test.ts"  # T010
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 Setup (fixtures) → Phase 2 Foundational (pure `specsForFile` + tests green).
2. Phase 3 US1 (command + quick pick + open spec).
3. **STOP and VALIDATE**: reverse lookup works from the editor; open-spec opens read-only.

### Incremental Delivery

1. Foundation ready (pure core + tests).
2. US1 → editor command MVP → validate.
3. US2 → map reveal + focus → validate.
4. US3 → CLI + MCP parity → validate.

### Notes

- [P] = different files, no incomplete-task dependency.
- Data source is 011 references only — **no git** (research R-2); Read-Only holds throughout.
- The one protocol addition is the `focusMode` host→controls echo (US2); everything else reuses
  existing 004/010/011 surfaces.
- Commit after each task or logical group.
