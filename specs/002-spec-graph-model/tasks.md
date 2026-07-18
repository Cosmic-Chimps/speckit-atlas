---
description: "Task list for Spec-Relationship Graph Model implementation"
---

# Tasks: Spec-Relationship Graph Model

**Input**: Design documents from `/specs/002-spec-graph-model/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: INCLUDED. The constitution mandates a passing CI test gate and fixture-driven
parsing; the contracts define assertable behaviors (G-1…G-14). Test + fixture tasks are
first-class here.

**Organization**: By user story. US1 (definitive graph + wiring) is the MVP; US2 adds
the full tiered/weighted/toggleable heuristics; US3 adds node status/completeness.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallelizable (different files, no dependency on an incomplete task)
- **[Story]**: US1 / US2 / US3 (Setup, Foundational, Polish carry no story label)
- Paths are repo-relative and match `plan.md`. All `core/` code is pure (no vscode/DOM/Node).

---

## Phase 1: Setup

**Purpose**: Directories and test scaffolding for the new pure module.

- [X] T001 Create `src/core/graph/` and `fixtures/graph/` directories
- [X] T002 [P] Add core graph test scaffold `test/core/graph.test.ts` (imports from `../../src/core/index.js`, no cases yet)

**Checkpoint**: module skeleton exists; `npm run test:core` still green.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Types and total function shells every story builds on. Pure `core/` only.

**⚠️ CRITICAL**: No user-story work can begin until this phase is complete.

- [X] T003 Define graph model types (`FeatureInput`, `ProjectSnapshot`, `ArtifactPresence`, `Reference`, `FeatureFacts`, `SpecNode`, `RelationEdge`, `ProjectGraph`, `WorkspaceGraph`, `GraphOptions`) in `src/core/model/types.ts` per data-model.md
- [X] T004 [P] Add `DEFAULT_GRAPH_OPTIONS` (links locked-on, slugMentions on, sharedEntities on, bareNumbers off, specToCode off) in `src/core/graph/options.ts`
- [X] T005 Implement total shells: `parseFeature` (node identity + empty references, never throws) in `src/core/graph/parseFeature.ts` and `buildProjectGraph` (nodes only, no edges, per-project, never throws) in `src/core/graph/buildProjectGraph.ts`
- [X] T006 Implement `buildWorkspaceGraph` (loop snapshots → one `ProjectGraph` each → `WorkspaceGraph`; totality) in `src/core/graph/buildWorkspaceGraph.ts`
- [X] T007 Create `src/core/graph/index.ts` barrel and re-export the graph API from `src/core/index.ts`
- [X] T008 Extend `MapViewModel` + `buildMapViewModel` in `src/core/model/viewModel.ts` to accept an optional `WorkspaceGraph` and place it on `graph` (was always `null`); update core tests that asserted `graph: null`

**Checkpoint**: `npm run test:core` + `typecheck` (incl. `tsconfig.core.json`) green; graph API importable, all shells total.

---

## Phase 3: User Story 1 - Per-project graph with definitive edges (Priority: P1) 🎯 MVP

**Goal**: Build a per-project graph (nodes with titles + definitive link edges) from a
vanilla repo and hand it to `MapViewModel.graph`.

**Independent Test**: Build the model over `fixtures/graph/cross-links/` and assert one
node per feature and exactly the expected definitive edges, no false/cross-project ones.

### Tests for User Story 1

- [X] T009 [P] [US1] Add fixture `fixtures/graph/cross-links/` (≥2 features with relative cross-feature links)
- [X] T010 [P] [US1] Add fixture `fixtures/graph/two-projects/` (two roots both reusing `001-…` and a shared generic entity name)
- [X] T011 [P] [US1] Core tests for definitive edges, per-project scoping, self/collapse, totality, JSON round-trip (G-5, G-10, G-11, G-13, G-14) in `test/core/graph.test.ts`

### Implementation for User Story 1

- [X] T012 [US1] Implement node title extraction (`title` = H1, fallback slug) in `src/core/graph/parseFeature.ts`
- [X] T013 [US1] Implement `link` reference extraction (relative links → `Reference{kind:"link"}`) in `src/core/graph/heuristics.ts` and call it from `parseFeature`
- [X] T014 [US1] Implement link-edge resolution in `src/core/graph/buildProjectGraph.ts`: resolve link refs to in-project features → `definitive` edges; drop cross-project + self; collapse duplicate (source,target)
- [X] T015 [US1] Add `src/extension/projectScan.ts`: enumerate `.specify` roots → per-feature folders → `artifacts` (tree only) + read content files → `ProjectSnapshot[]`; extend `src/extension/workspaceProbe.ts` as needed
- [X] T016 [US1] Wire `src/extension/extension.ts`: scan → `buildWorkspaceGraph` → `buildMapViewModel(results, graph)` → provider, so `MapViewModel.graph` is populated
- [X] T017 [US1] Integration test `test/integration/graph.test.ts`: opening a Spec Kit workspace yields a non-null `MapViewModel.graph` with expected nodes/edges (renderer still shows welcome/empty)

**Checkpoint**: MVP — a real per-project definitive-edge graph reaches the envelope.

---

## Phase 4: User Story 2 - Tiered, weighted, toggleable relationships (Priority: P2)

**Goal**: Add the strong/medium/risky heuristics with weights, evidence, and independent
toggles; edges carry provenance.

**Independent Test**: Against the heuristic fixtures, assert each edge reports its
heuristic/weight, toggling one off removes exactly its edges, and the risky heuristic
produces nothing by default.

**Depends on**: US1 (extends `parseFeature`/`buildProjectGraph` edge machinery).

### Tests for User Story 2

- [X] T018 [P] [US2] Add fixture `fixtures/graph/slug-mentions/` (varying mention counts)
- [X] T019 [P] [US2] Add fixture `fixtures/graph/shared-entities/` (a code-pinned entity shared by 2 features + a bare-name decoy that must NOT connect)
- [X] T020 [P] [US2] Add fixture `fixtures/graph/bare-numbers/` (bare feature numbers in prose)
- [X] T021 [P] [US2] Core tests for strong/medium/risky edges, weights, toggle isolation, ambiguity→warning (G-6, G-7, G-8, G-9, G-12) in `test/core/graph.heuristics.test.ts`

### Implementation for User Story 2

- [X] T022 [US2] Implement `slug-mention` extraction (word-boundary, count-weighted, excluding matches already captured as `link`) in `src/core/graph/heuristics.ts`
- [X] T023 [US2] Implement `shared-entity` extraction restricted to code-pinned entities (`### Name (… path:line …)`); bare-name headings excluded, in `src/core/graph/heuristics.ts`
- [X] T024 [US2] Implement `bare-number` extraction (excludes task ids/line refs; `tier:"risky"`; off by default) in `src/core/graph/heuristics.ts`
- [X] T025 [US2] Apply `GraphOptions` in `src/core/graph/buildProjectGraph.ts`: enable/disable per heuristic (off removes exactly its edges), assign tier/weight, collapse multi-signal pairs to strongest tier + merged evidence, record ambiguous refs as warnings
- [X] T026 [P] [US2] Implement optional `spec-code` reference extraction + `specToCode`-gated surfacing (source-file links, entity code-pins) in `src/core/graph/heuristics.ts` + `buildProjectGraph.ts`
- [X] T027 [US2] Ensure each heuristic's tier/default/toggle/false-positive mode matches `contracts/heuristics.md` (inline doc comments referencing the contract)

