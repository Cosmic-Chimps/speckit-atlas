# Feature Specification: Graph Rendering

**Feature Branch**: `003-graph-rendering`

**Created**: 2026-07-17

**Status**: Completed

**Input**: User description: "Render the spec-relationship graph in the editor — the visualization layer that turns the model from feature 002 into an interactive map."

## Clarifications

### Session 2026-07-17

- Q: What rendering approach / graph library should the map use? → A: Cytoscape.js (bundled locally, offline) — chosen over d3-force/custom SVG and a CodeGraphy-style custom WebGPU+WASM engine (the latter overkill/risky for our scale).
- Q: What default layout style? → A: Force-directed (clusters emerge; robust to cycles and symmetric edges).
- Q: What packaged bundle-size budget should FR-019 / SC-009 assert? → A: ≤ 2 MB packaged `.vsix`, ≤ 800 KB webview JS.
- Q: How should the map stay current when spec files change? → A: A debounced workspace file watcher added in this feature triggers an incremental per-feature re-parse (reusing feature 002) and an in-place map update.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See the specification map (Priority: P1)

A person working in a Spec Kit workspace opens the Atlas map and sees their
specifications drawn as a graph: one node per spec (labelled, and visually encoding how
far it is implemented) connected by edges that show which specs relate and how strongly.
The map opens in a spacious center editor area, not a cramped sidebar. In this first
slice the map simply renders the model that feature 002 already produced.

**Why this priority**: The map is the product's payoff — the reason the model exists. The
smallest valuable slice is: open a panel and see the real nodes and edges for the current
workspace, with strong/definitive relationships visually distinct from weaker inferred
ones.

**Independent Test**: Open a workspace with a known graph, invoke "Open Map," and confirm
the panel shows one node per spec, the expected edges styled by confidence, and no blank
or broken panel.

**Acceptance Scenarios**:

1. **Given** a Spec Kit workspace whose model has nodes and edges, **When** the user opens
   the map, **Then** a center editor panel shows one node per spec and the model's edges.
2. **Given** the rendered map, **When** the user views it, **Then** definitive
   relationships are visually distinct from strong/medium/inferred ones, and edge
   strength (weight) is legible.
3. **Given** a node, **When** the user views it, **Then** its title and its implementation
   status/progress are visible without further interaction.
4. **Given** a spec with no relationships, **When** the map renders, **Then** that spec
   still appears as an isolated node (not omitted).

---

### User Story 2 - Steer what the map shows (Priority: P2)

The user controls the map from the sidebar: a legend explains the encodings; per-heuristic
toggles turn relationship types on and off; and a search/list lets them find and focus a
spec. Turning a relationship type on or off changes what the map draws.

**Why this priority**: Trust and usefulness come from control — the same reason 002 made
the heuristics toggleable. Without steering, a dense map is noise; with it, the user
tunes to what they care about.

**Independent Test**: With the map open, toggle a relationship type in the sidebar and
confirm the corresponding edges appear/disappear; type in the search and confirm the
matching spec is highlighted/focused.

**Acceptance Scenarios**:

1. **Given** the map is open, **When** the user turns a relationship type off, **Then**
   that type's edges are removed from the map and the rest remain; turning it back on
   restores them.
2. **Given** the risky relationship type is off by default, **When** the user has not
   enabled it, **Then** no such edges are drawn; enabling it draws them, visibly marked
   as low-confidence.
3. **Given** the legend, **When** the user reads it, **Then** it explains the node
   encodings and each relationship tier.
4. **Given** the search/list, **When** the user selects or searches a spec name, **Then**
   the matching node is focused/highlighted in the map.

---

### User Story 3 - Explore a spec and jump to it (Priority: P3)

The user inspects an individual spec from the map: selecting a node reveals its details
(status, task-completion, warnings, which artifacts exist), and they can open the
underlying spec file in the editor to read it. In a multi-root workspace, each project's
specs form their own cluster/sub-graph.

**Why this priority**: Turns the map from a picture into a navigation surface, but layers
on the P1/P2 foundation.

**Independent Test**: Select a node and confirm its detail matches the model; trigger
"open spec" and confirm the correct file opens read-only; open a multi-root workspace and
confirm separate per-project sub-graphs.

**Acceptance Scenarios**:

