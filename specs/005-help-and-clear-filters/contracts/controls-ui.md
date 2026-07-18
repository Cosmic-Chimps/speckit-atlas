# Contract: Controls UI — Clear Filters & Help

Additions to the feature-003 controls sidebar (`src/webview/controls/`). Pure helpers/data
are asserted in plain Node; DOM wiring is manual/quickstart (webview visual).

## Clear filters

- **H-1**: The controls render a **"Clear filters"** control.
- **H-2**: Activating it emits `setFilter { filterTier: null, filterStatus: null }` (feature
  003's "show all") and resets the tier checkboxes to all-checked and the status selection to
  all-selected.
- **H-3**: It does **not** emit any `setOption` (relationship toggles unchanged), any
  `selectProject`, or any `focusSpec` — clearing filters is orthogonal to those (FR-002).
- **H-4**: When no filter is active it is disabled / a visible no-op (FR-003), driven by the
  pure `hasActiveFilter(tierAll, statusAll)`:
  - **H-4a**: `hasActiveFilter(true, true) === false` (nothing to clear).
  - **H-4b**: `hasActiveFilter(false, true) === true` and `hasActiveFilter(true, false) === true`.
- **H-5**: After clearing, the controls reflect the "all" state (H-2) and, via the existing
  panel `filter` handler, the map shows every node/edge again (FR-001/SC-002) — manual check.
- **H-6**: The control is keyboard-focusable and activatable (native `<button>`).

## Help / legend

- **HLP-1**: The controls expose an openable/dismissible **help** section; opening/closing it
  does not alter the map or other controls (FR-005, SC-…).
- **HLP-2**: `HELP_ENTRIES` contains exactly the five relationship types with ids
  `link`, `slug`, `shared-entity`, `bare-number`, `spec-code`.
- **HLP-3**: Each entry's `tier` is correct (`definitive`/`strong`/`medium`/`risky`/`layer`)
  and each has a non-empty plain-language `description` (FR-006).
- **HLP-4**: `defaultOn` matches `DEFAULT_GRAPH_OPTIONS` — `link`/`slug`/`shared-entity` true,
  `bare-number`/`spec-code` false (FR-008). Asserted against the actual core defaults.
- **HLP-5**: `ENCODING_NOTES` covers the node encodings (status, completion, warnings) and the
  edge encodings (tier line style, weight thickness, direction vs symmetric) (FR-007).
- **HLP-6**: All help content is static/local — rendering it makes no network request
  (FR-009); no workspace writes, no telemetry (FR-010).
- **HLP-7**: The help toggle is keyboard-operable (FR-011).

## Out of contract

- No changes to the graph model, heuristics, query surface, host, or message protocol beyond
  reusing the existing `setFilter` message.
