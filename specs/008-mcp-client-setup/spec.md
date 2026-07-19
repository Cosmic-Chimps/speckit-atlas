# Feature Specification: MCP Setup for Any Agent Client

**Feature Branch**: `008-mcp-client-setup`

**Created**: 2026-07-19

**Status**: Draft

**Input**: User description: "Make MCP discovery work for any MCP client (Claude Code, Cursor, Claude Desktop, …), not just VS Code's built-in agent."

## User Scenarios & Testing *(mandatory)*

Feature 007 made the query surface auto-discoverable to **VS Code's built-in agent** via
the editor's MCP registry. But other agents — Claude Code, Cursor, Claude Desktop — keep
their **own** MCP configuration and do not read VS Code's registry, so the tools never
appear for them (as seen: the SpecKit Atlas server shows to Copilot but not in Claude
Code's MCP list). Today the only path for those clients is for the user to hand-craft a
registration and hunt for the server's path. This feature closes that gap: the extension
**generates the exact, correct MCP registration for the user's chosen client**, so
connecting a non-VS-Code agent takes seconds instead of manual guesswork.

### User Story 1 - Set up my agent from the extension (Priority: P1)

A developer using Claude Code (or Cursor, or Claude Desktop) runs a single command —
"SpecKit Atlas: Set up MCP for your agent" — picks their client, and gets the precise,
ready-to-use registration for the current workspace (copied to the clipboard and/or shown
on screen). They apply it once, and their agent lists the `atlas_*` tools.

**Why this priority**: This is the whole point — turning "your agent can't see the tools"
into "connect in seconds" for the clients that don't read VS Code's registry. It delivers
standalone value even if only one client is supported.

**Independent Test**: Run the command in a Spec Kit workspace, choose a client, and confirm
the produced registration, when applied to that client, makes it list the tools — with no
manual path hunting.

**Acceptance Scenarios**:

1. **Given** a Spec Kit workspace is open, **When** the user runs the setup command and
   picks their client, **Then** they receive a correct, copy-ready registration scoped to
   that workspace.
2. **Given** the registration is applied to the chosen client, **When** the agent lists
   tools, **Then** the five `atlas_*` tools appear and work.
3. **Given** the user picks "Claude Code", **When** the command completes, **Then** it
   yields the exact `claude mcp add …` invocation (or equivalent) they can run as-is.

---

### User Story 2 - The right form for each client (Priority: P2)

Each client wants its registration in a different shape. The user selects their client and
gets the matching form — a `claude mcp add` command for Claude Code, a `.cursor/mcp.json`
snippet for Cursor, a config-JSON block for Claude Desktop — plus a **generic stdio**
(command + args) form for any other MCP client.

**Why this priority**: A single generic blob forces the user to translate it themselves,
which is the friction we're removing. Per-client output is what makes it "seconds". Depends
on US1's generation but adds distinct value.

**Independent Test**: For each supported client, confirm the produced form is valid for that
client's documented config format and applies without edits.

**Acceptance Scenarios**:

1. **Given** the user selects any supported client, **When** the registration is produced,
   **Then** it is in that client's expected format and requires no hand-editing.
2. **Given** the user's client is not in the curated list, **When** they pick "Other",
   **Then** they get the generic stdio command + args they can adapt.

---

### User Story 3 - Works whether or not the npm package is installed (Priority: P3)

The generated registration must launch a real, present server. If the standalone
`speckit-atlas-mcp` is installed (npm), the config uses it; otherwise it points at the
extension's own bundled server by absolute path — so it works with nothing extra installed.

**Why this priority**: Keeps the "seconds, no extra install" promise honest across setups.
Lower priority because it is about robustness of the generated target rather than the
headline flow.

**Independent Test**: With and without the npm package installed, confirm the generated
registration references a server binary that exists and launches.

**Acceptance Scenarios**:

1. **Given** `speckit-atlas-mcp` is on PATH, **When** the registration is generated, **Then**
   it uses that command.
2. **Given** it is not installed, **When** the registration is generated, **Then** it points
   at the extension's bundled server by an absolute, existing path.

---

### Edge Cases

- **No Spec Kit workspace open**: the command explains what's needed and does not emit an
  invalid/rootless registration.
- **Multi-root workspace**: the user is offered a per-folder registration (or picks the
  folder); each registration is scoped to its own root.
- **Client not in the curated list**: the generic stdio form is offered.
- **Server path with spaces / non-ASCII**: the generated command quotes/escapes correctly so
  it runs verbatim.
- **User re-runs setup**: generating again is safe and idempotent (produces the same config).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The extension MUST provide a command that generates the exact MCP server
  registration for the current workspace, for a user-selected client.
- **FR-002**: It MUST support at least: Claude Code (a `claude mcp add …` command),
  Cursor (a `.cursor/mcp.json` snippet), Claude Desktop (a config-JSON block), and a
  **generic stdio** (command + args) form for any other client.
- **FR-003**: The generated registration MUST target a real, present server binary — the
  installed `speckit-atlas-mcp` when available, otherwise the extension's bundled server by
  absolute path — so it works without a separate install.
- **FR-004**: The registration MUST be scoped to the workspace/project root so its results
  match the map and the standalone/in-editor surfaces.
- **FR-005**: Applying the generated registration MUST expose the same read-only `atlas_*`
  tools with equivalent results (parity with features 004/007).
- **FR-006**: Generating the registration MUST be offline and telemetry-free.
- **FR-007**: When no Spec Kit workspace is open, the command MUST explain what is required
  rather than produce an invalid registration.
- **FR-008**: Multi-root workspaces MUST be handled — the user can obtain a registration
  scoped to a chosen folder; no cross-project scope leaks.
- **FR-009**: The command MUST make the registration easy to apply — at minimum copy it to
  the clipboard and/or display it — without the user hunting for the server's path.
- **FR-010**: The generated command/snippet MUST be correctly quoted/escaped so it runs
  verbatim (paths with spaces, etc.).
- **FR-011**: The extension MUST NOT create, modify, move, or delete **any** file (inside
  the workspace or elsewhere) when setting up a client. It only **generates** the
  registration and hands it off — copying to the clipboard and/or displaying it — for the
  user to apply themselves. No automatic writes, no invoking a client's write-CLI on the
  user's behalf. This keeps Constitution Principle III (Read-Only) fully intact and needs
  no amendment.

### Key Entities *(include if data involved)*

- **Client target**: A supported agent client (Claude Code, Cursor, Claude Desktop, or
  generic) with its expected registration format.
- **Server launch spec**: The command + args + root that launches the read-only query
  server (npm bin or bundled path) — the same underlying server as features 004/007.
- **Registration snippet**: The client-shaped, copy-ready text the command produces.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can register the server with a non-VS-Code MCP client in under 1
  minute using the command's output, with no manual path hunting.
- **SC-002**: For each supported client, the produced registration applies without
  hand-editing and the client then lists the `atlas_*` tools (works on first try).
- **SC-003**: The generated registration references an existing, launchable server binary
  in 100% of cases (npm bin or bundled path).
- **SC-004**: By default, zero workspace-file writes occur when generating a registration.
- **SC-005**: Generating a registration performs no network calls and emits no telemetry.
- **SC-006**: In a multi-root workspace, the registration is scoped to the intended folder
  in 100% of cases.

## Assumptions

- The server being registered is the existing read-only stdio query server (feature 004);
  this feature produces *client registrations*, not new server logic or new tools.
- Curated clients are Claude Code, Cursor, and Claude Desktop, plus a generic stdio form;
  other clients are served by the generic form.
- **Write-scope decision (resolved)**: the extension is **generate-and-hand-off only** —
  it copies/shows the registration and the user applies it. It writes no files anywhere
  and does not run any client's write-CLI on the user's behalf, so Read-Only (Principle
  III) holds with no constitution amendment. (A one-click write was considered and
  rejected to preserve the non-negotiable Read-Only posture.)
- The npm bin is `speckit-atlas-mcp`; the bundled server is the extension's installed
  `dist/mcp.js`. The command detects which is available.
- This complements feature 007 (which covers VS Code's built-in agent automatically);
  008 covers the clients that do not read VS Code's MCP registry.
- Applying the registration and any client-side trust prompts follow each client's own
  model; this feature does not add its own credential/consent system.
