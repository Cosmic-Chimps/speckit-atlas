# Data Model: MCP Setup for Any Agent Client

Feature 008. Editor-shell types only (a pure formatter + a command). No `core/`, query, or
server changes — the server is feature 004/007's, unchanged.

## Entities

### ClientTarget

A supported agent client and the shape it wants its registration in.

| Field | Type | Notes |
|-------|------|-------|
| `id` | `"claude-code" \| "cursor" \| "claude-desktop" \| "generic"` | Selected in the QuickPick. |
| `label` | `string` | Human name shown in the picker. |
| `format` | `"shell" \| "json"` | How its registration is rendered. |
| `hint` | `string` | Where the user applies it (e.g. "run in a terminal", "add to `.cursor/mcp.json`"). |

### ServerLaunchSpec

How to launch the read-only query server (same as feature 007's descriptor, minus the VS
Code wrapper).

| Field | Type | Notes |
|-------|------|-------|
| `command` | `string` | `process.execPath` (bundled) or `"speckit-atlas-mcp"` (npm). |
| `args` | `string[]` | bundled: `[<dist/mcp.js>, "--root", <root>]`; npm: `["--root", <root>]`. |
| `env` | `Record<string,string>` | bundled: `{ ELECTRON_RUN_AS_NODE: "1" }`; npm: `{}`. |
| `kind` | `"bundled" \| "npm"` | Which target this spec describes. |

### RegistrationOutput

What the command produces for the user.

| Field | Type | Notes |
|-------|------|-------|
| `client` | `ClientTarget["id"]` | The chosen client. |
| `serverName` | `string` | The MCP server name to register (e.g. `speckit-atlas`). |
| `snippet` | `string` | The copy-ready registration text (shell command or JSON). |
| `applyHint` | `string` | One line telling the user where to paste/run it. |

**Validation / rules**
- Pure `formatRegistration({ client, launch, projectRoot, serverName })` → `snippet` string;
  deterministic; no `vscode`/`fs`/process imports.
- JSON forms produced with `JSON.stringify` (valid by construction); the Claude Code shell
  command shell-quotes every argument (FR-010).
- `projectRoot` is a real workspace folder path; multi-root → one output per chosen folder.
- The bundled `ServerLaunchSpec.args[0]` resolves under the installed extension path.

## Relationships

```text
workspace folder ─┐
client choice ────┼─► command handler ─► ServerLaunchSpec (bundled, reusing serverEntryPath)
                  │                         │
                  └─► formatRegistration(client, launch, root, name)  [pure]
                                            ▼
                                     RegistrationOutput.snippet ─► clipboard + untitled doc
                                            │  (user applies it)
                                            ▼
                                     the user's MCP client ─► atlas_* tools (dist/mcp.js)
```

## Lifecycle / state transitions

| Trigger | Effect |
|---------|--------|
| User runs `speckitAtlas.setupMcpClient` | Resolve folder(s); pick client; build launch spec; format; copy + show. |
| No workspace folder open | Show an explanatory message; produce nothing (FR-007). |
| Multi-root workspace | QuickPick a folder (or emit per-folder); each scoped to its root (FR-008). |
| Unknown/"Other" client | Emit the generic stdio form (FR-002). |
| Command completes | Snippet on clipboard + shown; **no file written** (FR-011). |