1. **Given** a node, **When** the user selects it, **Then** its status, task-completion,
   warnings, and artifact completeness are shown.
2. **Given** a selected node, **When** the user chooses "open spec," **Then** that spec's
   file opens in the editor for viewing and is not modified.
3. **Given** a multi-root workspace, **When** the map renders, **Then** each project is a
   separate sub-graph and no edge is drawn between projects.

---

### Edge Cases

- **Empty graph / no qualifying specs**: the panel shows a clear empty state, not a blank
  canvas.
- **Only isolated nodes** (no edges): all nodes render; no error.
- **Nodes carrying warnings**: warnings are surfaced (e.g. a badge/indicator), not hidden.
- **Malformed / partial model**: renders whatever is valid plus an indication; never a
  crash or a broken panel.
- **All relationship types toggled off**: nodes remain; edges empty; valid state.
- **Very large graph** (hundreds of nodes across dozens of projects): remains navigable;
  does not freeze the editor.
- **Open-spec target missing/moved**: the open action fails gracefully with a message, not
  an exception.
- **Model updates while the map is open** (a spec file changes): the map updates in place
  without discarding the user's current pan/zoom/selection.
- **Panel reopened / window reloaded**: the map re-renders to a consistent state.

## Requirements *(mandatory)*

### Functional Requirements

**Surface & layout**

- **FR-001**: The map MUST render in a center editor panel, opened via the existing
  "Open Map" command / activity-bar entry.
- **FR-002**: The existing sidebar view MUST be repurposed into controls (legend,
  per-relationship-type toggles, spec list/search, and a project selector for multi-root).
- **FR-003**: The renderer MUST consume the workspace graph already provided on the view
  model (from feature 002) and MUST NOT parse specs, infer relationships, or read files
  for graph data.

**Nodes & edges**

- **FR-004**: Each spec MUST render as exactly one node showing its title and visually
  encoding its implementation status and task-completion, plus its artifact completeness.
- **FR-005**: Isolated nodes (no edges) MUST still render.
- **FR-006**: Edges MUST be drawn distinguishing confidence tier (definitive vs strong vs
  medium vs risky) and conveying weight; each edge's originating relationship type MUST be
  identifiable, and symmetric relationships MUST be distinguishable from directed ones.
- **FR-007**: An edge's supporting evidence MUST be viewable (e.g. on hover/selection).

**Control & interaction**

- **FR-008**: Each relationship type MUST be toggleable from the controls; toggling MUST
  re-render the map to reflect the change, with the risky type off by default and the
  optional spec→code layer off by default.
- **FR-009**: A legend MUST explain the node encodings and each relationship tier.
- **FR-010**: The user MUST be able to pan and zoom the map.
- **FR-011**: Selecting a node MUST reveal its details (status, task-completion, warnings,
  artifact completeness).
- **FR-012**: The user MUST be able to open a node's underlying spec file in the editor for
  viewing; this MUST NOT modify the file, and a missing/moved target MUST fail gracefully.
- **FR-013**: The user MUST be able to find/focus a spec by name (search/list) and to
  filter or highlight by relationship tier and by implementation status.

**Scope & multi-project**

- **FR-014**: A multi-root workspace MUST render one sub-graph per project (clustered or
  via a selector); the map MUST NOT draw edges between projects.

**Responsiveness & resilience**

- **FR-015**: Opening the map MUST NOT block the editor.
- **FR-016**: When the model updates (e.g. a spec file changes), the map MUST update in
  place without a full redraw and without discarding the user's current pan/zoom/selection.
- **FR-016a**: This feature MUST add a **debounced workspace file watcher** that, on a spec
  file change, drives an **incremental per-feature re-parse** (reusing feature 002's
  per-feature build — not a full re-scan) and an in-place map update. This is what makes
  FR-016 / SC-003 hold automatically.
- **FR-017**: Empty, isolated-only, warning-bearing, or malformed/partial models MUST each
  render a sensible state — never a blank/broken panel or a crash.

**Security, privacy, offline**

- **FR-018**: The map MUST render inside a sandboxed webview governed by a strict
  Content-Security-Policy with a per-load nonce; it MUST load NO remote sources.
