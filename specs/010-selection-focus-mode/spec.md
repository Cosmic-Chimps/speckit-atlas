# Feature Specification: Selection & Focus Mode

**Feature Branch**: `010-selection-focus-mode`

**Created**: 2026-07-19

**Status**: Draft

**Input**: User description: "in the layout when we select a spec under the specs section it moves and selects it with a blue border but it doesn't clear the other past blue ones. also we need a way to filter that when I select a node or a spec under the specs section I need to be able to toggle if I want to see the entire graph or just the nodes that connect with the one that I selected and their relations with other nodes"

## Context

This feature refines the interactive map delivered by `003-graph-rendering` and its
controls sidebar (which today offers only the tier/status dimming filters and the
"Clear filters" button from `005-help-and-clear-filters`). It changes only how the
user selects and focuses nodes; it does not touch the relationship model built by
`002-spec-graph-model` — it consumes that model's neighbor information to decide what
to focus. Selection state must continue to survive the incremental in-place updates
introduced alongside `006-persist-map-layout`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Single active selection (Priority: P1)

A user browsing the map clicks entries in the **SPECS** list in the controls sidebar
(or clicks nodes directly on the map) to inspect them one at a time. Each new
selection should replace the previous one, so exactly one spec is highlighted at any
moment and the map never accumulates a trail of blue-bordered nodes.

**Why this priority**: This is a correctness bug in existing behavior — the map
currently shows several nodes highlighted at once, making it impossible to tell which
spec is "current". It is small, self-contained, and is the foundation the focus toggle
(User Story 2) depends on, since focus is anchored to a single selected node.

**Independent Test**: Open the map, click three different specs in the SPECS list in
sequence, and confirm only the most recently clicked node carries the selection
highlight while the other two return to their normal appearance.

**Acceptance Scenarios**:

1. **Given** a node is already selected (blue border), **When** the user clicks a
   different spec in the SPECS list, **Then** the previously selected node loses its
   highlight and only the newly clicked node is highlighted.
2. **Given** a node is selected via the SPECS list, **When** the user clicks a
   different node directly on the map, **Then** the sidebar selection is superseded and
   only the map-clicked node is highlighted.
3. **Given** a node is selected, **When** the user clicks empty space on the map,
   **Then** the selection is cleared and no node is highlighted.
4. **Given** the map receives an incremental update (e.g. after a file save), **When**
   the update completes, **Then** the single active selection is preserved and no extra
   nodes become highlighted as a side effect.

---

### User Story 2 - Focus on selection's neighborhood (Priority: P2)

A user wants to concentrate on one spec and its immediate relationships without the
visual noise of the full graph. They enable a **focus mode** toggle; while it is on,
the map shows only the selected spec, the specs directly connected to it, and the
relationship edges among that set. Turning the toggle off (or clearing the selection)
returns the full graph. Selecting a different spec while focus mode is on re-centers
the focused view on the new selection.

**Why this priority**: This is the primary new capability the user asked for. It
depends on a reliable single selection (User Story 1) and delivers standalone value —
large graphs become legible when scoped to one spec's neighborhood — but the map is
still usable without it, so it ranks below the correctness fix.

**Independent Test**: Select a spec that has neighbors, enable the focus toggle, and
confirm the map displays only that spec plus its directly connected specs and their
connecting edges; toggle it off and confirm the entire graph returns unchanged.

**Acceptance Scenarios**:

1. **Given** a spec with several direct neighbors is selected, **When** the user
   enables focus mode, **Then** only the selected spec, its direct neighbors, and the
   edges among that visible set are shown; all other specs and edges are hidden.
2. **Given** focus mode is on with one spec focused, **When** the user selects a
   different spec, **Then** the focused view updates to the new spec's neighborhood.
3. **Given** focus mode is on, **When** the user disables the toggle, **Then** the full
   graph is restored.
4. **Given** focus mode is on, **When** the current selection is cleared, **Then** the
   full graph is shown (focus has nothing to anchor to) and the toggle remains
   available for the next selection.
5. **Given** focus mode is on, **When** the tier/status filters from
   `005-help-and-clear-filters` are also active, **Then** both constraints apply
   together — the focused neighborhood is shown, and within it the tier/status filtering
   is still reflected.

---

### Edge Cases

- **Isolated spec (no neighbors)**: enabling focus mode on a spec with no edges shows
  just that single node.
- **Focus toggled on with nothing selected**: the full graph is shown until the user
  selects a spec.
- **Selected spec removed by an incremental update**: if the focused/selected spec
  disappears after a re-parse, the selection clears and the full graph is shown.
- **Search-then-select**: filtering the SPECS list via the search box and then clicking
  a result behaves identically to clicking any spec — single selection replaces the
  prior one.
