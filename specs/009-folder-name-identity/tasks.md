---
description: "Task list for feature 009 — Folder-Name Identity for Relationships"
---

# Tasks: Folder-Name Identity for Relationships

**Input**: Design documents from `/specs/009-folder-name-identity/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/heuristics.md

**Tests**: Included — the constitution mandates **fixture-driven** heuristics changes (every
heuristic change ships a fixture) plus `node:test` unit coverage. Pure-core tests live under
`test/core/`; existing sequential fixtures are the regression guards.

**Organization**: Grouped by user story (US1 P1 → US2 P2 → US3 P3). The mechanism is shared
(Foundational); each story is a fixture + assertion increment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 / US2 / US3 (setup, foundational, polish have no story label)
- Exact file paths are included in each task.

## Path Conventions

Change is confined to pure `src/core/graph` + one field in `src/core/model/types.ts` +
`fixtures/graph/*` + `test/core/*`. `nodeScan`/`projectScan` (number derivation) and all
shells/renderer/query/CLI/MCP are **not** modified.

---

## Phase 1: Setup

**Purpose**: Confirm a clean baseline before touching the core matcher.

- [X] T001 Confirm baseline green: run `npm run build` and `npm test`; note the current edge counts for the `slug-mentions` and `cross-links` fixtures (the regression baseline for T012). No code changes.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The folder-name-identity mechanism every user story exercises — all in pure
`core/graph`. Resolution is already sibling-based; this changes only extraction/matching.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 [P] Add `mentionText: string` to `FeatureFacts` in `src/core/model/types.ts` (transient, carries the feature's concatenated scannable text for sibling-aware matching).
- [X] T003 Broaden `extractLinks` in `src/core/graph/heuristics.ts` to emit a **candidate per path segment** of a relative markdown link (each folder-name-shaped component), replacing the `NNN-slug`-only `LINK_RE`. Non-feature segments (`specs`, `src`, file names) are simply unresolved later. Total; never throws (H-1/H-2/H-8).
- [X] T004 Add `matchSiblingMentions(text, siblingIds, selfId): { id: string; count: number }[]` to `src/core/graph/heuristics.ts`: build one **longest-first alternation** regex from the escaped sibling ids with `[A-Za-z0-9-]` word/hyphen boundaries, scan `text` once, tally whole-word matches per id, exclude `selfId`. Remove the old `NNN-slug` `SLUG_TOKEN_RE`. Keep `NUMBER_RE`/`ENTITY_RE`/`CODE_LINK_RE` unchanged (H-3/H-4/H-5/H-9).
- [X] T005 Update `src/core/graph/parseFeature.ts`: set `mentionText` to the concatenated `allText` it already builds; stop adding `slug` references (slug edges now come from `matchSiblingMentions`); keep links (via broadened `extractLinks`), bare-numbers, entities, code.
- [X] T006 Update `src/core/graph/buildProjectGraph.ts`: after computing `idSet`, for each feature call `matchSiblingMentions(f.mentionText, idSet, f.id)` and add `strong` `slug-mention` edges weighted by count (via the existing `addEdge`). Link resolution (`resolvable`) and all other tiers unchanged.
- [X] T007 Unit-test the pure changes in `test/core/graph.heuristics.test.ts`: `matchSiblingMentions` (whole-word only — `fleet-safety` not matched inside `fleet-safety-audit`; longest-first; self excluded; non-sibling token → 0); broadened `extractLinks` (captures the feature segment at any nesting depth; non-feature segments ignored after resolution); `extractBareNumbers` still 3-digit.

**Checkpoint**: The mechanism works and is unit-tested; the graph now identifies targets by folder name.

---

## Phase 3: User Story 1 - Relationships form regardless of numbering scheme (Priority: P1) 🎯 MVP

**Goal**: A timestamp-numbered repo forms the same definitive/strong edges a sequential repo
would.

**Independent Test**: Build the model over a timestamp fixture where specs reference each
other; assert the link + slug-mention edges are present and equivalent to the sequential
case (SC-001, FR-002/FR-003).

- [X] T008 [P] [US1] Add fixture `fixtures/graph/timestamp-numbering/` (mirroring an existing fixture's layout) with ≥ 2 `YYYYMMDD-HHMMSS-slug` feature folders that (a) relative-link into each other and (b) name each other in prose.
- [X] T009 [US1] Add `test/core/graph.identity.test.ts`: build the graph over the timestamp fixture (via the pure pipeline `buildWorkspaceGraph`/`buildProjectGraph`); assert a definitive `link` edge and a `strong` count-weighted `slug-mention` edge form between the timestamp features (SC-001).

**Checkpoint**: MVP — the reported gap is fixed; timestamp repos connect.

---

## Phase 4: User Story 2 - Mixed and unnumbered schemes connect (Priority: P2)

**Goal**: Sequential + timestamp + unnumbered folders cross-reference and connect; unnumbered
folders participate in link/name edges.

**Independent Test**: Build over a mixed fixture with cross-references; assert edges form
across schemes and unnumbered folders take part (SC-002, FR-007).

- [X] T010 [P] [US2] Add fixture `fixtures/graph/mixed-schemes/` with a sequential `NNN-` folder, a timestamp folder, and an unnumbered/preset folder that cross-reference (link + name) one another.
- [X] T011 [US2] Extend `test/core/graph.identity.test.ts`: assert edges form across sequential ↔ timestamp ↔ unnumbered, and that the unnumbered folder participates in a link edge and a name-mention edge (SC-002).

**Checkpoint**: US1 + US2 — every scheme, including mixed repos, connects.

---

## Phase 5: User Story 3 - No regressions and no runaway false edges (Priority: P3)

**Goal**: Sequential repos unchanged; matching only real siblings; bare-number scoped to
numbered features.

**Independent Test**: Re-run existing sequential fixtures for identical edges; assert
non-sibling tokens produce no edge; assert bare-number only involves numbered features
(SC-003/SC-004/SC-005, FR-006/FR-008).

- [X] T012 [US3] Regression assertion in `test/core/graph.identity.test.ts` (or confirm in the existing `test/core/graph.test.ts`): the `slug-mentions` and `cross-links` fixtures produce **edge sets identical to the T001 baseline** (byte-identical after the change) (SC-003/FR-008).
- [X] T013 [US3] Precision + bare-number scope in `test/core/graph.identity.test.ts`: a token that is not a real sibling name yields **zero** slug edges; a whole-word mention of a common-word real sibling yields a weak (count-1) edge (FR-004); a timestamp/unnumbered feature produces no `bare-number` candidate and never throws (SC-004/SC-005/FR-006).

**Checkpoint**: All three stories functional; existing behavior preserved.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T014 Run the full suite (`npm run test:core`, `test:contracts`, `test:cli`, `test:mcp`, `test:integration`) and confirm the downstream layers (render map, CLI/MCP envelopes) are **unaffected** — they consume the same model.
- [X] T015 [P] Update `CHANGELOG.md` (and a note in `README.md`/`specs/002-spec-graph-model` if useful): relationship detection is now folder-name-based, so it works with timestamp/unnumbered/preset numbering; sequential repos are unchanged; safe to switch `.specify/init-options.json` to `"timestamp"`.
- [X] T016 Run `specs/009-folder-name-identity/quickstart.md` validation, including the optional real-world check (set `feature_numbering` to `"timestamp"`, add two cross-referencing features, confirm they connect on the map).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 (captures the regression baseline).
- **Foundational (Phase 2)**: after Setup — **BLOCKS all user stories**. Order: T002 ∥ T003 → T004 (same file as T003) → T005 (needs T002+T003) → T006 (needs T004+T005) → T007.
- **User Stories (Phase 3–5)**: all depend on Foundational. Each is a fixture + assertion increment; US2/US3 extend the same `graph.identity.test.ts` as US1, so run their test tasks in order.
- **Polish (Phase 6)**: after the desired stories.

### User Story Dependencies

- **US1 (P1)**: needs T002–T006 (the mechanism). Delivers the timestamp fix (MVP).
- **US2 (P2)**: same mechanism; adds mixed/unnumbered fixture + assertions. Independently testable.
- **US3 (P3)**: same mechanism; regression + precision assertions. Independently testable.

### Within Each User Story

- Same-file order: `heuristics.ts` (T003→T004); `graph.identity.test.ts` (T009→T011→T012→T013).
- Each fixture (T008, T010) precedes the test that reads it.

### Parallel Opportunities

- Foundational: **T002** (`types.ts`) ∥ **T003** (`heuristics.ts`) at the start.
- Fixtures **T008** and **T010** are independent dirs → [P] (can be authored up front).
- Polish: **T015** (docs) [P].

---

## Parallel Example: Foundational

```bash
# Independent files at the start of Phase 2:
Task: "Add mentionText to FeatureFacts in src/core/model/types.ts"     # T002
Task: "Broaden extractLinks in src/core/graph/heuristics.ts"           # T003
# then (same file / dependent): T004 → T005 → T006 → T007
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 Setup (T001) → 2. Phase 2 Foundational (T002–T007) → 3. Phase 3 US1 (T008–T009).
4. **STOP and VALIDATE**: `npm run test:core` — timestamp features form link + slug edges.
5. Shippable — the reported collapse under timestamp numbering is fixed.

### Incremental Delivery

- Foundational → US1 (timestamp, MVP) → US2 (mixed/unnumbered) → US3 (regression + precision).
  Each adds fixtures/assertions without changing the mechanism.

---

## Notes

- [P] = different files, no incomplete dependencies.
- Pure `core/` only — no `vscode`/DOM; shells, renderer, query, CLI/MCP unchanged.
- Fixture-driven: every heuristic change lands with a fixture (constitution).
- Sequential repos MUST stay byte-identical (T012) — the change is additive for `NNN-` repos.
