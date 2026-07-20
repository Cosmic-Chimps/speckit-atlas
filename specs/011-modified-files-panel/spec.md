# Feature Specification: Modified-files list in the detail panel

**Feature Branch**: `011-modified-files-panel`

**Created**: 2026-07-20

**Status**: Draft

**Input**: User description: "In the floating window at the right I think we should list the files that were modified to fulfill the specs. ordered by name"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See the files that fulfill a selected spec (Priority: P1)

A user studying the Atlas map selects a spec node. The detail panel on the right (which already
shows Status, Tasks, Artifacts, and an "Open spec" action) now also lists the source files that
were modified to fulfill that spec, sorted alphabetically by name. This lets the user answer
"what code does this spec touch?" without leaving the map or opening the spec artifacts by hand.

**Why this priority**: This is the entire feature — surfacing the file list is the value the user
asked for. Everything else is refinement of this one capability.

**Independent Test**: Select a spec that has associated source-file references and confirm the
detail panel shows those file paths in ascending name order; select a spec with no associated
files and confirm the panel shows a clear empty state instead of a broken or missing section.

**Acceptance Scenarios**:

1. **Given** a spec node with three associated source files, **When** the user selects it, **Then**
   the detail panel shows all three file paths in a labeled list ordered ascending by name.
2. **Given** a spec node with no associated source files, **When** the user selects it, **Then**
   the detail panel shows the section with an explicit "no files" empty state (no error, no
   crash).
3. **Given** a spec node is already selected and its files are shown, **When** the user selects a
   different spec node, **Then** the list refreshes to that spec's files.
4. **Given** the same set of associated files, **When** the panel is shown repeatedly, **Then** the
   ordering is identical every time (deterministic).

---

### User Story 2 - Reach a listed file quickly (Priority: P2)

From the file list, the user can open a listed file to view it, staying within the read-only,
map-centric workflow rather than hunting for the file in the explorer.

**Why this priority**: Opening a file is a natural follow-on to seeing it, and it mirrors the
existing "Open spec" affordance, but the list is useful for orientation even without it.

**Independent Test**: With a spec selected, activate a listed file entry and confirm the file
opens for viewing without any modification to the workspace.

**Acceptance Scenarios**:

1. **Given** the file list is shown, **When** the user activates a listed file that exists in the
   workspace, **Then** that file opens for viewing (read-only) in the editor.
2. **Given** the file list is shown, **When** the user activates a listed file whose path no longer
   resolves in the workspace, **Then** the user is informed the file could not be opened and the
   map/panel remain unchanged.

---

### Edge Cases

- **No associated files**: the section renders an explicit empty state, never a missing or blank
  region.
- **Many files (e.g. 50+)**: the list stays readable and scrolls within the panel rather than
  pushing "Open spec" off-screen or forcing the whole panel to grow unbounded.
- **Duplicate references to the same file**: each file appears once (de-duplicated).
- **Long paths**: long file paths remain legible (wrap or elide) and do not break the panel
  layout or cause horizontal overflow.
- **Non-spec selection**: when an edge (relationship) is selected instead of a spec, the file list
  section does not appear (the edge detail view is unchanged).
- **Partial/malformed spec data**: if file references cannot be determined for a spec, the feature
  degrades to the empty state for that spec; it never blocks the rest of the panel from rendering.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The spec detail panel MUST include a dedicated, labeled section listing the source
  files associated with the selected spec (the files modified to fulfill it).
- **FR-002**: The file list MUST be ordered ascending by file name, and the ordering MUST be
  deterministic (identical for identical inputs).
- **FR-003**: Each file MUST appear at most once; duplicate references to the same file MUST be
  collapsed into a single entry.
- **FR-004**: When a selected spec has no associated files, the section MUST render an explicit
  empty state rather than being omitted or appearing broken.
- **FR-005**: The file list MUST update to reflect the currently selected spec whenever the
  selection changes, and MUST NOT appear for edge (relationship) selections.
- **FR-006**: The feature MUST remain read-only: displaying or interacting with the list MUST NOT
  create, modify, move, or delete any workspace file.
- **FR-006a**: Each listed file MUST be activatable to open it read-only in the editor for viewing,
  mirroring the existing "Open spec" action.
- **FR-007**: The feature MUST degrade gracefully: missing or unparseable file information for a
  spec MUST NOT throw, crash the panel, or prevent the rest of the detail panel from rendering.
- **FR-008**: The "files modified to fulfill the spec" MUST be derived from the source-file
  references already parsed from the spec's own artifacts (its tasks.md / plan.md / spec relative
  links), applied consistently across all specs. Version-control history is NOT a source in this
  feature (keeps it fully offline, read-only, and deterministic).

### Key Entities *(include if feature involves data)*

- **Associated file**: a workspace-relative path to a source file considered part of fulfilling a
  given spec. Attributes: display path, sort key (name). Shown in the panel for the one currently
  selected spec (a file may relate to multiple specs across the graph, but the panel lists only the
  selected spec's files).
- **Spec (selected node)**: the specification currently shown in the detail panel; owns the set of
  associated files surfaced by this feature, alongside its existing Status/Tasks/Artifacts data.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: When a user selects a spec that has associated files, they can see the full list of
  those files, sorted by name, without opening any spec artifact or leaving the map.
- **SC-002**: The file list for a given spec is identical on every selection of that spec (100%
  deterministic ordering across repeated selections).
- **SC-003**: Selecting any spec — including one with no associated files or with malformed data —
  never produces an error state or an unresponsive panel (0 crashes across the full spec set).
- **SC-004**: The detail panel with the file list keeps existing panel actions (e.g. "Open spec")
  reachable, including for specs whose file list is long enough to require scrolling.

## Assumptions

- This is a webview/detail-panel presentation feature; it surfaces file information already
  derivable for a spec rather than introducing a new external data source, consistent with the
  extension's offline, read-only, telemetry-free constraints.
- "Files that were modified to fulfill the specs" is scoped to source-file references derived from
  the spec's own artifacts (tasks.md/plan.md/spec links) — not version-control history (FR-008).
- The detail panel remains the single right-side surface; this feature adds a section to it and
  does not introduce a separate window or view.
- Ordering is a case-insensitive ascending sort on the file name (final path segment), with the
  full path shown for disambiguation.
- The feature applies per selected spec; it does not aggregate files across multiple specs at once.
