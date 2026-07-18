# Phase 1 Data Model: Help & Clear Filters

No graph-model or query changes. The only new shapes are small, static, presentational
types in the controls webview. Plain and DOM-free so they unit-test in plain Node.

## HelpEntry (relationship-type help)

One row of the help/legend, authored from `002/contracts/heuristics.md`.

| Field | Type | Notes |
|-------|------|-------|
| `id` | `"link" \| "slug" \| "shared-entity" \| "bare-number" \| "spec-code"` | Matches the model's heuristic ids. |
| `label` | `string` | e.g. "Links", "Slug mentions". |
| `tier` | `"definitive" \| "strong" \| "medium" \| "risky" \| "layer"` | Confidence tier ("layer" for spec→code). |
| `defaultOn` | `boolean` | Whether the heuristic is enabled by default (links/slug/shared-entity = true; bare-number/spec-code = false). |
| `description` | `string` | Plain-language explanation. |

`HELP_ENTRIES: readonly HelpEntry[]` — exactly the five relationship types.

## EncodingNote (node/edge visual legend)

| Field | Type | Notes |
|-------|------|-------|
| `kind` | `"node" \| "edge"` | Which visual family. |
| `label` | `string` | e.g. "Status color", "Line style = tier". |
| `description` | `string` | What the encoding means. |

`ENCODING_NOTES: readonly EncodingNote[]` — covers status color, task-completion indicator,
warning marker (node); tier→line-style, weight→thickness, direction vs symmetric (edge).

## Filter reset (no new persisted state)

- **Clearing** = emitting the existing `setFilter` control message with
  `filterTier: null, filterStatus: null` and resetting the controls' tier checkboxes /
  status selection to fully-selected. Reuses feature 003's filter state; adds none.
- **`hasActiveFilter(tierAll: boolean, statusAll: boolean): boolean`** — pure; returns
  `true` when either the tier set or the status set is not "all", gating the Clear button's
  enabled state (FR-003/FR-004).

## Consistency rule (FR-008)

`HELP_ENTRIES` MUST stay in lockstep with the model's heuristics: the same five ids, the
same tier labels, and `defaultOn` matching `DEFAULT_GRAPH_OPTIONS` (links/slug/shared-entity
on; bare-number/spec-code off). A plain-Node test asserts this.
