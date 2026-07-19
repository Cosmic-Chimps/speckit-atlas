# Implementation Plan: MCP Setup for Any Agent Client

**Branch**: `008-mcp-client-setup` | **Date**: 2026-07-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-mcp-client-setup/spec.md`

## Summary

Feature 007 auto-registers the query server with VS Code's built-in agent, but Claude Code,
Cursor, and Claude Desktop keep their own MCP config and never see it. This feature adds a
**command** — "SpecKit Atlas: Set up MCP for your agent" — that **generates the exact
registration for a user-chosen client** and hands it off (copies to clipboard + shows it),
**writing nothing** (the resolved spec decision — Read-Only stays intact, no amendment).
The heart is a **pure formatter**, `formatRegistration({ client, launch, projectRoot,
serverName })`, that turns the same server-launch spec 007 already computes (bundled
`dist/mcp.js` via `process.execPath`, `--root <folder>`) into the shape each client wants:
a `claude mcp add …` command (Claude Code), a `.cursor/mcp.json` snippet (Cursor), a
config-JSON block (Claude Desktop), and a generic stdio command+args form (anything else).
A thin command handler resolves the folder (multi-root via QuickPick), picks the client
(QuickPick), formats, and copies/displays. Read-only, offline, telemetry-free. No `core/`,
query, or server changes; no new dependency; no engine bump.

## Technical Context

**Language/Version**: TypeScript (`strict`); VS Code `^1.101.0` (unchanged from 007).

**Primary Dependencies**: None new. Reuses `mcpProvider.serverEntryPath` (the bundled
server path) and stock VS Code APIs (`commands`, `window.showQuickPick`,
`env.clipboard.writeText`, an untitled document).

**Storage**: N/A — nothing persisted; the extension writes no files (FR-011).

**Testing**: pure `formatRegistration` per client via `node:test`; `@vscode/test-electron`
for the command registration + a deterministic "generate for client X" hook that asserts
the produced snippet and that no file was written.

**Target Platform**: VS Code desktop.

**Performance Goals**: on-demand command; no added activation cost beyond registering one
command (lazy activation unchanged).

**Constraints**: **read-only** — generate-and-hand-off only (clipboard + untitled doc; no
workspace or global file writes, no invoking a client's write-CLI); offline; no telemetry;
correct shell/JSON quoting so output runs verbatim (FR-010).

**Scale/Scope**: one command + one pure formatter + client catalog. Reuses the 004/007
server; produces client registrations only — no new tools or query semantics.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Gate | Status |
|---|-----------|------|--------|
| I | Pure Domain Core, Thin Editor Shell | Core/query/server unchanged. New logic is a **pure** `formatRegistration` (no `vscode`) + a thin command handler in `extension/`. | ✅ PASS |
| II | Resilient Parsing Over Rigid Schemas | No workspace → a clear message, not an invalid config; unknown client → the generic form; never throws. | ✅ PASS — FR-007. |
| III | Read-Only by Default | **Writes nothing** — copies to clipboard / shows an untitled doc for the user to apply; does not modify workspace or global files, nor run a client's write-CLI. | ✅ PASS — FR-011 (resolved decision). |
| IV | Responsive at Workspace Scale | On-demand command; registration adds negligible activation cost; lazy activation unchanged. | ✅ PASS. |
| V | Complement the Ecosystem | Namespaced `speckitAtlas.setupMcpClient`; complements 007 by covering non-VS-Code clients; requires nothing proprietary. | ✅ PASS. |
| VI | Offline, Private, Telemetry-Free | No network, no telemetry; all output generated locally from known paths. | ✅ PASS — FR-006. |
| — | Tech constraints (TS strict, layering, no new deps, size) | No new dependency; no engine change; bundle size effectively unchanged. | ✅ PASS. |

**Result**: All gates pass. The Read-Only-preserving "generate only" decision keeps this
inside the constitution with no amendment. Complexity Tracking empty.

## Project Structure

### Documentation (this feature)

```text
specs/008-mcp-client-setup/
├── plan.md · research.md · data-model.md · quickstart.md
├── contracts/mcp-setup.md
└── checklists/requirements.md
```

### Source Code (repository root) — additions/changes in **bold**

```text
src/
├── core/ · platform/ · mcp/ · cli/     # UNCHANGED
└── extension/
    ├── mcpSetup.ts            # ** NEW ** pure: CLIENTS catalog + formatRegistration() + quoting
    ├── mcpProvider.ts         # ** reuse ** serverEntryPath() (bundled server path); no change
    └── extension.ts           # ** update ** register `speckitAtlas.setupMcpClient`; QuickPick + clipboard; test hook
package.json                   # ** update ** contributes.commands: speckitAtlas.setupMcpClient (+ optional menu)
test/
├── contracts/mcp-setup.test.ts    # ** NEW ** pure: each client's form + quoting + npm/bundled launch
└── integration/mcp-setup.test.ts  # ** NEW ** command registered; generate-for-client hook; writes nothing
```

**Structure Decision**: Single VS Code extension project. One new pure module
(`mcpSetup.ts`, unit-tested in Node) plus a thin command handler in `extension.ts` that
reuses 007's `serverEntryPath`. `core/`, `platform/`, `mcp/`, and `cli/` untouched.

## Complexity Tracking

> No constitution violations. Section intentionally empty.