- **FR-019**: Any graph/layout library MUST be bundled locally (no CDN) and MUST keep the
  packaged extension within the size budget: **≤ 2 MB** for the `.vsix` and **≤ 800 KB**
  for the webview JavaScript bundle.
- **FR-020**: The renderer MUST receive the serialized model via message-passing and MUST
  NOT read the file system directly.
- **FR-021**: The feature MUST function fully offline and MUST NOT collect or transmit
  telemetry. The only file interaction is opening a spec for viewing (read-only).

### Key Entities *(include if data involved)*

- **Map (view)**: the center-panel rendering of one or more project sub-graphs.
- **Controls (view)**: the sidebar surface holding legend, relationship-type toggles,
  spec search/list, and project selector; changes here re-derive what the map shows.
- **Node visual**: the on-screen representation of a `SpecNode` (title + status/progress +
  completeness + warning indicator).
- **Edge visual**: the on-screen representation of a `RelationEdge` (tier styling, weight,
  direction/symmetry, evidence on demand).
- **View options**: the current relationship-type toggles/filters the controls express,
  which map onto the model's graph options.

*(The underlying `SpecNode`, `RelationEdge`, `ProjectGraph`, and `WorkspaceGraph` are
defined by feature 002 and are consumed unchanged.)*

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Opening the map on a workspace with a known model shows one node per spec and
  every edge present in the model, with tiers visually distinguishable.
- **SC-002**: Toggling a relationship type changes the drawn edges by exactly that type's
  edges and nothing else.
- **SC-003**: After a single spec file changes, the map reflects the change within ~200 ms
  on a 200-spec workspace, without a full redraw and without losing the user's current
  pan/zoom/selection.
- **SC-004**: Rendering makes zero network requests; all assets load locally (works in an
  air-gapped environment).
- **SC-005**: "Open spec" opens the correct spec file for viewing in 100% of trials and
  never modifies it; a missing target produces a clear message rather than a failure.
- **SC-006**: Empty, isolated-only, warning-bearing, and malformed models each render a
  sensible state (empty message / badges / partial map) with no blank panel or crash.
- **SC-007**: In a multi-root workspace, the map shows one sub-graph per project and draws
  zero edges between projects.
- **SC-008**: On a workspace of hundreds of nodes, the map becomes interactive without
  freezing the editor, and pan/zoom/selection stay responsive.
- **SC-009**: The packaged extension stays within budget after the graph library is
  included: the `.vsix` is **≤ 2 MB** and the webview JavaScript bundle is **≤ 800 KB**.

## Assumptions

- **Graph/layout library** (clarified 2026-07-17): the map uses **Cytoscape.js**, bundled
  locally and offline, within the size budget (FR-019). Chosen over d3-force/custom SVG and
  a CodeGraphy-style custom WebGPU+WASM engine (the latter deemed overkill/risky at our
  scale). The specific layout extension (e.g. an fcose/cose force layout) is a plan detail.
- **Default layout** (clarified): **force-directed** — clusters emerge and it is robust to
  cycles and symmetric (shared-entity) edges.
- **Node encoding**: status and task-completion are encoded visually (e.g. color and a
  progress treatment); the exact palette/scheme is a design detail, theme-aware to match
  the editor's light/dark theme.
- **"Ready" view state**: this feature activates the previously-reserved "ready" map state
  (feature 001) once a graph is present.
- **Re-render on toggle**: changing a relationship-type toggle re-derives the graph from
  the model with updated options; this reuses feature 002's build, no re-parsing.
- The `~200 ms` incremental-update and `<50 ms` activation budgets come from the project
  constitution (Principle IV).

## Dependencies

- **Feature 002 (spec-graph-model)** — provides the `WorkspaceGraph` on the view model
  that this feature renders; consumed unchanged.
- **Feature 001 (extension scaffold)** — provides the view container, the "Open Map"
  command, and the sandboxed-webview infrastructure this feature builds on.
- Governed by the project constitution (sandboxed CSP webview, offline, read-only,
  responsive/incremental, ecosystem-neutral, telemetry-free).

## Out of Scope

- Any change to the model, heuristics, or parsing (owned by feature 002).
- An agent-facing CLI/MCP surface for the model (feature 004).
- Writing, editing, or reorganizing specs from the map (read-only; opening a file for
  viewing is the only file interaction).
- Persisting layout positions or view preferences into the workspace.
