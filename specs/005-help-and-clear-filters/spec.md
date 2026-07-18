# Feature Specification: Help & Clear Filters

**Feature Branch**: `005-help-and-clear-filters`

**Created**: 2026-07-18

**Status**: Draft

**Input**: User description: "Add a help window to explain what Links, Slug mentions, Shared entities, etc. are; and add a way to clear the filter."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Clear the filters and get back to the full map (Priority: P1)

A user narrows the map with the tier and/or status filters, then wants to see everything
again. Today there is no single action to undo filtering — they must remember and re-check
every box. This story adds a **one-click "Clear filters"** that restores full visibility.

**Why this priority**: Filtering with no reset is a usability dead-end — a user can dim most
of the graph and have no obvious way back. It's the higher-impact of the two gaps because it
unblocks a state users can get stuck in.

**Independent Test**: Apply a tier and a status filter (dimming part of the map), click
"Clear filters," and confirm every node/edge returns to full visibility and the filter
controls return to their "show all" state.

**Acceptance Scenarios**:

1. **Given** one or more tier/status filters are active (some nodes/edges dimmed), **When**
   the user activates "Clear filters," **Then** all dimming is removed and the full map (for
   the current project scope and enabled relationship types) is shown.
2. **Given** filters are active, **When** they are cleared, **Then** the filter controls
   visibly reset to their "all selected / show all" state.
3. **Given** no filters are active, **When** the user views the controls, **Then** the
   "Clear filters" affordance communicates there is nothing to clear (disabled or a no-op),
   and activating it changes nothing.
4. **Given** filters were cleared, **Then** the relationship-type toggles (which relationships
   are computed) are **unaffected** — clearing filters is distinct from turning heuristics on
   or off.

---

### User Story 2 - Understand what the relationship types mean (Priority: P2)

A user sees "Links (definitive)," "Slug mentions (strong)," "Shared entities (medium),"
"Bare numbers (risky)," and "Spec → code layer" but doesn't know what each means or why the
edges look different. This story adds an accessible **help/legend** that explains each
relationship type, its confidence tier, and the node/edge visual encodings.

**Why this priority**: It improves comprehension and trust, but the map is usable without it;
it layers on the existing controls.

**Independent Test**: Open the help, confirm it names and explains each relationship type
(Links, Slug mentions, Shared entities, Bare numbers, Spec → code) with its tier, and
explains the node encodings (status, completion, warnings) and edge encodings (tier style,
weight, direction vs symmetric).

**Acceptance Scenarios**:

1. **Given** the controls are visible, **When** the user opens help, **Then** each of the
   five relationship types is listed with a plain-language description and its confidence
   tier, and the default-off ones (bare numbers, spec→code) are marked as such.
2. **Given** the help is open, **When** the user reads it, **Then** it explains what the node
   visuals mean (status color, task-completion indicator, warning marker) and what the edge
   visuals mean (tier line style, thickness = weight, arrow = direction vs symmetric).
3. **Given** the help is open, **When** the user dismisses it, **Then** it closes and the map
   and controls remain in their prior state.
4. **Given** an offline/air-gapped environment, **When** help is opened, **Then** all content
   renders locally with no network request.

---

### Edge Cases

- **Clear filters while a project is scoped**: clearing restores full visibility **within**
  the active project scope; it does not change the selected project.
- **Clear filters with a spec focused/selected**: the selection/focus is preserved; only the
  dimming is removed.
- **Help opened on an empty/malformed workspace**: help content still renders (it is static
  reference material, independent of the graph).
- **Help content and the actual heuristics drift**: the help descriptions and defaults must
  match the model's behavior (same tiers, same default-off set) — a documentation-consistency
  concern to keep in sync.
- **Keyboard/assistive access**: both the clear-filters control and the help are reachable and
  operable without a mouse.

## Requirements *(mandatory)*

### Functional Requirements

**Clear filters (US1)**

