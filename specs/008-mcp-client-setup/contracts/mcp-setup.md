# Contract: MCP Client Setup Command + Formatter

Feature 008. The MCP tools/server are unchanged (feature 004/007). This defines the command
and the pure formatter.

## Command contribution (package.json)

```jsonc
{
  "contributes": {
    "commands": [
      { "command": "speckitAtlas.setupMcpClient", "title": "SpecKit Atlas: Set up MCP for your agent" }
    ]
  }
}
```

## Pure formatter (unit-testable, no vscode/fs)

```ts
type ClientId = "claude-code" | "cursor" | "claude-desktop" | "generic";

interface ServerLaunchSpec {
  command: string; args: string[]; env: Record<string, string>; kind: "bundled" | "npm";
}

formatRegistration(input: {
  client: ClientId;
  launch: ServerLaunchSpec;
  projectRoot: string;
  serverName: string;   // e.g. "speckit-atlas"
}): string
```

`CLIENTS: readonly ClientTarget[]` — the catalog surfaced in the QuickPick.

## Behavioral contract

- **C-1 (Claude Code)**: `client:"claude-code"` → a `claude mcp add <serverName> -- <command>
  <args…>` shell command; every argument shell-quoted so it runs verbatim (C-5).
- **C-2 (Cursor)**: `client:"cursor"` → a JSON snippet `{ "mcpServers": { "<serverName>": {
  "command", "args" } } }` for `.cursor/mcp.json`, via `JSON.stringify`.
- **C-3 (Claude Desktop)**: `client:"claude-desktop"` → the same `mcpServers` JSON block for
  `claude_desktop_config.json`.
- **C-4 (generic)**: `client:"generic"` → the raw stdio `command` + `args` (and an
  equivalent JSON stdio block) for any other MCP client.
- **C-5 (quoting)**: paths/args with spaces or special characters are quoted/escaped so the
  produced command or JSON is valid and runs as-is (FR-010).
- **C-6 (root scope)**: the emitted `args` include `--root <projectRoot>`, so the registered
  server is scoped to that folder (FR-004/FR-008).
- **C-7 (launch target)**: with `launch.kind:"bundled"`, `command` is `process.execPath`,
  `args[0]` is the bundled `dist/mcp.js`, and `env` sets `ELECTRON_RUN_AS_NODE`; the output
  also surfaces the `npm` alternative (`speckit-atlas-mcp`) (FR-003).
- **C-8 (read-only)**: producing a registration performs **no** file writes (workspace or
  global) and invokes no external write-CLI; output goes to clipboard + an untitled document
  only (FR-011).
- **C-9 (no workspace)**: with no workspace folder, the command explains what is needed and
  emits nothing (FR-007).
- **C-10 (offline)**: no network, no telemetry (FR-006).

## Non-goals (contract boundary)

- No change to `atlas_*` tools, the server, `core/`, `platform/`, or `cli/`.
- No writing of any client config file, and no running `claude mcp add` for the user.
- No new runtime dependency; no engine change.
