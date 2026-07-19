# Research: In-Editor MCP Auto-Discovery

Feature 007. Resolves the technical choices behind the plan. No unresolved
`NEEDS CLARIFICATION` remain (the editor-floor question was settled in the spec).

## D1 — Discovery mechanism

**Decision**: Use VS Code's **MCP server-definition provider** extension point — declare
`contributes.mcpServerDefinitionProviders: [{ id: "speckitAtlas.mcp", label: "SpecKit
Atlas" }]` in the manifest and call `vscode.lm.registerMcpServerDefinitionProvider(
"speckitAtlas.mcp", provider)` at activation. The provider returns the server
definition(s); VS Code registers them in its MCP registry, and the built-in agent (and any
agent reading that registry) discovers the tools with no user action.

**Rationale**: This is the *only* native path that makes tools appear on install with zero
config (FR-009). It is the API the spec targets and the resolved editor-floor is set to.

**Alternatives considered**:
- *Tell users to run `claude mcp add …` / edit `mcp.json`* — that is exactly the manual
  step this feature removes. Rejected.
- *`vscode.lm.registerTool` (Language Model Tools API)* — exposes tools to VS Code's own
  chat but not as an MCP server discoverable by other MCP clients, and would duplicate the
  server logic. Rejected in favor of advertising the real MCP server.

## D2 — Advertise the existing server, don't write a new one

**Decision**: Point the provider at the **already-built `dist/mcp.js`** (the feature-004
stdio server). Return an `McpStdioServerDefinition` whose command runs that binary.

**Rationale**: Parity (FR-003, SC-002) becomes structural, not something to re-assert — the
in-editor tools *are* the standalone server: same `runQuery`, same five `atlas_*` tools,
same envelopes. Zero divergence risk, no second codebase.

**Alternatives considered**:
- *An in-process server inside the extension host* — VS Code's MCP model expects a server
  reachable over stdio/HTTP, not an in-process object; and it would fork the tool logic.
  Rejected.
- *A trimmed editor-only server* — needless divergence from the npm server. Rejected.

## D3 — How to launch the stdio server without requiring system Node

**Decision**: Spawn via **`process.execPath` with `env.ELECTRON_RUN_AS_NODE = "1"`**, args
`[<extPath>/dist/mcp.js, "--root", <folder>]`. `process.execPath` is the runtime VS Code
already ships; `ELECTRON_RUN_AS_NODE` makes it behave as plain Node.

**Rationale**: No dependency on a user-installed Node (FR-010 — installing the extension
provides everything the server needs). Works offline and on every desktop VS Code.

**Alternatives considered**:
- *Assume `node` on `PATH`* — fragile; many users lack a global Node, or have a mismatched
  version. Rejected.
- *Ship a Node binary in the vsix* — huge size blow-up; unnecessary given `process.execPath`.
  Rejected.

## D4 — One server per workspace folder (multi-root scoping)

**Decision**: `provideMcpServerDefinitions()` returns **one `McpStdioServerDefinition` per
workspace folder**, labeled with the folder name, each launched with `--root <folderPath>`
and `cwd` set to that folder. Zero folders → return `[]`.

**Rationale**: Satisfies FR-004 (per-project scoping, no cross-project results) naturally —
each server only scans its own folder. The tools additionally accept `projectId`/`root`
args (unchanged), so finer scoping still works. Matches the standalone server's `--root`
model.

**Alternatives considered**:
- *A single server with no root / cwd-based root* — in a multi-root workspace it would see
  only one folder, missing the others. Rejected.
- *A single server that internally enumerates all roots* — would require changing the
  server/query semantics (currently one `--root`). Rejected to keep `core/`+server
  unchanged.

## D5 — Ship `dist/mcp.js` in the `.vsix`; keep the CLI out

**Decision**: Remove `dist/mcp.js` (and its map) from `.vscodeignore` so it packages into
the vsix. Keep `dist/cli.js` excluded (the CLI has no in-editor role).

**Rationale**: The provider needs the binary present at a known path inside the installed
extension (`context.extensionUri`/`extensionPath`). This reverses the feature-004
"bins excluded" decision *for the MCP server only*, as the spec accepted.

**Size check**: prod `dist/mcp.js` ≈ 565 KB. With `extension.js` (~18 KB), `media/map.js`
(~441 KB), `media/controls.js` (~6 KB) and small media assets, the packaged `.vsix` stays
well under the ≤ 2 MB budget. The plan's Definition-of-done includes a `vsce ls` / size
assertion.

## D6 — Engine floor → `^1.101.0`

**Decision**: Raise `engines.vscode` from `^1.90.0` to **`^1.101.0`** (the release that
stabilized the MCP server-definition provider API). Single code path, always registers.

**Rationale**: The resolved spec decision (US chose "raise the floor"). Editors below can't
install (normal manifest compatibility), so there is no capability-absent branch; those
users keep full functionality via the npm CLI/MCP (FR-007/FR-012). `@vscode/test-electron`
already runs a version ≥ 1.101 (observed 1.129.x), so the new API is exercised in CI.

**Alternatives considered**: keep `^1.90` + conditional `typeof vscode.lm.registerMcpServer
DefinitionProvider === "function"` guard — more code paths, and the user explicitly chose
the simpler raise. Recorded but not taken.

## D7 — No-workspace / no-specs behavior

**Decision**: A workspace folder with no Spec Kit specs → the tools return an **empty
envelope** (this is already how `runQuery` behaves on an empty scan — SC-005/FR-008). With
**no folder open at all**, the provider returns `[]` (no server to root), which surfaces no
tools rather than a broken one.

**Rationale**: Keeps "callable, returns empty" for the realistic case (a folder open with
no specs) while avoiding a rootless server. Never throws, never crashes.

## D8 — Coexistence with a manually-registered standalone server

**Decision**: The provider id and definition label are namespaced (`speckitAtlas.mcp` /
"SpecKit Atlas"). If a user *also* added `speckit-atlas-mcp` by hand, both appear; they are
independent stdio processes over the same read-only core, so there is no shared state to
corrupt (FR-013).

**Rationale**: Read-only + separate processes ⇒ safe duplication; the only cost is two
identical tool sets, which the user can prune.

## Summary of decisions

| ID | Decision |
|----|----------|
| D1 | VS Code MCP server-definition provider (`contributes` + `lm.registerMcpServerDefinitionProvider`). |
| D2 | Advertise the existing `dist/mcp.js`; do not write a second server (parity for free). |
| D3 | Launch via `process.execPath` + `ELECTRON_RUN_AS_NODE=1` (no system Node needed). |
| D4 | One `McpStdioServerDefinition` per workspace folder, `--root <folder>`; `[]` when none. |
| D5 | Ship `dist/mcp.js` in the vsix; keep `dist/cli.js` excluded; `.vsix` ≤ 2 MB. |
| D6 | Raise `engines.vscode` → `^1.101.0` (resolved spec decision). |
| D7 | Empty scan → empty envelope; no folders → no server definitions. |
| D8 | Namespaced provider; safe coexistence with a hand-registered standalone server. |
