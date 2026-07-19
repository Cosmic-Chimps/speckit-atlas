# Implementation Plan: Folder-Name Identity for Relationships

**Branch**: `009-folder-name-identity` | **Date**: 2026-07-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/009-folder-name-identity/spec.md`

## Summary

Make relationship identity the **folder name** so link/slug edges form under any numbering
scheme (sequential, timestamp, unnumbered, preset). The key realization: `buildProjectGraph`
**already resolves references against the real sibling set** (`idSet`, `resolvable()`), and
nodes already use `id = folder name`. The gap is purely in **extraction** —
`heuristics.ts` only *produces* candidates shaped `NNN-slug`. So the change is small and
confined to pure `core/`:

1. **Links** — broaden `extractLinks` to emit a candidate per path segment of a relative
   link (not just a 3-digit slug); resolution against `idSet` keeps only real siblings, so
   `](../20260719-…-x/spec.md)` and `](../unnumbered-name/…)` now connect.
2. **Slug-mentions** — replace the `NNN-slug` regex with a **sibling-aware** matcher:
   whole-word (boundary-delimited) matches of the project's actual sibling folder names in a
   feature's text, count-weighted (the resolved FR-004 policy). Runs in `buildProjectGraph`
   where the sibling set lives, via a single longest-first alternation scan per feature (so
   `fleet-safety` doesn't match inside `fleet-safety-x`, and the < 200 ms budget holds).
3. **`number` stays 3-digit-derived** — a feature gets a numeric `number` only when its
   folder has an `NNN-` prefix, else `number` is absent (FR-005); the risky **bare-number**
   heuristic therefore stays scoped to numbered features (FR-006). No change to
   `projectScan`/`nodeScan` number derivation.

Purely-sequential repos produce byte-identical graphs (SC-003, guarded by existing
fixtures). Rendering, query, CLI/MCP, protocol — all consume the same model, unchanged, and
benefit for free.

## Technical Context

**Language/Version**: TypeScript (`strict`); pure `core/` (no `vscode`/DOM).

**Primary Dependencies**: None new. Pure string/regex work in the existing core.

**Storage**: N/A. `FeatureFacts` gains a transient `mentionText` (the concatenated
scannable text `parseFeature` already builds) so `buildProjectGraph` can do sibling-aware
matching; it is recomputed each build, not persisted.

**Testing**: `node:test` for the pure heuristics/model changes; **fixture-driven** —
new `timestamp`, `mixed-scheme`, and `unnumbered` fixtures, plus the existing sequential
fixtures as regression guards. Existing `@vscode/test-electron` and CLI/MCP suites stay
green unchanged (they consume the model).

**Target Platform**: shared core (extension + CLI + MCP).

**Performance Goals**: one longest-first alternation scan of each feature's text against the
project's sibling names → O(features × text); stays within the < 200 ms incremental-update
budget on a 200-spec workspace.

**Constraints**: pure, total, never-throws (Principle II); read-only; offline; no new
dependency. Zero regression on sequential repos (byte-identical edges).

**Scale/Scope**: reference extraction + slug resolution only. No new tiers, no edge-model
change, no downstream-layer change.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Gate | Status |
|---|-----------|------|--------|
| I | Pure Domain Core, Thin Editor Shell | The change lives **entirely in pure `core/graph`** (heuristics + parse + assemble); still no `vscode`/DOM. Shells unchanged. | ✅ PASS |
| II | Resilient Parsing Over Rigid Schemas | Any folder-name shape is handled; malformed names degrade to warnings; matcher is total (never throws). This *increases* schema-resilience — the feature's whole point. | ✅ PASS — FR-011. |
| III | Read-Only by Default | Pure model computation; no file writes anywhere. | ✅ PASS. |
| IV | Responsive at Workspace Scale | Single alternation scan per feature (O(features × text)); full graph rebuilds from cached facts as today; < 200 ms budget preserved. | ✅ PASS — research D5. |
| V | Complement the Ecosystem | Works on vanilla repos of *any* numbering scheme; requires nothing proprietary; namespacing unchanged. | ✅ PASS. |
| VI | Offline, Private, Telemetry-Free | Pure local computation; no network, no telemetry. | ✅ PASS. |
| — | Tech constraints (TS strict, layering, fixture-driven heuristics, no new deps) | Every heuristic change ships with a fixture (new timestamp/mixed/unnumbered + sequential regression); no new dependency. | ✅ PASS. |

**Result**: All gates pass. This is a legitimate, fixture-driven revision of feature 002's
pure core that *strengthens* Principle II. No deviations → Complexity Tracking empty.

## Project Structure

### Documentation (this feature)

```text
specs/009-folder-name-identity/
├── plan.md · research.md · data-model.md · quickstart.md
├── contracts/heuristics.md
└── checklists/requirements.md
```

### Source Code (repository root) — additions/changes in **bold**

```text
src/core/
├── graph/
│   ├── heuristics.ts       # ** update ** broaden extractLinks (per-segment); add matchSiblingMentions(); drop NNN-only slug regex; keep NUMBER_RE/ENTITY_RE/CODE_LINK_RE
│   ├── parseFeature.ts     # ** update ** stop emitting NNN-slug refs; carry `mentionText`; links via broadened extractor
│   └── buildProjectGraph.ts# ** update ** add sibling-aware slug-mention edges from matchSiblingMentions + idSet
└── model/types.ts          # ** update ** FeatureFacts gains `mentionText: string`
src/extension/ · src/platform/ · src/webview/ · src/cli/ · src/mcp/   # UNCHANGED
fixtures/graph/
├── timestamp-numbering/    # ** NEW ** YYYYMMDD-HHMMSS-slug specs that reference each other
├── mixed-schemes/          # ** NEW ** sequential + timestamp + unnumbered, cross-referencing
└── (existing sequential fixtures = regression guards)
test/core/
├── graph.heuristics.test.ts  # ** update ** matchSiblingMentions + broadened links; bare-number stays 3-digit
└── graph.identity.test.ts    # ** NEW ** timestamp/mixed/unnumbered edge formation; sequential byte-identical
```

**Structure Decision**: Single project; the change is confined to `src/core/graph` + one
model field + fixtures/tests. `nodeScan`/`projectScan` number derivation is intentionally
left at `^(\d{3})-` (correct per FR-005/FR-006). No shell, renderer, or query changes.

## Complexity Tracking

> No constitution violations. Section intentionally empty.
