---
description: "Task list for feature: Modified-files list in the detail panel"
---

# Tasks: Modified-files list in the detail panel

**Input**: Design documents from `/specs/011-modified-files-panel/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/extraction.md, contracts/protocol.md, quickstart.md

**Tests**: INCLUDED. The extractor change is a parsing-heuristic change, which the constitution's
Development Workflow gate requires to ship with fixtures + assertions; the project is fixture/unit-driven.

**Organization**: Grouped by user story. US1 (P1) = see the files; US2 (P2) = open a listed file.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 / US2 for user-story tasks; Setup/Foundational/Polish carry no story label

## Path Conventions

Single-project VS Code extension. Core: `src/core/`; host: `src/extension/`; webview: `src/webview/`;
styles: `media/`; tests: `test/`; fixtures: `fixtures/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the fixture the extractor tests and the panel demo will use.

- [X] T001 [P] Add a code-references fixture at `fixtures/graph/code-references/` — one Spec Kit feature whose `tasks.md` lists source files in real-world forms (backtick-wrapped paths **and** at least one relative markdown link), plus a second feature that references **no** source files; cover the cases in `contracts/extraction.md` (backtick path, relative link, duplicate mention, bare word, non-code extension, un-quoted prose path).
- [X] T002 Document the new fixture (purpose + expected `codeReferences`) in `fixtures/graph/README.md`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The pure data layer both stories read — broadened extraction and the sorted/de-duped
`files` on `CyNodeData`. No user story can display or open files until this is done.

**⚠️ CRITICAL**: Complete before Phase 3.

- [X] T003 Broaden `extractCodeReferences` in `src/core/graph/heuristics.ts` to also capture backtick-wrapped workspace-relative paths (contain `/`, end in an allowed source extension) alongside the existing relative-link form; keep it total and conservative per `contracts/extraction.md` (allow-list: `ts, tsx, js, jsx, mjs, cjs, cs, py, go`; exclude non-code extensions and slash-less tokens).
- [X] T004 Extend extractor unit tests in `test/core/graph.heuristics.test.ts` asserting the `contracts/extraction.md` table: backtick + relative-link forms captured; bare words, non-code extensions, and un-quoted prose paths excluded; duplicates collapse to one entry with `count ≥ 2`; garbage/empty ⇒ `[]` (depends on T001, T003).
- [X] T005 Add a graph-node assertion in `test/core/graph.nodes.test.ts` (or `test/core/graph.test.ts`) that `SpecNode.codeReferences` reflects the broadened extraction for the code fixture and is `[]` for the no-code fixture, when `specToCode` is on (depends on T001, T003).
- [X] T006 [P] In `src/webview/map/elements.ts`: add `files: readonly string[]` to `CyNodeData`, add a pure `sortFilesByName(paths)` helper (de-dupe by full path; sort ascending by basename, case-insensitive, full-path tiebreak; total), and populate `files` in `nodeElement` from `node.codeReferences ?? []`.
- [X] T007 Add unit tests in `test/contracts/elements.test.ts` for `sortFilesByName` and `CyNodeData.files`: de-dupe, case-insensitive basename order, full-path tiebreak, empty⇒empty, and identical output on repeated calls (SC-002) (depends on T006).

**Checkpoint**: Extractor yields the real file set; `CyNodeData.files` arrives sorted & de-duped at the renderer.

---

## Phase 3: User Story 1 - See the files that fulfill a selected spec (Priority: P1) 🎯 MVP

**Goal**: The detail panel shows a name-sorted, de-duplicated Files section for the selected spec,
with an explicit empty state; absent for edge selections.

**Independent Test**: Select a spec with associated files → Files section lists them ascending by
name, no dupes; select a no-code spec → empty state; select an edge → no Files section.

- [X] T008 [US1] Render a **Files** section in `showDetail` in `src/webview/map/main.ts`: a heading, a list built from `data.files` (already sorted/de-duped), and a neutral empty state ("No source files referenced") when `data.files.length === 0`; place it so "Open spec" stays reachable (depends on T006).
- [X] T009 [P] [US1] Add styles for the Files list in `media/` (the panel stylesheet): the list scrolls within the panel and long paths wrap/elide without horizontal overflow (FR edge cases, SC-004).
- [X] T010 [US1] Confirm `showEdgeDetail` in `src/webview/map/main.ts` renders no Files section (edge selection unchanged, FR-005); adjust only if the shared detail root leaks the section (depends on T008).
- [X] T011 [US1] Add integration coverage in `test/integration/render.test.ts` (or a new `detail-files` test) that a spec node's detail shows its files sorted & de-duped, that a no-code spec shows the empty state, and that selecting a different spec refreshes the list (FR-001/002/003/004/005) (depends on T008).

