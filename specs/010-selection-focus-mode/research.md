# Phase 0 Research: Selection & Focus Mode

No `NEEDS CLARIFICATION` markers remained in the spec. The decisions below resolve the
design choices implied by the two user stories, grounded in the existing map webview
(`src/webview/map/main.ts`), the protocol (`src/webview/protocol.ts`), and the host relay
(`src/extension/extension.ts`, `src/extension/mapPanel.ts`).

## D1 — Root cause of the multiple-highlight bug

- **Decision**: Deselect the current selection before selecting the new node. In
  `focus(nodeId)` call `cy.$(":selected").unselect()` (or `cy.elements().unselect()`)
  immediately before `n.select()`.
- **Rationale**: Cytoscape's programmatic `.select()` is *additive* regardless of
  `selectionType`; it never unselects other elements. `focus()` (invoked for every SPECS
  list click via `focusSpec` → host → `focus`) therefore accumulates selected nodes, each
  drawn with the `node:selected` blue border (main.ts:92-93). Map-canvas clicks already
  single-select because Cytoscape's default tap behavior on a node unselects others; only
  the programmatic path is broken.
- **Alternatives considered**: (a) Setting `selectionType: 'single'` — does not affect
  *programmatic* select, so it would not fix the bug. (b) Tracking selection purely in our
  own state and never using Cytoscape selection — larger change, discards the working
  `node:selected` styling. Rejected as unnecessary.

## D2 — Single-selection invariant across all entry points

- **Decision**: Maintain a module-level `selectedNodeId: string | null` in the map
  webview, set by: SPECS-list `focus()`, map node `tap`, and cleared by background `tap`.
  All three enforce "exactly one selected". `updateInPlace` already re-selects the
  preserved `:selected` id set; with D1 that set has at most one member, so no extra work
  — but re-selection must also re-apply focus (see D5).
- **Rationale**: Focus mode (US2) needs a single anchor; centralizing selection state
  makes both stories consistent and testable. Matches Acceptance Scenarios US1-1/2/3.
- **Alternatives considered**: Reading `:selected` ad hoc each time — works but scatters
  the invariant; a single stored id is clearer and is what focus re-application reads.

## D3 — Focus visibility: hide vs. dim, and neighborhood definition

- **Decision**: Focus mode **hides** out-of-scope elements via Cytoscape `hide()` /
  `show()` (which set `display: none`), distinct from the tier/status **dimming** filter
  which uses the `.dimmed` opacity class (main.ts:107). The visible set is the *induced
  subgraph* of the closed one-hop neighborhood: `selected + selected.neighborhood('node')`
  as the visible nodes, and every edge **between two visible nodes** (`nodes.edgesWith(
  nodes)`), so neighbor↔neighbor relationships are shown, not just spokes to the selected
  node.
- **Rationale**: Spec FR-005 and its assumption call for "the relationship edges among
  that visible set" — an induced subgraph, richer than `closedNeighborhood()` (which omits
  neighbor↔neighbor edges). Hiding (not dimming) matches the user's ask to see "just the
  nodes that connect" and declutters large graphs. `hide()` preserves node positions, so
  the persisted layout from `006-persist-map-layout` is untouched.
- **Alternatives considered**: (a) `closedNeighborhood()` — drops neighbor↔neighbor edges;
  rejected per FR-005. (b) Dimming instead of hiding — leaves clutter, defeats the purpose;
  rejected (dimming is already owned by the tier/status filter). (c) Removing/re-adding
  elements — would scramble layout and is far heavier; rejected.

## D4 — Composition with the existing tier/status dimming filter

- **Decision**: Keep the two layers independent and orthogonal. Focus applies `hidden`
  (display) to the out-of-neighborhood elements; the tier/status filter continues to apply
  `.dimmed` (opacity) to whatever remains visible. Order does not matter because they use
  different CSS channels. `applyFilter` is unchanged; focus apply/restore only toggles
  visibility and never touches `.dimmed`.
- **Rationale**: FR-008 / US2-5 require both to hold at once without either resetting the
  other. Using display for focus and opacity for dimming makes composition automatic.
- **Alternatives considered**: A single combined "visible?" predicate — would entangle two
  independent controls and risk one clobbering the other on re-apply. Rejected.

## D5 — Re-applying focus & selection after an incremental update

- **Decision**: `updateInPlace` removes/re-adds elements when the node set changes, which
  drops transient selection and any `hidden` state. After it restores pan/zoom and
  re-selects the preserved id, call a single `applyFocus()` that reads
  `{ focusModeOn, selectedNodeId }` and re-derives visibility. If the previously selected
  spec no longer exists, clear `selectedNodeId` and show the full graph.
- **Rationale**: FR-009 / US1-4 / US2 edge case ("selected spec removed") require that a
  save-triggered re-parse neither loses the selection nor leaks extra highlights nor leaves
  a stale focus. Centralizing re-application in `applyFocus()` keeps it correct.
- **Alternatives considered**: Persisting focus/selection across renders in host state —
  unnecessary; the webview is the source of truth for this transient view state, and it is
  retained via `retainContextWhenHidden`.

## D6 — Protocol shape for the toggle

- **Decision**: Add `ControlsToHost` variant `{ type: "setFocusMode"; enabled: boolean }`
  and `HostToPanel` variant `{ type: "focusMode"; enabled: boolean }`. The host relays one
  to the other in `onControlMessage` (mirroring how `focusSpec` → `panel.focus`). Add
  `MapPanel.setFocusMode(enabled)` posting the `focusMode` message.
- **Rationale**: Follows the established one-way control→host→panel relay used by
  `focusSpec`, `setFilter`, and `resetLayout`. New fields are additive; existing messages
  are untouched, so back-compat holds.
- **Alternatives considered**: Piggy-backing focus on the existing `filter` message —
  conflates two independent controls and complicates `setFilter`'s null-means-all logic.
  Rejected.

## D7 — Placement of the toggle in the controls sidebar

- **Decision**: Add a "Focus on selection" checkbox under a new **VIEW** section (or
  appended to the existing controls flow) in `src/webview/controls/main.ts`, emitting
  `setFocusMode` on change. Default **off** (matches today's full-graph first run).
- **Rationale**: Consistent with the sidebar's existing checkbox controls (relationship
  toggles, tier filter). Off-by-default satisfies the spec assumption and avoids surprising
  existing users.
- **Alternatives considered**: A toolbar button on the map panel — the controls sidebar is
  already the established home for view controls (`005-help-and-clear-filters`), so keeping
  it there is more discoverable and consistent.

## D8 — Testing strategy

- **Decision**: (1) Pure unit tests for `computeFocusVisible(adjacency, selectedId)` in
  `test/contracts/focus-set.test.ts` using `node:test` (mirrors `layout-seed.test.ts`):
  induced-neighborhood membership, isolated node, unknown/absent selection → full set.
  (2) Integration test `test/integration/selection-focus.test.ts` under
  `@vscode/test-electron` driving the panel: sequential SPECS clicks leave exactly one
  selection; enabling focus hides non-neighbors; toggling off restores; focus survives an
  incremental update; removed-selection clears focus.
- **Rationale**: Matches the repo's fixture-driven, two-tier test culture (Principle:
  Development Workflow). The pure helper carries the logic that must be provably correct;
  the integration test covers the Cytoscape wiring.
- **Alternatives considered**: Integration-only — would leave the neighborhood logic
  untested in isolation; rejected per the constitution's preference for headless-testable
  logic.
