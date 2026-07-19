# Feature Specification: In-Editor MCP Auto-Discovery

**Feature Branch**: `007-mcp-provider-contribution`

**Created**: 2026-07-19

**Status**: Draft

**Input**: User description: "When a user installs the SpecKit Atlas extension, the extension should make its headless query surface (feature 004) automatically available to in-editor AI agents — with no separate npm install and no manual MCP config."

## User Scenarios & Testing *(mandatory)*

Today the extension and the agent query surface are two disconnected products. Installing
the extension gives you the visual map; the query tools an AI agent could use (graph, spec
relationships, status, orphans, checks) ship only as a separate npm package that the user
must install *and* register with their agent by hand. Most users never do this, so the
agent-facing value of the project is effectively invisible on install. This feature closes
that gap: **installing the extension is enough** — an in-editor AI agent discovers the
query tools automatically and can answer questions about the workspace's specs with no
extra setup.

### User Story 1 - Zero-config discovery on install (Priority: P1)

A developer installs the SpecKit Atlas extension and opens a Spec Kit repository. Without
running any install command, editing any config file, or restarting anything, their
in-editor AI agent can now list and call the SpecKit Atlas query tools and answer
questions like "which specs depend on 003?" or "are there any orphaned specs?".

**Why this priority**: This is the entire point of the feature — turning "installed the
extension" into "the agent knows about my specs". Without it, the agent surface stays
hidden behind a manual npm + config step almost no one performs. It delivers standalone
value even if nothing else ships.

**Independent Test**: On a clean machine, install only the extension, open a Spec Kit
workspace, and confirm the in-editor agent can enumerate and successfully call the query
tools — with no npm install and no MCP configuration performed.

**Acceptance Scenarios**:

1. **Given** the extension is installed and a Spec Kit workspace is open, **When** an
   in-editor agent lists available tools, **Then** the SpecKit Atlas query tools appear
   without the user having installed anything else or edited any configuration.
2. **Given** the tools are discovered, **When** the agent calls the graph, spec-
   relationships, status, orphans, or no-orphans-check tool, **Then** it receives a valid
   result for the current workspace.
3. **Given** the extension was just installed, **When** the user opens the workspace,
   **Then** discovery requires no terminal command, no file edit, and no manual server
   registration.

---

### User Story 2 - Same tools, same answers as the standalone surface (Priority: P2)

A user who already relies on the standalone query surface (in CI or a terminal) expects
the in-editor agent to give the same answers. The in-editor tools return results identical
to the standalone query surface for the same workspace, and support the same per-project
scoping in multi-root repositories.

**Why this priority**: Trust in the agent depends on it matching the authoritative tool.
Divergent answers between the in-editor and standalone surfaces would make both suspect.
Depends on US1's discovery but adds distinct value (parity + scoping).

**Independent Test**: Run a query through the standalone surface and the in-editor agent
against the same workspace and confirm the results match; in a multi-root workspace, scope
a query to one project and confirm only that project's sub-graph is returned.

**Acceptance Scenarios**:

1. **Given** the same workspace, **When** the same query is run through the in-editor tool
   and the standalone surface, **Then** the results are equivalent.
2. **Given** a multi-root workspace, **When** the agent scopes a query to one project,
   **Then** it receives exactly that project's sub-graph with no cross-project results.

---

### User Story 3 - The npm channel and older editors keep working (Priority: P3)

Nothing that works today should break. The standalone CLI and MCP server still ship via
npm for out-of-editor and CI use — including for users on editor versions below the new
minimum floor, who install nothing new and keep using the npm channel. And when no Spec
Kit workspace is open, the tools respond with a clear "no specs" result instead of failing.

**Why this priority**: Protects existing users and CI pipelines and keeps the feature from
regressing the project's reach. Lower priority because it is about preservation and
graceful edges rather than the headline capability.

**Independent Test**: Confirm the standalone CLI/MCP still run unchanged; open a non–Spec
Kit folder and confirm the tools return an empty result rather than an error; confirm an
editor below the new minimum version is offered the npm channel rather than a broken
install.

**Acceptance Scenarios**:

1. **Given** the standalone CLI and MCP server, **When** used out-of-editor or in CI,
   **Then** they behave exactly as before this feature.
2. **Given** an editor below the new minimum supported version, **When** the user tries to
   install the extension, **Then** the editor prevents installation via normal manifest
   compatibility (no half-working state), and the npm CLI/MCP remain the supported path.
3. **Given** no Spec Kit workspace is open, **When** an agent calls a tool, **Then** it
   receives a clear empty/no-specs result, not an error or crash.

---

### Edge Cases

- **No Spec Kit workspace open**: tools remain callable and return a clear empty result.
- **Editor below the minimum floor**: installation is prevented by manifest compatibility
  (no half-working state); the user is directed to the npm channel.
- **Multi-root workspace**: queries are scoped per project/root; no cross-project results.
- **Both channels present** (user also registered the standalone MCP manually): both work;
  the in-editor tools are clearly attributable to this extension and do not corrupt or
  conflict with the standalone registration.
