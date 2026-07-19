# Data Model: In-Editor MCP Auto-Discovery

Feature 007. These are **editor-shell** types (a provider + the definitions it emits). No
`core/`, query, or MCP-tool schema changes — the tools and their I/O are feature 004's,
unchanged.

## Entities

### McpServerDescriptor (pure, our type)

The pure, serializable description the builder produces from a workspace folder; the
adapter maps each to a `vscode.McpStdioServerDefinition`.

| Field | Type | Notes |
|-------|------|-------|
| `label` | `string` | Human name shown in the editor's MCP list (e.g. `SpecKit Atlas — <folder>`). |
| `command` | `string` | The Node-capable executable (`process.execPath`). |
| `args` | `string[]` | `[<extPath>/dist/mcp.js, "--root", <folderPath>]`. |
| `cwd` | `string` | The workspace folder path. |
| `env` | `Record<string, string>` | `{ ELECTRON_RUN_AS_NODE: "1" }`. |
| `version` | `string` | Extension version — lets the editor restart the server on upgrade. |

**Validation / rules**
- One descriptor **per workspace folder**; no folders → empty list (D4/D7).
- `args[0]` MUST resolve inside the installed extension (from `extensionUri`), never an
  absolute path outside it.
- Pure builder: no `vscode`, `fs`, or process access — inputs (folder paths, extension
  path, node path, version) in; descriptors out. Unit-tested in Node.

### Query tool (unchanged — feature 004)

Enumerated for reference; not modified here. Each is read-only and accepts an optional
`root`/`projectId` scope.

| Tool | Kind | Purpose |
|------|------|---------|
| `atlas_graph` | graph | The spec-relationship graph for a project (or all). |
| `atlas_spec_relationships` | spec | A spec's dependsOn / dependedOnBy (tier/weight/evidence). |
| `atlas_status_summary` | status | Implementation-status / completeness summary. |
| `atlas_orphans` | orphans | Specs with no relationships. |
| `atlas_check` | check | Evaluate a rule (default `no-orphans`) → `{ ok, violations }`. |

## Relationships

```text
workspace folders ──(buildServerDefinitions)──► McpServerDescriptor[]
        │                                              │  (adapter → vscode.McpStdioServerDefinition)
        └── each folder is one server, --root=folder   ▼
                                          VS Code MCP registry ──► in-editor agent ──► atlas_* tools
                                                                                         │ (dist/mcp.js → runQuery)
                                                                                         ▼
                                                                          pure core + read-only node:fs scan
```

## Lifecycle / state transitions

| Trigger | Effect |
|---------|--------|
| Extension activates in a workspace | Register the provider; `provideMcpServerDefinitions()` returns one descriptor per folder. |
| Agent first uses a tool | VS Code lazily spawns `dist/mcp.js --root <folder>`; the server answers over stdio. |
| Workspace folders change | Provider fires `onDidChangeMcpServerDefinitions`; the editor re-queries and updates the server set. |
| Folder has no specs | Tools return an empty envelope (no error). |
| No folders open | Provider returns `[]`; no server surfaced. |
| Extension upgraded | `version` change prompts the editor to restart the server. |
| Editor below `^1.101.0` | Manifest prevents install; npm channel remains. |