- **FR-001**: The controls MUST provide a single "Clear filters" action that resets the tier
  filter and the status filter to "show all," removing all filter-based dimming/hiding from
  the map.
- **FR-002**: Clearing filters MUST NOT change which relationship types are enabled (the
  heuristic toggles), the active project scope, or the current node selection/focus.
- **FR-003**: The clear action MUST be a no-op (and visibly indicate nothing to clear, e.g.
  disabled) when no filter is active.
- **FR-004**: After clearing, the filter controls MUST visibly reflect the "show all" state.

**Help / legend (US2)**

- **FR-005**: The controls MUST provide an accessible help/legend that can be opened and
  dismissed.
- **FR-006**: The help MUST explain each relationship type — **Links** (definitive),
  **Slug mentions** (strong), **Shared entities** (medium), **Bare numbers** (risky),
  **Spec → code** (optional layer) — in plain language, each with its confidence tier, and
  MUST mark which are off by default.
- **FR-007**: The help MUST explain the node encodings (implementation status, task
  completion, warning indicator) and the edge encodings (tier → line style, weight →
  thickness, direction vs symmetric).
- **FR-008**: The help descriptions and stated defaults MUST match the model's actual tiers
  and default-enabled set (kept consistent with the heuristics).

**Cross-cutting**

- **FR-009**: Both additions live in the existing controls surface and MUST NOT require a
  network call or remote asset; they function fully offline.
- **FR-010**: Neither addition writes to the workspace or collects telemetry; they are
  presentation/interaction only.
- **FR-011**: Both the clear-filters control and the help MUST be keyboard-accessible.

### Key Entities *(include if data involved)*

- **Filter state**: the current tier/status selections that drive dimming; "Clear filters"
  resets this to "all." (Reuses feature 003's view-filter concept; no new model data.)
- **Help content**: static reference text describing relationship types, tiers, and visual
  encodings; derived from the model's vocabulary, not from any workspace data.

*(No changes to the feature-002 graph model or the feature-004 query surface.)*

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From any filtered state, a single "Clear filters" action returns the map to
  full visibility (for the current scope and enabled relationship types) in one step.
- **SC-002**: After clearing, 100% of previously dimmed/hidden nodes and edges are visible
  again, and the filter controls show the "all" state.
- **SC-003**: Clearing filters never changes the enabled relationship types, the project
  scope, or the current selection.
- **SC-004**: The help lists and explains all five relationship types with their tiers and
  correctly marks the two default-off types; it also explains node and edge encodings.
- **SC-005**: Help and clear-filters make zero network requests (work air-gapped) and cause
  zero workspace writes.
- **SC-006**: Both controls are operable via keyboard alone.

## Assumptions

- **Placement**: both additions live in the controls sidebar introduced in feature 003
  (the help may render inline in the sidebar or as a dismissible panel/section — a design
  detail). No new view container or command is required beyond what 003 established.
- **"Clear filters" scope**: it resets the **visual** tier/status filters (feature 003's
  filter/highlight), not the relationship-type toggles (which change what is computed) — those
  remain independently controlled, and a separate "reset toggles to defaults" is out of scope
  unless requested.
- **Help content source**: authored from the model's documented heuristics (feature 002 /
  `contracts/heuristics.md`) so it stays truthful; keeping it in sync is a maintenance note.
- Theme-aware and consistent with the existing sidebar styling.

## Dependencies

- **Feature 003 (graph-rendering)** — provides the controls sidebar, the tier/status filters
  this clears, and the legend area this help extends.
- **Feature 002 (spec-graph-model)** — the source of truth for the relationship tiers and
  defaults the help describes.
- Governed by the project constitution (sandboxed offline webview, read-only, telemetry-free).

## Out of Scope

- Any change to the graph model, heuristics, or the query surface (002/004).
- Resetting the relationship-type toggles to defaults (distinct from clearing filters) unless
  later requested.
- Persisting help/filter preferences across sessions.
- Rendering changes beyond adding the help affordance and the clear-filters control.