**Checkpoint**: US1 fully functional and testable on its own — the MVP.

---

## Phase 4: User Story 2 - Reach a listed file quickly (Priority: P2)

**Goal**: Each listed file opens read-only when activated; unresolved/unsafe paths warn without
changing anything.

**Independent Test**: With a spec selected, activate a listed file that exists → it opens read-only;
activate one whose path no longer resolves → warning, map/panel unchanged.

- [X] T012 [US2] Add the `openFile` variant `{ type: "openFile"; path: string; projectId: string }` to `PanelToHost` in `src/webview/protocol.ts` (per `contracts/protocol.md`).
- [X] T013 [US2] Make each Files entry in `showDetail` activatable to post `{ type: "openFile", path, projectId: data.projectId }` in `src/webview/map/main.ts` (depends on T008, T012).
- [X] T014 [US2] Relay the `openFile` message to a new `openFile(path, projectId)` host handler in `src/extension/mapPanel.ts`, alongside the existing `openSpec` relay (depends on T012).
- [X] T015 [US2] Implement `openFile(path, projectId)` in `src/extension/extension.ts`: resolve `Uri.joinPath(Uri.parse(projectId), path)`, **reject** absolute paths or paths that escape the root, `stat`-guard, then `showTextDocument(uri, { preview: true })` (read-only); on any failure show a warning and change nothing (mirror `openSpec`) (depends on T012, T014).
- [X] T016 [US2] Add an integration test in `test/integration/` (e.g. `detail-files.test.ts` or extend `render.test.ts`) for the `openFile` round-trip: an existing path opens read-only; a missing/unsafe path warns and performs no write and no navigation (FR-006/006a/007) (depends on T015).

**Checkpoint**: US1 + US2 both work; the list is browsable and each file opens read-only.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Docs, changelog, and end-to-end validation.

- [X] T017 [P] Add a `CHANGELOG.md` entry for the detail-panel modified-files list (user-visible behavior change, per the Versioning gate).
- [X] T018 [P] Add the `011-modified-files-panel` entry to the Features list in `CLAUDE.md` (and `README.md` if it enumerates features), matching the 009/010 entry style.
- [X] T019 Run `quickstart.md` validation: unit + fixture suites green, then the manual E2E table rows 1–8 in the Extension Development Host; confirm no workspace writes and no network activity (Principles III/VI) (depends on all prior tasks).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies — start immediately.
- **Foundational (Phase 2)**: needs the fixture (T001); **blocks** all user stories.
- **US1 (Phase 3)**: depends on Foundational (specifically `CyNodeData.files`, T006).
- **US2 (Phase 4)**: depends on Foundational + US1's rendered list (T008) — you cannot make an
  unrendered list clickable; still independently testable once US1 is in.
- **Polish (Phase 5)**: after the desired stories are complete.

### Within/Across Stories

- Extractor (T003) and elements mapping (T006) are different files → parallelizable.
- US1 rendering (T008) precedes US2 wiring (T013/T015).
- Tests follow the code they cover (fixtures T001 before extractor tests T004/T005).

### Parallel Opportunities

- **Setup**: T001 (fixture) ∥ nothing else — T002 documents it after.
- **Foundational**: T003 (heuristics.ts) ∥ T006 (elements.ts) — different files. Their tests
  (T004/T005 vs T007) follow each.
- **US1**: T009 (CSS in `media/`) ∥ T008 (renderer) — different files.
- **Polish**: T017 (CHANGELOG) ∥ T018 (docs).

---

## Parallel Example: Foundational

```bash
# The two independent data-layer changes can proceed together:
Task: "Broaden extractCodeReferences in src/core/graph/heuristics.ts"        # T003
Task: "Add files field + sortFilesByName in src/webview/map/elements.ts"     # T006
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 Setup (T001–T002) → Phase 2 Foundational (T003–T007).
2. Phase 3 US1 (T008–T011).
3. **STOP and VALIDATE**: select specs and confirm the Files section lists files sorted/deduped
   with a working empty state. This is a shippable MVP (viewing the list) even without click-to-open.

### Incremental Delivery

1. Foundational → data layer ready.
2. US1 → the list renders (MVP). Demo.
3. US2 → files become clickable to open read-only. Demo.
4. Polish → changelog, docs, quickstart validation.

---

## Notes

- [P] = different files, no incomplete dependencies.
- Read-only throughout: the only I/O is `openFile` opening a document in preview mode (T015).
- The extractor stays conservative (list-only, never graph edges); false positives are low-stakes but
  fixtures (T001/T004) lock the recognized/excluded forms.
- `specToCode`/`codeReferences` semantics are unchanged (Decision D2) — the list follows the on-by-
  default "Spec → code layer" toggle; no regression to features 002/004.
- Commit after each task or logical group.