- **Workspace mid-refresh** (a spec was just saved): a tool call returns a consistent
  read-only snapshot, never a partially-written or crashed result.
- **Large workspace**: discovery and tool calls stay within the extension's responsiveness
  expectations.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: On activation in a Spec Kit workspace, the extension MUST advertise a local
  query server to the editor's agent-tool registry so in-editor AI agents can discover it
  automatically, with no user configuration.
- **FR-002**: The advertised server MUST expose the same read-only query capabilities as
  the standalone surface: the full spec graph, a spec's relationships, a status/
  completeness summary, orphaned specs, and a no-orphans check.
- **FR-003**: For the same workspace, in-editor tool results MUST be equivalent to the
  standalone surface's results (parity), derived from the same underlying model.
- **FR-004**: Queries MUST be scopeable per project/root and MUST NOT return cross-project
  results in a multi-root workspace.
- **FR-005**: The server MUST be read-only — it MUST NOT create, modify, move, or delete
  any workspace file.
- **FR-006**: The server MUST operate fully offline and locally, with no network calls and
  no telemetry of any kind.
- **FR-007**: The standalone CLI and standalone MCP server MUST remain available and
  behaviorally unchanged for out-of-editor and CI use.
- **FR-008**: When no Spec Kit workspace is open, the tools MUST remain callable and return
  a clear empty/no-specs result rather than erroring or crashing.
- **FR-009**: Discovery MUST require no user action beyond installing the extension — no
  terminal command, no separate package install, and no configuration-file edit.
- **FR-010**: Installing the extension MUST provide everything the in-editor server needs
  to run, so there is no separate runtime install step for the user.
- **FR-011**: The feature MUST preserve the extension's lazy activation and startup-cost
  expectations; advertising the server MUST NOT introduce eager or slow activation.
- **FR-012**: The extension MUST declare a minimum supported editor version at the floor
  that ships the agent-tool discovery capability (~the version that introduced it). Editors
  below that version are prevented from installing the extension by the normal manifest-
  compatibility mechanism, so every installed instance can advertise the server — there is
  no in-editor "capability absent" branch to maintain. Users on older editors are served by
  the unchanged standalone npm channel (FR-007).
- **FR-013**: The in-editor tools MUST be clearly attributable to SpecKit Atlas and MUST
  coexist without conflict when the standalone server is also registered by the user.

### Key Entities *(include if data involved)*

- **Query tool**: One agent-callable capability (graph, spec relationships, status,
  orphans, no-orphans check) with a defined input (e.g. optional project scope) and a
  read-only result derived from the spec model.
- **Advertised server**: The local, offline query server the extension makes discoverable
  to the editor's agent-tool registry, bundling the query tools for the current workspace.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After installing only the extension and opening a Spec Kit workspace, an
  in-editor agent can list and successfully call the query tools with **zero** additional
  steps (no package install, no config edit).
- **SC-002**: For every query on the validation corpus, the in-editor result matches the
  standalone surface's result (100% parity).
- **SC-003**: In a multi-root workspace, a project-scoped query returns exactly that
  project's sub-graph with zero cross-project results.
- **SC-004**: Across all tools, zero workspace-file writes and zero network calls occur.
- **SC-005**: With no Spec Kit workspace open, 100% of tool calls return a clear empty
  result with no error or crash.
- **SC-006**: On the declared minimum supported editor version (the tested floor), auto-
  discovery is available to 100% of installed instances; editors below that version cannot
  install the extension (so no partially-working state exists).
- **SC-007**: Extension activation stays within its existing startup-cost budget (no
  measurable regression attributable to this feature).

## Assumptions

- The editor's native agent-tool registry (its mechanism for extensions to advertise MCP-
  style servers) is the discovery channel. Agents that read that registry — the editor's
  built-in agent and compatible third-party agents — get the tools automatically; agents
  that do not read it are out of scope for *auto*-discovery and can still use the npm
  channel manually.
- The in-editor server reuses the existing pure core and read-only scan and the feature-004
  query semantics; no new query types or result shapes are introduced.
- "Bundled / provides everything it needs" means the installed extension carries what the
  server requires to run; the exact packaging approach is a planning decision, but the net
  effect for the user is no separate install.
- Trust/enablement follows the editor's own model for extension-provided agent tools (e.g.
  a native first-use trust prompt); this feature adds no separate credential or consent
  system beyond that, consistent with its read-only, offline, local nature.
- Parity is validated against the existing fixture workspaces used by feature 004.
- The standalone npm CLI/MCP remain the supported path for CI and terminal use; this
  feature adds an in-editor path rather than replacing them.
- **Editor-floor decision (resolved)**: the extension's minimum supported editor version is
  raised to the floor that ships the agent-tool discovery capability (~^1.101). This is an
  accepted trade-off — users on older editors can no longer install the extension, but they
  retain full functionality via the npm CLI/MCP channel. Chosen over conditional
  registration for a single, simpler code path with auto-discovery always available to
  installed users.