**Checkpoint**: US1 + US2 — full tiered/weighted/toggleable edge set with provenance.

---

## Phase 5: User Story 3 - Node status & completeness (Priority: P3)

**Goal**: Per-spec status, task-completion, and artifact completeness — completeness from
the tree alone; robust to messy formatting.

**Independent Test**: Against varied-maturity and messy fixtures, assert correct
completeness (no content read), a task-completion measure, and a usable status value.

**Depends on**: US1 (node/`parseFeature` scaffold).

### Tests for User Story 3

- [X] T028 [P] [US3] Add fixture `fixtures/graph/messy-status/` (trailing whitespace, `Implemented (authored retroactively)`, partial task list)
- [X] T029 [P] [US3] Add fixture `fixtures/graph/malformed/` (thin folder missing artifacts; unparseable content)
- [X] T030 [P] [US3] Core tests for title/status/task-completion/completeness + degradation-with-warnings (G-1, G-2, G-3, G-4) in `test/core/graph.nodes.test.ts`

### Implementation for User Story 3

- [X] T031 [US3] Implement `completeness` (`ArtifactPresence`) derived from `FeatureInput.artifacts` — tree only, zero content reads — in `src/core/graph/parseFeature.ts`
- [X] T032 [US3] Implement `status` extraction (trim, tolerate trailing whitespace + parenthetical notes, preserve raw; absent → null) in `src/core/graph/parseFeature.ts`
- [X] T033 [US3] Implement `taskCompletion` (checked ÷ total checkboxes; no task list → null) in `src/core/graph/parseFeature.ts`
- [X] T034 [US3] Populate `SpecNode` attributes from `FeatureFacts` and attach per-item warnings on parse failure in `src/core/graph/buildProjectGraph.ts`

