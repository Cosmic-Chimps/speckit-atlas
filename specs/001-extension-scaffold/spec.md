# Feature Specification: Extension Scaffold

**Feature Branch**: `001-extension-scaffold`

**Created**: 2026-07-17

**Status**: Implemented

**Input**: User description: "So we should start creating the scaffold of a visual studio extension"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Install and activate in a Spec Kit workspace (Priority: P1)

A developer who works with GitHub Spec Kit repositories installs the extension from
the Marketplace (or a local `.vsix`). When they open a folder that is a Spec Kit
workspace, the extension comes to life on its own and presents a single, clearly
named entry point (its dedicated Atlas view) where the specification map will
eventually appear. In this first slice the view opens to a friendly empty/welcome
state rather than a populated graph.

**Why this priority**: Without an installable artifact that reliably activates in
the right context and offers a place to look, there is nothing to build the rest of
the product on. This is the smallest end-to-end slice that proves the extension
exists, loads, and reaches the user.

**Independent Test**: Install the packaged extension into a clean editor, open a
folder containing a Spec Kit layout, and confirm the extension activates and its
Atlas view can be opened and shows its welcome state — with no other features
present.

**Acceptance Scenarios**:

1. **Given** a freshly installed extension and an editor with no folder open,
   **When** the editor starts, **Then** the extension does not activate and adds no
   measurable startup cost.
2. **Given** the extension is installed, **When** the user opens a folder that is a
   Spec Kit workspace, **Then** the extension activates and its Atlas view becomes
   available in the UI.
3. **Given** the extension has activated, **When** the user opens the Atlas view,
   **Then** a welcome/empty state is shown describing that the specification map
   will appear here, with no error and no blank/broken panel.

---

### User Story 2 - Stay dormant and non-intrusive where it does not apply (Priority: P2)

A developer opens ordinary projects that are not Spec Kit repositories, and may also
use the companion Spec Kit extension. The extension must stay out of the way: it
does not activate, does not add a view container or commands that clutter unrelated
projects, and does not collide with the companion extension's views, commands, or
file associations.

**Why this priority**: Adoption depends on the tool fitting quietly into an existing
workflow. An extension that activates everywhere, adds noise, or fights neighboring
tools gets disabled. This slice protects the trust and coexistence posture from day
one.

**Independent Test**: Open several non-Spec Kit folders with the extension installed
(and the companion extension also installed) and confirm the extension never
activates, contributes no visible UI in those workspaces, and produces no conflicts
with the companion extension.

**Acceptance Scenarios**:

1. **Given** a folder that is not a Spec Kit workspace, **When** it is opened,
   **Then** the extension does not activate and contributes no visible commands or
   views.
2. **Given** the companion Spec Kit extension is also installed, **When** a Spec Kit
   workspace is opened, **Then** both extensions coexist without duplicated,
   shadowed, or conflicting views, commands, or file associations.

---

### User Story 3 - Trustworthy by construction: offline and read-only (Priority: P3)

Because these specifications are the source of truth for real projects, a cautious
user needs assurance that simply installing and opening the extension changes
nothing and reaches out to no one. From install through activation and opening the
Atlas view, the extension makes no network requests and creates, modifies, moves, or
deletes no files in the workspace.

**Why this priority**: This establishes the read-only, offline, telemetry-free
posture as an observable property of the very first build, rather than something
retrofitted later. It is lower priority only because it is a guarantee layered over
the P1/P2 behavior, not a separate user-visible surface.

**Independent Test**: With network access disabled and a file-system watcher on the
workspace, install the extension, open a Spec Kit workspace, and open the Atlas
view; confirm zero outbound network activity and zero workspace file changes
throughout.

**Acceptance Scenarios**:

1. **Given** an air-gapped or firewalled environment, **When** the extension is
   installed, activated, and the Atlas view opened, **Then** all functionality works
   and no network request is attempted.
2. **Given** a Spec Kit workspace under file-system monitoring, **When** the
   extension activates and renders its view, **Then** no file in the workspace is
   created, modified, moved, or deleted.
3. **Given** the extension is running, **When** its behavior is observed over a full
   session, **Then** no telemetry, usage data, or workspace content is transmitted.

---

### Edge Cases

- **Empty or malformed Spec Kit workspace**: A folder that looks like a Spec Kit
  repo but has missing or malformed artifacts must still activate cleanly and show
  the welcome/empty state — never an uncaught error or a broken panel.
- **Multi-root workspace**: When only some roots are Spec Kit repositories, the
  extension activates once and treats the qualifying roots as in scope without
  failing on the others.
