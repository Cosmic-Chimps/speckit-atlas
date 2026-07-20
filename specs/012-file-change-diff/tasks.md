---
description: "Task list for feature: See what changed to fulfill a spec (before/after diff)"
---

# Tasks: See what changed to fulfill a spec (before/after diff)

**Input**: Design documents from `/specs/012-file-change-diff/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/attribution.md, contracts/protocol.md, quickstart.md

**Tests**: INCLUDED. Attribution is a risky heuristic (Principle II) and the git adapter has real
failure modes; the plan/quickstart specify pure + integration coverage.

**Organization**: Grouped by user story. US1 (P1) = per-file "Open changes"; US2 (P2) = spec-wide "See all changes".

## Format: `[ID] [P?] [Story] Description`

- **[P]**: different files, no dependency on incomplete tasks
- **[Story]**: US1 / US2 for user-story tasks; Setup/Foundational/Polish carry no story label

## Path Conventions

Single-project VS Code extension. Host/I/O: `src/extension/`; webview: `src/webview/`; styles: `media/`;
tests: `test/`. Git access is confined to `src/extension/gitChanges.ts`; decision logic to the pure
`src/extension/attribution.ts`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Configuration and vendored types the git adapter needs.

- [X] T001 [P] Add `contributes.configuration` setting `speckitAtlas.diff.attribution` (enum `auto`|`branch`|`range`|`off`, default `auto`) to `package.json` (the FR-006 toggle; see `contracts/protocol.md`).
- [X] T002 [P] Vendor the VS Code Git extension API declarations as `src/extension/git.d.ts` (types only, no runtime code) — the surface used by the adapter (`GitExtension`, `API`, `Repository`, `getMergeBase`, `log`, `diffBetween`/`diffWith`).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Settle the git-access mechanism (the spike) and build the shared, read-only basis-resolution
layer both stories call. No diff can open until this is done.

**⚠️ CRITICAL**: Complete before Phase 3. The spike (T003) gates the adapter.

- [X] T003 SPIKE (research D1): confirm the built-in Git API at `engines.vscode ^1.101.0` provides `getMergeBase`, path-filtered first-commit `log`, `diffBetween`/`diffWith`, and an openable `git:` diff URI (or `Repository.show` + read-only virtual doc). Record the resolved mechanism (API, or the narrow read-only `git` CLI fallback per query) in a header comment in `src/extension/gitChanges.ts`.
- [X] T004 [P] Implement the pure, `vscode`-free `src/extension/attribution.ts`: `AttributionBasis` type, `candidateBranchName(folderId)`, and `chooseBasis(facts)` exactly per `contracts/attribution.md` (branch → range → none; `off`; deterministic; total).
- [X] T005 Add pure unit tests `test/contracts/attribution.test.ts` covering the `contracts/attribution.md` table (branch present; branch-gone→range; nothing resolvable; forced range/branch; off; branch-name derivation incl. timestamp scheme) (depends on T004).
- [X] T006 Implement the shared core of `src/extension/gitChanges.ts` (read-only): resolve the repository for a project root via the Git API; accept the `speckitAtlas.diff.attribution` setting value; gather facts (`folderBranchExists`, `branchBaseRef` via merge-base, `firstCommitParentRef` via first-commit-touching `specs/<id>/`); call `chooseBasis` → resolved `AttributionBasis`; expose an "unavailable" result when the Git extension/repo is absent. No write/network git calls (depends on T002, T003, T004).

**Checkpoint**: Given a spec + project root, the adapter resolves a stated attribution basis (or a clean "unavailable"/"none").

---

## Phase 3: User Story 1 - Open a listed file's changes (Priority: P1) 🎯 MVP

**Goal**: Each file in the 011 Files list gains an "Open changes" action that opens that file's
before/after diff in the editor, with the basis/baseline stated.

**Independent Test**: With a spec selected, "Open changes" on a changed file opens its diff; on an
unchanged file shows "no changes"; on a non-git workspace shows "unavailable" — map + Files list intact.

- [X] T007 [US1] In `src/extension/gitChanges.ts`, add `openFileDiff(nodeId, path, projectId, setting)`: using the resolved basis, if the file changed between `basis.beforeRef` and current, open `vscode.diff(beforeUri, afterUri, title)` with a title stating basis + baseline (FR-001/007/008); else show an info message; unavailable/none → info message, no change (FR-004) (depends on T006).
- [X] T008 [US1] Add the `openFileDiff` variant `{ type, path, projectId, nodeId }` to `PanelToHost` in `src/webview/protocol.ts` (per `contracts/protocol.md`).
- [X] T009 [US1] In `src/webview/map/main.ts`, add an **"Open changes"** affordance to each Files entry in `showDetail` that posts `{ type: "openFileDiff", path, projectId, nodeId }`; spec-selection only (not edges, FR-009) (depends on T008).
- [X] T010 [US1] Relay `openFileDiff` to a host handler in `src/extension/mapPanel.ts` (alongside `openFile`) (depends on T008).
- [X] T011 [US1] In `src/extension/extension.ts`, implement the `openFileDiff` handler via `gitChanges` (read the setting; pass to adapter), wire it into the `MapPanel` handlers and the `AtlasApi` (for tests) (depends on T007, T010).
- [X] T012 [P] [US1] Style the "Open changes" affordance in `media/map.css` (compact, aligned with the file link; keeps the list readable).
- [X] T013 [US1] Integration test `test/integration/git-changes.test.ts`: build a temp git repo (main + spec folder + feature branch with edits); assert `openFileDiff` opens a diff for a changed file, an info message for an unchanged file, and "unavailable" with no throw when there is no repo; assert workspace + git state unchanged after (FR-001/002/004; SC-001/003/005) (depends on T011).

**Checkpoint**: US1 fully functional and testable — the MVP (per-file diffs), independent of US2.

---

## Phase 4: User Story 2 - See everything that changed to fulfill a spec (Priority: P2)

**Goal**: A "See all changes" action opens the editor's native multi-file diff for every file attributed
to the spec, with the basis stated; degrades to a clear message when indeterminate.

**Independent Test**: On a spec with attributable history, "See all changes" opens a multi-diff listing
the changed files (name-sorted); on a merged/deleted-branch spec it falls back to range or states
"couldn't determine"; `attribution: "off"` disables it.

- [X] T014 [US2] In `src/extension/gitChanges.ts`, add `showChangeset(nodeId, projectId, setting)`: list changed files in the range (name-sorted, per-file `changeKind`) and open `vscode.commands.executeCommand("vscode.changes", title, resources)`; state the basis in the title + an info message (FR-005/007); `none`/empty → info message offering the per-file fallback (FR-006/010) (depends on T006).
- [X] T015 [US2] Add the `showChangeset` variant `{ type, nodeId, projectId }` to `PanelToHost` in `src/webview/protocol.ts` (depends on T008 — same file as US1's protocol edit).
- [X] T016 [US2] In `src/webview/map/main.ts`, add a spec-level **"See all changes"** action in `showDetail` that posts `{ type: "showChangeset", nodeId, projectId }`; spec-selection only (FR-009) (depends on T009, T015).
- [X] T017 [US2] Relay `showChangeset` to a host handler in `src/extension/mapPanel.ts` (depends on T015).
- [X] T018 [US2] In `src/extension/extension.ts`, implement the `showChangeset` handler via `gitChanges`, wire into `MapPanel` handlers and `AtlasApi` (depends on T014, T017).
- [X] T019 [US2] Extend `test/integration/git-changes.test.ts`: `showChangeset` opens the multi-diff with the expected name-sorted files and a stated basis; deleting the feature branch flips the basis to range; `attribution: "off"` disables the changeset (per-file diff still works); read-only after (FR-005/006/007; SC-002/003/005) (depends on T018).

**Checkpoint**: US1 + US2 both work; per-file and spec-wide diffs available, both read-only.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Docs, changelog, end-to-end validation.

- [X] T020 [P] Add a `CHANGELOG.md` [Unreleased] entry for the before/after diff feature (user-visible change; note it introduces read-only git reads).
- [X] T021 [P] Add the `012-file-change-diff` entry to the Features list in `CLAUDE.md`, matching the 011 entry style (note: first feature to read VCS; read-only/offline).
- [X] T022 Run `quickstart.md` validation: spike resolved (API vs CLI fallback recorded); pure + integration suites green; manual E2E table; confirm no workspace writes, no git mutation, no network, and that `media/map.js` still passes the no-network/telemetry contract scan (depends on all prior tasks).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies — start immediately.
- **Foundational (Phase 2)**: the spike (T003) gates the adapter core (T006); **blocks** all user stories.
- **US1 (Phase 3)**: depends on Foundational (basis resolution, T006).
- **US2 (Phase 4)**: depends on Foundational + US1's plumbing (it extends the same protocol/mapPanel/
  extension/main/gitChanges files, and reuses US1's per-file diff as its documented fallback). Still
  independently testable once complete.
- **Polish (Phase 5)**: after the desired stories.

### Same-file sequencing (not parallel)

- `protocol.ts` — T008 (US1) before T015 (US2).
- `map/main.ts` — T009 (US1) before T016 (US2).
- `mapPanel.ts` — T010 (US1) before T017 (US2).
- `extension.ts` — T011 (US1) before T018 (US2).
- `gitChanges.ts` — T006 → T007 (US1) → T014 (US2).

### Parallel Opportunities

- **Setup**: T001 (package.json) ∥ T002 (git.d.ts).
- **Foundational**: T004 (attribution.ts) ∥ T002 done; T005 tests follow T004. T006 waits on the spike.
- **US1**: T012 (CSS) ∥ the plumbing tasks (different file).
- **Polish**: T020 (CHANGELOG) ∥ T021 (CLAUDE.md).

---

## Parallel Example: Foundational

```bash
Task: "Implement pure attribution.ts (candidateBranchName + chooseBasis)"   # T004
Task: "Vendor git.d.ts type declarations"                                    # T002 (if not already done)
# T003 spike runs first/around these; T006 (adapter core) waits on T003 + T004.
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Setup (T001–T002) → Foundational (T003–T006), spike first.
2. US1 (T007–T013).
3. **STOP and VALIDATE**: per-file "Open changes" opens diffs with a stated basis, degrades cleanly.
   Shippable MVP without the spec-wide changeset.

### Incremental Delivery

1. Foundational → basis resolution ready.
2. US1 → per-file diffs (MVP). Demo.
3. US2 → spec-wide native multi-diff. Demo.
4. Polish → changelog, docs, quickstart validation.

---

## Notes

- [P] = different files, no incomplete dependency.
- **Read-only, offline throughout**: the adapter calls only read APIs and opens read-only diff views;
  never a write/network git op (assert in T013/T019/T022).
- The spike (T003) is the load-bearing risk — do it before building the adapter so the API-vs-CLI choice
  is settled once.
- Attribution never fabricates: indeterminate → "couldn't determine" + per-file fallback (US1).
- Commit after each task or logical group.