**Checkpoint**: All three stories functional — nodes carry status/progress/completeness alongside the edge set.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T035 [P] Incremental: cache per-file contents + per-feature `FeatureFacts` in `src/extension/projectScan.ts` (single-file change re-parses one feature, reuses others) + core test `test/core/graph.incremental.test.ts` proving per-feature recompute equals a full rebuild (SC-008)
- [X] T036 [P] Add `fixtures/graph/README.md` recording the expected model per fixture (calibration reference, ties heuristics to the spike findings)
- [X] T037 [P] Update `CHANGELOG.md` (graph model added) and `README.md` (mention the model produced)
- [X] T038 Validate `quickstart.md` steps 1–9 and run the full gate (typecheck, lint, format, test:core, test:contracts, test:integration)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (P1)** → **Foundational (P2, blocks all stories)** → **US1** → US2, US3 → **Polish**.
- **US2** and **US3** both depend on US1's `parseFeature`/`buildProjectGraph` machinery; they are independent of each other and can proceed in parallel after US1.

### User Story Dependencies

- **US1 (P1)**: Foundational only. MVP — definitive graph + adapter wiring.
- **US2 (P2)**: extends US1's edge machinery; independently testable via heuristic fixtures.
- **US3 (P3)**: extends US1's node scaffold; independently testable via status/malformed fixtures (could precede US2).

### Within Each Story

- Fixtures + tests authored alongside implementation; tests FAIL before, PASS after.
- Types (Foundational) before any logic; `parseFeature` reference extraction before `buildProjectGraph` edge resolution.

---

## Parallel Opportunities

- **Setup**: T002 alongside T001.
- **Foundational**: T004 [P]; T003 before T005/T006/T007/T008.
- **US1**: fixtures + tests T009/T010/T011 [P]; then T012→T013→T014 (core) and T015→T016 (adapter) largely sequential per file; T017 after wiring.
- **US2**: fixtures/tests T018/T019/T020/T021 [P]; T026 [P]; T022/T023/T024 edit the same `heuristics.ts` (sequential); T025 after them.
- **US3**: fixtures/tests T028/T029/T030 [P]; T031/T032/T033 edit `parseFeature.ts` (sequential); T034 after.
- **Polish**: T035/T036/T037 [P]; T038 last.

### Parallel Example: User Story 2

```bash
Task: "T018 fixture slug-mentions"
Task: "T019 fixture shared-entities (code-pinned + decoy)"
Task: "T020 fixture bare-numbers"
Task: "T021 heuristic core tests (G-6,G-7,G-8,G-9,G-12)"
```

---

## Implementation Strategy

### MVP First (US1 only)

1. Setup → 2. Foundational → 3. US1 → **STOP & VALIDATE**: `MapViewModel.graph`
   carries a real per-project definitive-edge graph over `fixtures/graph/cross-links`.

### Incremental Delivery

1. Foundational ready. 2. US1 → definitive graph reaches the envelope (demo). 3. US2 →
   full trusted edge set with toggles. 4. US3 → status/progress/completeness on nodes.
5. Polish → incremental caching + calibration doc + gate.

---

## Notes

- [P] = different files, no dependency on an incomplete task.
- Every heuristic change lands with a fixture asserting the resulting model (constitution:
  fixture-driven parsing).
- `core/` stays free of `vscode`/DOM/Node — enforced by `tsconfig.core.json` + the ESLint boundary rule.
- Rendering (003) and agent/CLI/MCP (004) are out of scope; the webview is untouched here.
