# Quickstart & Validation: Spec-Relationship Graph Model

Runnable steps proving the graph model works end-to-end, headless. Implementation
bodies live in `tasks.md`/implementation; this is a run/validate guide. Types and
behaviors are defined in `data-model.md` and `contracts/`.

## Prerequisites

- Node.js (LTS); repo dependencies installed (`npm install`).
- Run from the repo root.

## Build & static gates

```bash
npm run typecheck   # strict, incl. core-purity project (no vscode/DOM in core/)
npm run lint        # incl. the core import-boundary rule
npm run format
```

## Core tests (plain Node, the primary validation)

```bash
npm run test:core   # node:test over src/core, incl. the new graph module
```

Validates the `graph-core-api.md` contract (G-1 … G-14) and the `heuristics.md`
rules against **synthetic fixtures** that reproduce the real signal shapes:

| Fixture | Exercises |
|---|---|
| `fixtures/graph/cross-links/` | definitive `link` edges (G-5) |
| `fixtures/graph/slug-mentions/` | strong `slug-mention` weighting (G-6, G-9) |
| `fixtures/graph/shared-entities/` | code-pinned `shared-entity` vs bare-name (G-7) |
| `fixtures/graph/bare-numbers/` | risky heuristic off-by-default / opt-in (G-8) |
| `fixtures/graph/two-projects/` | no cross-project edges (G-10) |
| `fixtures/graph/malformed/` | totality + warnings, thin folders (G-2/G-13) |
| `fixtures/graph/messy-status/` | status/task parsing (G-3, G-4) |

Expected: fast (< ~1 s), all green.

## Manual validation (maps to Success Criteria)

1. **Per-project nodes/edges (SC-001)** — build the graph for `fixtures/graph/cross-links`
   and confirm one node per feature and exactly the expected definitive edges, no false ones.
2. **No cross-project edges (SC-002)** — build `fixtures/graph/two-projects` (two roots
   reusing `001-…` and a shared generic entity name) and confirm **zero** edges between
   the projects.
3. **Risky off by default (SC-003)** — build `fixtures/graph/bare-numbers` with defaults →
   zero `bare-number` edges; re-build with `{ bareNumbers: true }` → the edges appear,
   all `tier: "risky"`.
4. **Toggle isolation (SC-004)** — toggle each heuristic off and diff the edge set;
   only that heuristic's edges change.
5. **Tree-only nodes (SC-005)** — construct nodes from a `FeatureInput` whose `files`
   map is empty but `artifacts` is populated; confirm correct `completeness` and node
   presence without any content.
6. **Messy status/tasks (SC-006)** — `fixtures/graph/messy-status` yields usable status
   and task-completion despite trailing whitespace / parenthetical notes.
7. **Degradation (SC-007)** — `fixtures/graph/malformed` yields a partial graph with
   warnings and never throws / never empties when valid features exist.
8. **Incremental (SC-008)** — change one feature's `files`, re-run `parseFeature` for
   just that feature, reuse the others' cached `FeatureFacts`, re-assemble; confirm the
   result equals a full rebuild (proving per-feature recompute is sufficient).
9. **Weight ranking (SC-009)** — a feature mentioned many times ranks above a
   single-mention feature by edge `weight`.

## Editor integration (thin)

```bash
npm run test:integration   # @vscode/test-electron
```

Confirms the extension's scan feeds the core and that `MapViewModel.graph` is populated
(no longer `null`) when a Spec Kit workspace is opened. Rendering remains the
welcome/empty state — visualization is feature 003.

## Definition of done

- Core + contract suites green; typecheck/lint/format clean.
- Manual checks 1–9 pass on the synthetic fixtures.
- `MapViewModel.graph` carries a `WorkspaceGraph` in a real workspace; still read-only,
  offline, no telemetry.
