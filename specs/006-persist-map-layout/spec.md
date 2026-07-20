# Feature Specification: Persist Map Layout Across Close/Reopen

**Feature Branch**: `006-persist-map-layout`

**Created**: 2026-07-18

**Status**: Completed

**Input**: User description: "When we close the tab where is the graph and we open it again it looses everything we should keep the order of the nodes"

## User Scenarios & Testing *(mandatory)*

Today, when the user closes the SpecKit Atlas Map tab and reopens it, the graph
re-arranges itself from scratch: every node lands in a new position, so the mental
map the user built up (which cluster is where, which node they had dragged aside)
is lost. This feature makes the arrangement *sticky* — the map reopens looking the
way the user left it.

### User Story 1 - Reopening the map restores my arrangement (Priority: P1)

A user opens the map, lets it settle into an arrangement, and studies it. They
close the Map tab to focus on code, then reopen it later. The nodes are exactly
where they were — same relative layout, same clusters — so they can continue from
where they left off instead of re-orienting from scratch.

**Why this priority**: This is the reported problem and the whole point of the
feature. Without it, the map is effectively disposable — every reopen is a new,
unfamiliar picture — which undermines the map's value as a stable mental model of
the project. It delivers standalone value even if nothing else in this feature
ships.

**Independent Test**: Open the map, note the position of a few labelled nodes,
close the Map tab, reopen it, and confirm those nodes are in the same positions
(no re-scramble).

**Acceptance Scenarios**:

1. **Given** the map is open with nodes arranged, **When** the user closes the Map
   tab and reopens it, **Then** each node appears in the same position it held
   before closing, with no fresh full re-layout.
2. **Given** the map was arranged and then closed, **When** the user reopens the
   editor workspace in a later session and opens the map, **Then** the previously
   saved arrangement is restored rather than recomputed.
3. **Given** the map is open, **When** the user hides the tab behind another editor
   and returns to it, **Then** the arrangement is unchanged (no regression to
   current behavior).

---

### User Story 2 - My manual placement is kept (Priority: P2)

A user drags specific nodes out of the auto-generated tangle to make a subgraph
readable — pulling a few related specs into a tidy row. When they close and reopen
the map, those hand-placed nodes stay where they put them.

**Why this priority**: Manual tidying is the main reason a user would care about a
position being preserved at all; an auto-layout that merely reproduces *a*
deterministic arrangement is less valuable than one that also honors the user's own
adjustments. Depends on P1's persistence mechanism but adds distinct value.

**Independent Test**: Drag two nodes to deliberate positions, close and reopen the
map, and confirm both nodes are where the user dragged them.

**Acceptance Scenarios**:

1. **Given** the user has dragged one or more nodes to new positions, **When** they
   close and reopen the map, **Then** those nodes are restored to their
   user-chosen positions.
2. **Given** the user dragged a node and then triggered an incremental update
   (e.g. a spec was saved), **When** the update is applied, **Then** the dragged
   node keeps its user-chosen position (consistent with the existing
   preserve-view-on-update behavior).

---

### User Story 3 - New and removed specs don't scramble what I have (Priority: P3)

While the map is closed or open, the user adds a new spec to the workspace and
deletes another. When the map is next shown, the surviving nodes keep their saved
positions, the new spec's node is placed sensibly without shoving existing nodes
around, and the deleted spec simply disappears.

**Why this priority**: Keeps the "sticky layout" promise honest as the project
evolves. Lower priority because it only matters once P1 works and the spec set
actually changes, but without it the feature would feel broken the first time a
spec is added.

**Independent Test**: With a saved arrangement, add one spec and remove another,
reopen the map, and confirm existing nodes are unmoved, the new node is visible and
placed, and the removed node is gone.

**Acceptance Scenarios**:

1. **Given** a saved arrangement, **When** a new spec appears that has no saved
   position, **Then** it is placed in a visible location without moving any node
   that already has a saved position.
2. **Given** a saved arrangement, **When** a spec is removed, **Then** its saved
   position is discarded and no empty gap logic disturbs the remaining nodes.
3. **Given** the user has switched the active project, **When** they arrange one
   project's map and later return to it, **Then** that project's arrangement is
   preserved independently of other projects.

---

### Edge Cases

- **Corrupt or missing saved layout**: If the stored arrangement is absent,
  unreadable, or references an entirely different node set, the map MUST fall back
  to a fresh automatic layout without error or a blank panel (resilience).
