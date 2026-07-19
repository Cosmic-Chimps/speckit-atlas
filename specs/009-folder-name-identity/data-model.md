# Data Model: Folder-Name Identity for Relationships

Feature 009. Revises feature 002's pure core. The edge model (tiers, weight, evidence,
symmetry) is **unchanged** — only *how targets are identified and matched* changes.

## Entities

### FeatureFacts (revised)

The per-feature parse result (from `parseFeature`). One field added.

| Field | Type | Change | Notes |
|-------|------|--------|-------|
| `id` | `string` | — | The **folder name** — the canonical identity (unchanged). |
| `number` | `string \| null` | — | Derived only from an `NNN-` prefix; **absent** for timestamp/unnumbered (FR-005). |
| `title` `status` `taskCompletion` `completeness` `warnings` | — | — | Unchanged. |
| `references` | `Reference[]` | changed | No longer includes `NNN-slug` `slug` refs; links are broadened; `number`/`entity`/`code` unchanged. |
| **`mentionText`** | `string` | **NEW** | The feature's concatenated scannable text, for sibling-aware slug matching. Transient (recomputed per build), never persisted. |

### Reference (unchanged shape)

`{ kind: "link" | "slug" | "number" | "entity" | "code"; targetHint; evidence; count }`.
`link` candidates are now path segments (any folder name); `slug` edges are produced from
`matchSiblingMentions` rather than a regex reference.

### Sibling set (matching input)

The set of real feature-folder names in a project (`idSet` in `buildProjectGraph`).
Reference resolution and slug matching are both keyed on this set — a target connects only
if it is a real sibling (FR-004).

### SpecNode / RelationEdge (unchanged)

`id = folder name`; edges keep tier/weight/evidence/symmetry from 002.

## Behavior / rules

- **Identity (FR-001/FR-010)**: `id` is the directory name everywhere — node identity,
  reference resolution, and search/selection. `title` is the human label where present.
- **Links (FR-002)**: a relative link into any sibling folder → definitive edge, regardless
  of the folder's name format.
- **Slug-mentions (FR-003/FR-004)**: whole-word mention of any real sibling name → strong
  edge, count-weighted; arbitrary tokens (non-siblings) never match; self excluded.
- **Number (FR-005/FR-006)**: `number` present only for `NNN-` folders; bare-number edges
  only between numbered features; timestamp/unnumbered never fabricate a number.
- **Cross-scheme (FR-007)**: resolution is by folder name, so a numbered feature and a
  timestamp feature that reference each other connect.
- **Regression (FR-008)**: sequential repos yield identical edges.
- **Shared-entity / spec→code (FR-009)**: unchanged (already identity-agnostic).
- **Resilience (FR-011)**: matcher and extractors are total; malformed names → warnings,
  never a throw.

## Relationships

```text
feature folders ──► FeatureFacts{ id=folder, number?, mentionText } ─┐
                                                                     ▼
                          buildProjectGraph:  idSet = { real sibling folder names }
                            ├─ link refs      → resolvable(target, idSet) → definitive edge
                            ├─ matchSiblingMentions(mentionText, idSet, id) → strong edges (count-weighted)
                            ├─ number refs     → numberMap (NNN only)       → risky edge
                            └─ entity/code     → medium / node attribute (unchanged)
```
