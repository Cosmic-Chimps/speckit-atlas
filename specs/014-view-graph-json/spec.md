# Feature Specification: View Graph JSON

**Feature Branch**: `014-view-graph-json`

**Created**: 2026-07-20

**Status**: Completed

**Input**: User description: "Now we need another \"Speckit Atlas:\" Command view, export, json graph? maybe the user want's to see the json that we are using to generate the graph"

## User Scenarios & Testing *(mandatory)*

SpecKit Atlas builds a graph model from the workspace's specs and renders it as a map. Today
that model is only visible as a picture. This feature adds a command that surfaces the exact
underlying graph data as readable JSON, so a user can inspect, understand, copy, or feed to an
agent the same data the map is drawn from — without leaving the editor and without any file
being written on their behalf.

### User Story 1 - Inspect the graph data behind the map (Priority: P1)

A user looking at (or curious about) the Atlas map runs a command and gets the graph as
formatted JSON opened in a new editor tab. They can read the nodes, edges, statuses, and any
warnings, scroll and search it like any document, and — if they wish — save it themselves via
the editor's own Save As.

**Why this priority**: This is the whole feature. Being able to see the data is the value; the
command is useless without it. It is also the minimum that ships something demonstrable.

**Independent Test**: In a Spec Kit workspace, run the command and confirm a new tab opens
containing valid, formatted JSON whose contents match the graph currently rendered on the map.

**Acceptance Scenarios**:

1. **Given** a workspace with specs, **When** the user runs the command, **Then** a new,
   read-only-safe editor tab opens showing the graph as human-readable (indented) JSON.
2. **Given** that JSON, **When** the user reads it, **Then** it contains the graph's projects,
   nodes, edges, and any warnings, in a stable, versioned structure.
3. **Given** the tab is open, **When** the user searches or scrolls it, **Then** it behaves as
   an ordinary editor document (no custom viewer required).
4. **Given** the command runs, **When** it completes, **Then** no file has been created,
   modified, moved, or deleted anywhere in the workspace.

---

### User Story 2 - Scope the JSON to what I'm currently viewing (Priority: P2)

A user who has narrowed the map to a single project (via the controls project selector) runs
the command and gets JSON for just that project; a user viewing all projects gets the whole
workspace. The exported data matches the current on-screen scope.

**Why this priority**: Makes the output match the user's mental context so the JSON is
immediately relevant. Valuable, but the feature still delivers value (US1) without honoring
scope — it would just always show everything.

**Independent Test**: Select a single project in the controls, run the command, and confirm the
JSON contains only that project; switch to "All projects", re-run, and confirm all projects
appear.

**Acceptance Scenarios**:

1. **Given** a single project is selected in the controls, **When** the user runs the command,
   **Then** the JSON contains only that project's graph.
2. **Given** "All projects" is selected (or no project scoping is active), **When** the user
   runs the command, **Then** the JSON contains every project's graph.
3. **Given** the current selection, **When** the JSON is produced, **Then** its scope matches
   what the map is currently showing.

---

### Edge Cases

- **No specs / empty workspace** → the command still opens a tab showing a valid empty graph
  (e.g. no projects) rather than erroring or showing nothing.
- **Malformed or partially-parsed specs** → the JSON includes the same per-item warnings the
  model already carries; the command never throws or shows a broken document.
- **Command run before the model is ready** (extension just activated) → it builds/uses the
  current model and still produces valid JSON (empty if nothing is available yet).
- **A selected project that no longer exists** (removed since selection) → the output degrades
  to the whole workspace (or an empty scope) without error.
- **Very large workspace (hundreds of specs)** → the JSON is produced and opened without
  freezing the editor.
- **Command invoked when Atlas would not otherwise be active** → invoking it makes the graph
  available and produces JSON, consistent with the rest of the extension's lazy activation.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a namespaced command, presented as "SpecKit Atlas: View
  Graph JSON", that outputs the current graph model as JSON.
- **FR-002**: The command MUST open the JSON in a new editor tab that the user can read,
  search, and save themselves; it MUST NOT itself create, modify, move, or delete any workspace
  file.
- **FR-003**: The JSON MUST be the same canonical, versioned graph representation the extension
  already exposes elsewhere (the graph query result) — carrying a schema version, the graph
  data (projects → nodes, edges), and any warnings — so it is consistent across surfaces.
- **FR-004**: The JSON MUST be human-readable (indented/pretty-printed), not minified.
- **FR-005**: The output MUST reflect the graph as currently configured — i.e. the same
  relationship heuristics/toggles in effect for the rendered map — so the JSON matches what the
  user sees.
- **FR-006**: The command MUST scope the output to the current project selection: a single
  project when one is selected in the controls, or the whole workspace when all projects are in
  view.
- **FR-007**: When the workspace has no specs, the command MUST still produce and open valid
  JSON representing an empty graph.
- **FR-008**: The command MUST include the model's warnings so malformed/partial input is
  visible in the output rather than silently dropped.
- **FR-009**: The command MUST be deterministic — the same workspace state and scope MUST
  produce byte-identical JSON.
- **FR-010**: The command MUST be discoverable from the command palette.
- **FR-011**: The feature MUST remain offline and telemetry-free — producing the JSON MUST make
  no network request and transmit nothing.
- **FR-012**: The command MUST degrade gracefully: malformed input, an empty workspace, or a
  stale project selection MUST yield a valid document or a clear message, never an exception or
  a crashed view.

### Key Entities *(include if data involved)*

- **Graph JSON document**: the produced text — a versioned envelope containing the schema
  version, the graph data (projects, each with its nodes and edges), and warnings.
- **Export scope**: which projects the document covers — the single selected project or the
  whole workspace — derived from the current controls selection.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can go from "looking at the map" to "reading the graph JSON" in a single
  command invocation (one step).
- **SC-002**: The opened JSON parses as valid JSON 100% of the time, including on empty and
  malformed-spec workspaces.
- **SC-003**: The JSON's contents match the currently rendered graph (same projects, nodes,
  edges, and scope) in 100% of cases.
- **SC-004**: Running the command twice on unchanged workspace state and scope yields
  byte-identical output.
- **SC-005**: The command performs zero file writes and zero network requests on every
  invocation (verifiable by observation).
- **SC-006**: On a workspace of several hundred specs, the JSON opens without a perceptible
  editor freeze.

## Assumptions

- **Reuses the existing graph query representation**: the JSON is the same versioned graph
  result the CLI and agent surfaces already emit, so there is one canonical shape rather than a
  new bespoke format. This was the resolved choice over a bare graph object or the internal
  render elements.
- **Open-in-a-tab, not write-a-file**: delivery is via a new (untitled) editor document the
  user can save themselves, preserving the extension's read-only posture. Copying to the
  clipboard and a save-to-file dialog were considered and excluded from this feature's scope.
- **Scope follows the controls selection**: the output mirrors the active project selector
  rather than always emitting the whole workspace or prompting each time.
- **Heuristic toggles in effect apply**: the exported graph reflects whatever relationship
  toggles are currently active, matching the rendered map rather than a fixed default set.
- **JSON is the format**: the human-readable rendering targets JSON specifically (the data the
  map is generated from), not a diagram export (e.g. an image) — that is out of scope here.
