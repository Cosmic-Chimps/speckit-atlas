# Graph fixtures

Synthetic Spec Kit workspaces that reproduce the real signal shapes observed in the
aerosens corpus (see feature 002's spec Assumptions). They contain **no proprietary
content** — hand-crafted to exercise each heuristic.

The authoritative behavioral assertions live in the pure-core tests
(`test/core/graph*.test.ts`), which use in-memory `FeatureInput`s. These on-disk
fixtures back the editor-integration test and serve as human-readable calibration
references.

| Fixture | Shape | Expected model |
|---|---|---|
| `cross-links/` | Activatable workspace (`.specify/` + `specs/001-alpha`, `002-beta`); alpha links to beta | 2 nodes; one **definitive** edge `001-alpha → 002-beta`; alpha task-completion 1/2; beta status `Implemented (authored retroactively)` |
| `two-projects/` | Two roots (`atlas.code-workspace`) both reusing `001-x` and a shared `Report` entity | 2 independent sub-graphs; **no** cross-project edge |
| `slug-mentions/` | `001-a` mentions `002-b` ×3 in prose | strong edge weight 3 (when a sibling `002-b` exists) |
| `shared-entities/` | `001-a` data-model pins `Flight` to `db.types.ts:982` | medium edge when another feature shares the pinned `Flight` |
| `bare-numbers/` | `001-a` says "see 002 for rationale" | no edge by default; risky edge only with `bareNumbers: true` |
| `messy-status/` | `**Status**: Implemented (authored retroactively)␠␠` | status extracted verbatim, trailing whitespace trimmed |
| `malformed/` | `001-thin` with no heading / broken front-matter | partial node (title = slug), no throw, warning if applicable |

Every parsing/heuristic change MUST update a fixture (or an in-memory core test) and
assert the resulting model (constitution: fixture-driven parsing).