- **Partial saved layout**: Some nodes have saved positions, others (newly added)
  do not — the map restores the known ones and places the unknown ones without
  disturbing the known ones.
- **Every saved node is gone** (large refactor renamed all specs): treated as a
  fresh layout; no stale ghost positions applied.
- **User wants a clean slate**: The saved arrangement must not become a trap — the
  user needs an explicit way to discard it and re-run the automatic layout.
- **Filtering/dimming changes**: Applying or clearing filters must not move nodes;
  positions are independent of which tiers/statuses are currently shown.
- **Very large workspace**: Saving and restoring positions must not violate the
  responsiveness budgets for hundreds of specs.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST remember the on-screen position of every node in the
  map while the map is in use.
- **FR-002**: When the map is reopened after its tab was closed, the system MUST
  restore each node to its last-known position instead of computing a fresh
  arrangement.
- **FR-003**: The system MUST restore the last-known viewport (pan and zoom) when
  the map is reopened, so the user returns to the same view, not just the same
  node positions.
- **FR-004**: The system MUST capture positions that result from the user manually
  dragging nodes, and treat those as the positions to preserve.
- **FR-005**: The saved arrangement MUST persist at least across closing and
  reopening the Map tab within an editor session, and SHOULD persist across editor
  restarts for the same workspace.
- **FR-006**: When a node has no saved position (e.g. a newly added spec), the
  system MUST place it in a visible location without changing the saved positions
  of existing nodes.
- **FR-007**: When a node is no longer present in the graph, the system MUST
  discard its saved position.
- **FR-008**: The system MUST keep arrangements distinct per project, so switching
  the active project restores that project's own saved layout.
- **FR-009**: If saved layout data is missing or invalid, the system MUST fall back
  to the automatic layout and render normally, never crashing or showing an empty
  map.
- **FR-010**: The system MUST provide a user-triggerable way to discard the saved
  arrangement and re-run the automatic layout ("reset layout").
- **FR-011**: Layout persistence MUST NOT create, modify, move, or delete any file
  in the user's workspace; it MUST use the editor's own state storage
  (Constitution Principle III — Read-Only).
- **FR-012**: Layout persistence MUST remain fully local — no network calls, no
  remote storage, and no telemetry (Constitution Principle VI).
- **FR-013**: Restoring a saved arrangement MUST NOT trigger a full automatic
  re-layout for an unchanged node set, so reopening stays within the
  responsiveness budget.

### Key Entities *(include if feature involves data)*

- **Node position**: The saved 2-D placement of a single map node, keyed by the
  node's stable identifier so it survives close/reopen and incremental updates.
- **Saved map layout**: The per-project collection of node positions plus the
  viewport (pan/zoom) that together describe "how the user left the map".

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After closing and reopening the Map tab with an unchanged spec set,
  100% of nodes appear in the same positions they held before closing (no drift,
  no re-scramble).
- **SC-002**: The map reappears on reopen without running a fresh full automatic
  layout for an unchanged node set, and within the existing responsiveness budget
  (comparable to an incremental update, well under the < 200 ms save-to-update
  target on a 200-spec workspace).
- **SC-003**: Adding one new spec places its node while moving zero existing
  (saved-position) nodes.
- **SC-004**: Across repeated close/reopen cycles within a session — and across an
  editor restart for the same workspace — the user's arrangement is preserved
  every time (0 scrambles).
- **SC-005**: Manually dragged node positions are preserved on the next reopen in
  100% of cases.
- **SC-006**: A corrupt or absent saved layout results in a normally rendered map
  (fresh automatic layout) in 100% of cases, with no error surfaced to the user.

## Assumptions

- "Keep the order of the nodes" is interpreted as **preserving each node's spatial
  position** (and the overall arrangement/viewport), not imposing a sorted or
  ordered sequence.
- Persistence uses the editor's provided state storage for the map view/workspace,
  not any file written into the user's repository — required by the read-only
  principle and sufficient for tab close/reopen and editor restart.
- Positions are keyed by the existing stable node identifiers already used for
  incremental updates, so no new identity scheme is needed.
- Restoring across a full editor restart is desirable and in scope where the state
  storage supports it; if the storage tier only survives in-session, session-scoped
  persistence still satisfies the primary reported problem (P1).
- The automatic layout used for first-time/new nodes is the existing map layout;
  this feature changes *when* it runs and *whether positions are seeded*, not the
  layout algorithm itself.
- No changes to the pure domain core are required; this is a rendering/host-shell
  behavior concern (the core does not own node positions).
