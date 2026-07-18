# Phase 0 Research: Help & Clear Filters

A small UX enhancement entirely within feature 003's controls sidebar. No new
technology, no core/model/query changes. Decisions below; no NEEDS CLARIFICATION.

## Decision 1: "Clear filters" reuses the existing filter message

- **Decision**: The "Clear filters" button emits the existing `setFilter` control message with
  `filterTier: null, filterStatus: null` (feature 003's "show all" sentinel), and resets the
  controls' own tier checkboxes / status selection to fully-selected. No new host handler,
  protocol message, or panel code is needed — the host already routes `setFilter` → panel
  `filter`, and the panel already clears dimming on null filters.
- **Rationale**: Smallest correct change; leverages the plumbing 003 shipped. Keeps the
  feature purely in `src/webview/controls/main.ts` + a pure helper.
- **Alternatives considered**: a new `clearFilters` message (redundant — null filter already
  means "all"); resetting via the host (unnecessary round-trip; the controls own their DOM).

## Decision 2: Disabled/no-op state via a pure `hasActiveFilter` helper

- **Decision**: A pure `hasActiveFilter(tierAll: boolean, statusAll: boolean): boolean`
  (equivalently, derived from whether any tier/status checkbox is unchecked) decides whether
  "Clear filters" is enabled. Extracted as a pure function so it unit-tests without a DOM.
- **Rationale**: FR-003/FR-004 (no-op + visible state) become testable in plain Node.

## Decision 3: Help content is a pure, static data module

- **Decision**: Add `src/webview/controls/help.ts` exporting a plain data structure —
  relationship entries (`{ id, label, tier, defaultOn, description }` for links, slug,
  shared-entity, bare-number, spec-code) plus node/edge encoding notes. The controls webview
  renders it; a plain-Node test asserts completeness and that tiers/defaults match the model.
- **Rationale**: Keeps the help legible and **testable for consistency with the heuristics**
  (FR-008) without a DOM. Authored from `002/contracts/heuristics.md` (the source of truth).
- **Alternatives considered**: inline HTML strings (untestable, drift-prone); pulling text
  from the core at runtime (the core has no user-facing copy — out of its remit).

## Decision 4: Help placement — a collapsible section in the sidebar

- **Decision**: Render help as a dismissible/collapsible **section within the controls
  sidebar** (a "?" / "What do these mean?" toggle), not a separate window or webview. Opening
  and dismissing it leaves the map and other controls untouched.
- **Rationale**: No new view container/command is needed (reuses 003's sidebar); simplest
  discoverable placement next to the relationship toggles it explains. Offline static content.
- **Alternatives considered**: a separate webview panel (heavier, another CSP surface); a
  VS Code walkthrough/hover (overkill for a legend).

## Decision 5: Accessibility & theme

- **Decision**: Both controls are native focusable elements (`<button>`, checkboxes, a
  disclosure toggle) — keyboard-operable by default; help uses semantic markup. Styling uses
  the existing VS Code theme variables (feature 003's `media/controls.css`).
- **Rationale**: FR-011 (keyboard) and consistency with the existing sidebar.

## Decision 6: Testing

- **Decision**: Pure tests (`node:test`) for `help.ts` content completeness/consistency and
  `hasActiveFilter`. The visual dim-clear itself remains a manual/quickstart check (same
  disposition as feature 003's filter-highlight visual — it lives in the webview canvas).
- **Rationale**: Keeps the meaningful logic asserted without a brittle DOM harness; the
  message path (`setFilter(null,null)`) is already covered by 003's controls plumbing.

## Open items

- None. No model/query/extension changes; no new dependencies.
