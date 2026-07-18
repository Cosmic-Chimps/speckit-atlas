# Implementation Plan: Spec-Relationship Graph Model

**Branch**: `002-spec-graph-model` | **Date**: 2026-07-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-spec-graph-model/spec.md`

## Summary

Add a pure, headless graph module to `src/core/` that turns a Spec Kit project into a
relationship graph: nodes per feature (title, status, task-completion, artifact
completeness) and inferred edges (tiered/weighted/toggleable — definitive links,
strong slug mentions, medium code-pinned shared entities, risky bare numbers, optional
spec→code). The core is two pure functions — `parseFeature` (per feature) and
`buildProjectGraph` (per project) — enabling incremental rebuilds. A thin adapter
change feeds the extension's scan into the core and fills `MapViewModel.graph` (was
`null`). No rendering (feature 003) and no agent/CLI/MCP surface (feature 004).

## Technical Context

**Language/Version**: TypeScript (`strict`), existing toolchain; VS Code `^1.90.0`.

**Primary Dependencies**: **None new.** Parsing uses targeted regex over built-in
strings (no markdown/AST library) — keeps the core dependency-free, small, offline
(research Decision 2).

**Storage**: N/A — in-memory model, nothing persisted.

**Testing**: `node:test` for the pure core (primary), with synthetic fixtures under
`fixtures/graph/`; `@vscode/test-electron` for the thin adapter wiring.

**Target Platform**: Pure core runs on plain Node; consumed by the VS Code extension
(and, later, CLI/MCP — same core, feature 004).

**Project Type**: Single-project VS Code extension; this feature is almost entirely
new pure-core code plus a thin adapter update.

**Performance Goals**: Node set + completeness built from the file tree with **zero**
content reads (SC-005); a single-file change re-parses one feature and reuses cached
`FeatureFacts`, then re-assembles cheaply (SC-008); scales to hundreds of specs across
dozens of projects with per-project scoping (no N² cross-repo work).

**Constraints**: pure core (no `vscode`/DOM/Node imports); read-only; offline; no
proprietary metadata required; every heuristic documented + toggleable; `any`
justified inline, `// @ts-ignore` banned in core.

**Scale/Scope**: Model only. Calibrated on the real 27-feature aerosens corpus.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Gate | Status |
|---|-----------|------|--------|
| I | Pure Domain Core, Thin Editor Shell | Graph logic is pure `parseFeature`/`buildProjectGraph`; adapter injects file data; no editor imports in core. | ✅ PASS — research D1, contract "no vscode/DOM/Node". |
| II | Resilient Parsing Over Rigid Schemas | Totality (never throws) + per-item warnings; every heuristic documented (`contracts/heuristics.md`) and toggleable; risky off by default. | ✅ PASS — FR-018, G-13, heuristics doc. |
| III | Read-Only by Default | Model is in-memory; no workspace writes (agent/memory-file surface explicitly deferred to 004). | ✅ PASS — FR-022, Out of Scope. |
| IV | Responsive at Workspace Scale | Tree-only nodes (no content reads), per-feature incremental re-parse, per-project scoping (no N²). | ✅ PASS — SC-005/008, research D6/D7. |
| V | Complement the Ecosystem | Works on vanilla repo, no proprietary metadata; per-project boundaries respect independent repos. | ✅ PASS — FR-021, SC-002. |
| VI | Offline, Private, Telemetry-Free | No network, no new remote deps (regex-only parsing), no telemetry. | ✅ PASS — research D2, FR-022. |
| — | Tech constraints (TS strict, layering, minimal deps, fixture-driven) | No new runtime deps; new heuristics each land with a fixture. | ✅ PASS. |

**Result**: All gates pass. No deviations → Complexity Tracking empty.

## Project Structure

### Documentation (this feature)

```text
specs/002-spec-graph-model/
├── plan.md              # This file
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/           # Phase 1
│   ├── graph-core-api.md
│   └── heuristics.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks (next)
```

### Source Code (repository root) — additions in **bold**

```text
src/
├── core/
│   ├── detection/            # (existing, 001)
│   ├── model/
│   │   ├── types.ts          # + Feature*/SpecNode/RelationEdge/ProjectGraph/…
│   │   └── viewModel.ts      # buildMapViewModel gains optional WorkspaceGraph
│   └── graph/                # ** NEW pure module **
│       ├── parseFeature.ts   # per-feature: node attrs + references (regex)
│       ├── heuristics.ts     # link/slug/entity/number/code extractors + tiers
│       ├── buildProjectGraph.ts  # resolve refs → edges (scoped, toggled, collapsed)
│       └── index.ts          # re-exported via core/index.ts
├── extension/
│   ├── workspaceProbe.ts     # ** extend ** → per-feature artifacts (tree) + read contents
│   ├── projectScan.ts        # ** NEW ** build ProjectSnapshot[] (two-layer), cache for incremental
│   └── extension.ts          # ** update ** feed snapshots → core → MapViewModel.graph
└── webview/                  # UNCHANGED (renderer is feature 003)

fixtures/graph/               # ** NEW synthetic fixtures **
│  cross-links/ slug-mentions/ shared-entities/ bare-numbers/
│  two-projects/ malformed/ messy-status/
test/
├── core/                     # + graph tests (G-1..G-14)
└── integration/              # + assert MapViewModel.graph populated
```

**Structure Decision**: All graph logic lands in `src/core/graph/` (pure, boundary-
enforced by `tsconfig.core.json` + the ESLint rule from 001). The only `vscode`-facing
work is extending `workspaceProbe`/adding `projectScan` (two-layer scan + content
cache) and wiring `extension.ts` to populate `MapViewModel.graph`. The webview is
untouched. Fixtures are synthetic (no proprietary aerosens content) per the recorded
decision.

## Complexity Tracking

> No constitution violations. No entries.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
