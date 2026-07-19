# Research: MCP Setup for Any Agent Client

Feature 008. Resolves the technical choices behind the plan. No unresolved
`NEEDS CLARIFICATION` remain (the write-scope question was settled in the spec).

## D1 — Deliver via a command that generates, never writes

**Decision**: A single command, `speckitAtlas.setupMcpClient` ("SpecKit Atlas: Set up MCP
for your agent"), that produces the registration and **copies it to the clipboard + shows
it** (an info message and/or an untitled editor). It writes no files and runs no client
write-CLI.

**Rationale**: The resolved spec decision (Read-Only). Clipboard + untitled documents are
not workspace files, so Principle III holds with no amendment. A command is discoverable in
the palette and cheap to register.

**Alternatives considered**:
- *One-click write to `.mcp.json`/`.cursor/mcp.json`* — breaches Read-Only, needs a
  constitution amendment. Rejected per the spec decision.
- *Run `claude mcp add` on the user's behalf* — that CLI writes config; doing it for the
  user is still an indirect write. Rejected; we output the command for the user to run.

## D2 — A pure `formatRegistration` is the whole feature

**Decision**: `formatRegistration({ client, launch, projectRoot, serverName }): string` in
a pure `src/extension/mcpSetup.ts` (no `vscode`), plus a `CLIENTS` catalog. The thin
command handler only gathers inputs (folder, client) and presents the output.

**Rationale**: All the correctness lives in the string shapes and quoting — exactly what a
pure, table-driven unit test covers. Keeps the shell thin (Principle I).

## D3 — Per-client output forms

**Decision**: Support these forms (FR-002):

| Client | Output |
|--------|--------|
| Claude Code | a `claude mcp add <name> -- <command> <args…>` shell command |
| Cursor | a `.cursor/mcp.json` JSON snippet (`{ "mcpServers": { "<name>": { "command", "args" } } }`) |
| Claude Desktop | a `claude_desktop_config.json` JSON block (same `mcpServers` shape) |
| Other (generic) | the raw stdio `command` + `args` (and an equivalent JSON stdio block) |

**Rationale**: These are the shapes each client documents; emitting the client's own format
is what removes the friction (FR-002/SC-002). The generic form covers everything else.

**Alternatives considered**: a single generic blob for all — forces the user to translate;
defeats the "seconds" goal. Rejected as the only output (kept as the "Other" option).

## D4 — Server launch target: bundled by default, npm form offered

**Decision**: The primary launch spec is the **bundled server** — `command =
process.execPath`, `args = [<extensionPath>/dist/mcp.js, "--root", <folder>]`, `env =
{ ELECTRON_RUN_AS_NODE: "1" }` — reusing `mcpProvider.serverEntryPath`. The output **also
includes** the `speckit-atlas-mcp --root <folder>` npm form as a labeled alternative for
users who installed the package.

**Rationale**: The bundled path is guaranteed to exist in the installed extension, so the
config works with **zero** extra install (FR-003/SC-003) and needs no fragile PATH probing.
Offering the npm form satisfies "use it if you have it" without the extension having to
detect global bins at runtime (which is I/O-heavy and unreliable).

**Alternatives considered**:
- *Probe `PATH` for `speckit-atlas-mcp` and branch* — brittle across shells/managers and
  adds process I/O. Rejected in favor of "bundled default + npm alternative shown".

## D5 — Quoting / escaping (FR-010)

**Decision**: JSON forms use `JSON.stringify` (correct by construction). The Claude Code
shell command shell-quotes each argument (wrap in single quotes, escaping embedded quotes)
so a path with spaces or special characters runs verbatim.

**Rationale**: Paths like `/Users/j j/…/dist/mcp.js` must not break the pasted command.
Pure, unit-tested.

## D6 — Multi-root & no-workspace handling

**Decision**: If multiple workspace folders are open, the command shows a folder QuickPick
(or emits one registration per folder); each registration is scoped to that folder's root
(FR-008). If no workspace folder is open, the command shows an explanatory message and
produces nothing (FR-007).

**Rationale**: Keeps the registration scoped and correct; degrades clearly.

## D7 — Discoverability

**Decision**: Register the command in `contributes.commands` (palette) with a friendly
title. Optionally add a small "Connect an agent" affordance in the controls sidebar that
invokes the command (nice-to-have; the command is the contract).

**Rationale**: Palette is the baseline; a sidebar entry raises discoverability without new
architecture. Kept optional so the core stays a single command.

## D8 — Determinism & testability

**Decision**: `formatRegistration` is deterministic given its inputs. A test hook
(`generateMcpRegistration(client, folder?)`) exposes the exact string the command would
produce, so integration tests assert output and that **no file was written** — without
driving QuickPick UI.

**Rationale**: Same pattern as 006/007's test hooks; deterministic, no UI automation.

## Summary of decisions

| ID | Decision |
|----|----------|
| D1 | One command; generate + copy/show; write nothing (Read-Only). |
| D2 | Pure `formatRegistration` + `CLIENTS` catalog carry all correctness. |
| D3 | Per-client forms: Claude Code cmd, Cursor JSON, Claude Desktop JSON, generic stdio. |
| D4 | Bundled server by default (guaranteed present); npm form shown as alternative. |
| D5 | JSON via `JSON.stringify`; shell-quote the Claude Code command (spaces-safe). |
| D6 | Multi-root → folder QuickPick/per-folder; no workspace → explain, emit nothing. |
| D7 | Palette command; optional sidebar "Connect an agent" affordance. |
| D8 | Deterministic formatter + a generate-for-client test hook; asserts no writes. |