- **Focus interacting with saved layout**: hiding/showing nodes for focus must not
  disturb the persisted positions/viewport from `006-persist-map-layout`; restoring the
  full graph returns nodes to their saved positions.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Selecting a spec from the SPECS list MUST replace any prior selection, so
  at most one spec is highlighted at a time.
- **FR-002**: Selecting a node directly on the map MUST follow the same single-selection
  rule and MUST stay consistent with selections made from the SPECS list (a selection
  from either source supersedes the other).
- **FR-003**: Clicking empty map space MUST clear the current selection and its
  highlight.
- **FR-004**: The map MUST provide a user-toggleable **focus mode** control located in
  the controls sidebar, alongside the existing filter controls.
- **FR-005**: While focus mode is on and a spec is selected, the map MUST display only
  the selected spec, its directly connected (one hop) neighbor specs, and the
  relationship edges among that visible set; all other specs and edges MUST be hidden.
- **FR-006**: Changing the selection while focus mode is on MUST re-scope the focused
  view to the newly selected spec's neighborhood.
- **FR-007**: Turning focus mode off MUST restore the full graph, and clearing the
  selection while focus mode is on MUST also show the full graph.
- **FR-008**: Focus mode MUST compose with the existing tier and status filters so that
  enabling focus does not discard or override active filter selections, and vice versa.
- **FR-009**: Selection state and focus-mode state MUST survive an incremental in-place
  map update without introducing spurious additional highlights or losing the current
  selection.
- **FR-010**: The feature MUST remain read-only and confined to the webview/controls
  layer, requiring no change to the pure relationship model of `002-spec-graph-model`.
- **FR-011**: The SPECS list MUST visibly highlight the currently selected spec and keep
  that highlight in sync with the map — selecting from either the list or a map node
  updates both — and the highlight MUST persist across control re-renders (e.g. after a
  refresh), clearing only when the selection is cleared or the spec no longer exists.
- **FR-012**: When a spec is selected, the SPECS list MUST show how many other specs relate
  to it (its direct-neighbor count in the current graph), updating as the selection or the
  graph changes.

### Key Entities

- **Active selection**: the single spec currently highlighted on the map; at most one
  exists at any time. Sourced interchangeably from a SPECS-list click or a map-node
  click.
- **Focus mode state**: an on/off toggle. When on, it combines with the active
  selection to derive the visible subset (selected spec + one-hop neighbors + their
  interconnecting edges).
- **Focused neighborhood**: the derived set of visible nodes and edges when focus mode
  is on — read from the already-computed graph adjacency, not recomputed relationships.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After clicking any sequence of specs in the SPECS list, exactly one node
  is highlighted at all times — never zero (except after an explicit clear) and never
  more than one.
- **SC-002**: A user can restrict the map to a single spec's neighborhood in one action
  (toggling focus mode) once a spec is selected.
- **SC-003**: Enabling focus mode on a spec hides every node and edge not in the
  selected spec's one-hop neighborhood, and disabling it restores the exact previous
  full-graph view (same nodes, edges, and layout positions).
- **SC-004**: Focus mode and the tier/status filters can be active simultaneously with
  both effects visibly applied, and neither resets the other.
- **SC-005**: Selection and focus behavior is unaffected by incremental map updates —
  after a save-triggered re-parse, the highlighted spec and focus state are unchanged
  (aside from specs that were genuinely added or removed).
- **SC-006**: The selected spec is unambiguously identifiable in the SPECS list (one
  highlighted row), and its related-spec count is displayed and matches the number of
  distinct specs connected to it in the current graph.

## Assumptions

- **Neighborhood depth is one hop.** "The nodes that connect with the one I selected and
  their relations with other nodes" is interpreted as the selected spec plus its direct
  neighbors plus the edges among that visible set (a one-hop induced neighborhood).
  Deeper (transitive) expansion is out of scope for this iteration.
- **Focus hides rather than dims.** To declutter large graphs, focus mode removes
  out-of-scope nodes/edges from view, distinct from the tier/status *dimming* filters of
  `005-help-and-clear-filters`, which keep elements visible but de-emphasized.
- **Focus mode is off by default**, so first-run behavior matches today's full-graph map.
- **Selecting a spec still centers/zooms to it** as it does today; only the
  clear-previous-selection behavior and the new focus scoping are added.
- **Edge direction is ignored for neighborhood membership** — a neighbor connected by an
  incoming or outgoing edge is included either way.
- This feature reuses the already-built graph adjacency from `002-spec-graph-model` and
  the rendering/selection plumbing of `003-graph-rendering`; it introduces no new data
  source and makes no network calls (offline, telemetry-free per the constitution).
