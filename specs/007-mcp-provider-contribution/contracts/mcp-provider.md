# Contract: MCP Server-Definition Provider

Feature 007. Defines the editor-facing contribution and the pure builder. The MCP tool
contract itself is unchanged — see `specs/004-agent-query-surface/contracts/`.

## Manifest contribution (package.json)

```jsonc
{
  "engines": { "vscode": "^1.101.0" },          // raised floor (D6)
  "contributes": {
    "mcpServerDefinitionProviders": [
      { "id": "speckitAtlas.mcp", "label": "SpecKit Atlas" }
    ]
  }
}
```

- The contributed `id` MUST equal the id passed to `registerMcpServerDefinitionProvider`.
- Adds no new `activationEvents` — activation stays `workspaceContains` (lazy).

## Runtime registration (extension host)

```ts
vscode.lm.registerMcpServerDefinitionProvider("speckitAtlas.mcp", {
  onDidChangeMcpServerDefinitions,          // fires on workspace-folder change
  provideMcpServerDefinitions(): vscode.McpServerDefinition[] { … },
});
```

## Pure builder (unit-testable, no vscode/fs)

```ts
buildServerDefinitions(input: {
  folders: readonly string[];   // workspace folder fs paths
  extensionPath: string;        // installed extension root
  nodePath: string;             // process.execPath
  version: string;              // extension version
}): McpServerDescriptor[]
```

## Behavioral contract

- **C-1 (per folder)**: exactly one descriptor per workspace folder; **zero folders ⇒ `[]`**
  (D4/D7).
- **C-2 (root scope)**: each descriptor's `args` include `--root <folderPath>` and `cwd` is
  that folder, so a server sees only its own folder — no cross-project results (FR-004).
- **C-3 (bundled binary)**: `args[0]` is `<extensionPath>/dist/mcp.js` (inside the installed
  extension); the file MUST be present in the packaged `.vsix` (D5).
- **C-4 (node launch)**: `command` is the provided `nodePath` (`process.execPath`) and `env`
  includes `ELECTRON_RUN_AS_NODE: "1"` (D3) — no reliance on a system Node.
- **C-5 (parity)**: because the descriptor launches the same `dist/mcp.js`, the exposed
  tools and their results are identical to the standalone `speckit-atlas-mcp` (FR-003).
- **C-6 (read-only / offline)**: the launched server uses stdio only and the read-only
  scan; no network, no writes, no telemetry (FR-005/006).
- **C-7 (lazy)**: registration performs no scan and no spawn; VS Code starts the server on
  first tool use (FR-011).
- **C-8 (change signal)**: adding/removing a workspace folder fires
  `onDidChangeMcpServerDefinitions`, so the server set stays in sync.
- **C-9 (versioned)**: each descriptor carries the extension `version` so an upgrade
  restarts the server.

## Non-goals (contract boundary)

- No change to the `atlas_*` tool names, inputs, or envelope shapes (feature 004 owns them).
- No new query semantics; no `core/`, `platform/`, or `src/mcp/main.ts` changes.
- The standalone CLI (`dist/cli.js`) remains excluded from the `.vsix`.
- No HTTP transport; stdio only.