- **Very large workspace**: Detecting whether a workspace qualifies must not scan
  the entire tree eagerly or block the editor from becoming usable.
- **View reopened / editor reloaded**: Closing and reopening the Atlas view, or
  reloading the window, returns to a consistent welcome state without error.
- **Extension disabled/uninstalled**: Removing the extension leaves the workspace
  and editor exactly as they were, with no residual files or settings written to the
  workspace.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The extension MUST be packageable and installable as a standard editor
  extension artifact, and MUST declare an explicit minimum supported editor version.
- **FR-002**: The extension MUST activate lazily — only when the opened workspace is
  detected as a Spec Kit workspace — and MUST NOT activate on editor startup or when
  no qualifying workspace is open.
- **FR-003**: Detection of a Spec Kit workspace MUST be cheap and non-blocking, and
  MUST NOT require scanning the entire workspace tree before the editor is usable.
- **FR-004**: On activation, the extension MUST contribute exactly one clearly named
  Atlas view (its future graph surface) reachable through the editor UI.
- **FR-005**: The Atlas view MUST open to a welcome/empty state that communicates its
  purpose, with no populated graph required in this feature.
- **FR-006**: The extension MUST NOT create, modify, move, or delete any file in the
  user's workspace at any point during install, activation, or view rendering.
- **FR-007**: The extension MUST function fully offline and MUST NOT make any runtime
  network request or load any remote asset.
- **FR-008**: The extension MUST NOT collect or transmit telemetry, usage data, or
  workspace contents.
- **FR-009**: In workspaces that are not Spec Kit repositories, the extension MUST
  contribute no visible commands or views and MUST remain inactive.
- **FR-010**: The extension MUST coexist with the companion Spec Kit extension
  without conflicting or duplicating view containers, commands, or file
  associations.
- **FR-011**: All error conditions during detection and activation MUST degrade to
  the welcome/empty state with a clear message, never an uncaught exception or a
  crashed editor host.
- **FR-012**: The project MUST be organized so that specification-analysis logic is
  separable from editor-integration and view-rendering concerns, establishing the
  foundation for later features (the layered structure required by the project
  constitution).

### Key Entities *(include if feature involves data)*

- **Workspace**: An opened folder (or set of folders) that the extension inspects to
  decide whether it qualifies as a Spec Kit repository. Attributes relevant here:
  qualifies-or-not, and (for multi-root) which roots qualify.
- **Atlas View**: The single UI surface the extension contributes. In this feature it
  holds only a welcome/empty state; later it will host the specification map.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With the extension installed but no qualifying workspace open, the
  extension adds no more than 50 ms to editor startup and does not activate.
- **SC-002**: In 100% of trials opening a valid Spec Kit workspace, the extension
  activates and its Atlas view can be opened to the welcome state without error.
- **SC-003**: In 100% of trials opening a non-Spec Kit workspace, the extension does
  not activate and contributes no visible UI.
- **SC-004**: Across a full session (install → activate → open view → reload), zero
  network requests are made and zero workspace files are created, modified, moved, or
  deleted.
- **SC-005**: With the companion Spec Kit extension installed alongside, a user can
  open a Spec Kit workspace with no duplicated or conflicting views, commands, or
  file associations observed.
- **SC-006**: A new contributor can install dependencies, build, and produce an
  installable extension artifact by following the project's documented steps, on a
  supported machine, in under 15 minutes.

## Assumptions

- "Visual Studio extension" refers to a **Visual Studio Code** extension. The project
  constitution defines the product as a VS Code extension (webview-based, published
  to the VS Code Marketplace and Open VSX); Visual Studio (the separate IDE) is out
  of scope.
- This feature delivers the **scaffold only**: an installable, activatable skeleton
  with a placeholder view. Actual specification discovery, parsing, and graph
  rendering are deferred to later features.
- "Spec Kit workspace detection" relies on the presence of a recognizable Spec Kit
  layout (e.g. a specs directory and/or Spec Kit configuration); the precise
  detection signals are a planning-phase decision and will be tuned against fixtures
  in later parsing features.
- The specific technology stack, layering conventions, build tooling, and dependency
  choices are governed by the project constitution and detailed in the plan, not in
  this specification.
- Behavior targets a single, explicitly declared minimum editor version and newer.

## Dependencies

- Governed by the project constitution at `.specify/memory/constitution.md`
  (read-only default, lazy activation, offline/telemetry-free, ecosystem coexistence,
  layered architecture).
- Coexistence is validated against the companion Spec Kit extension being installed
  in the same editor.
