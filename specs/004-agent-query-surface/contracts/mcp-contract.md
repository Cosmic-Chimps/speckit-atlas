# Contract: MCP Server (`speckit-atlas-mcp`)

A local MCP server (`dist/mcp.js`, bin `speckit-atlas-mcp`) over `@modelcontextprotocol/sdk`
using the **stdio** transport. Same core + `node:fs` scan as the CLI. Local-only (no
network), read-only, no telemetry.

## Launch

An MCP client (e.g. Claude Code / Desktop) starts it:

```jsonc
{ "speckit-atlas": { "command": "node", "args": ["<path>/dist/mcp.js", "--root", "."] } }
// or: { "command": "npx", "args": ["speckit-atlas-mcp"] }
```

## Tools (one per query; params mirror the CLI)

| Tool | Params | Returns (JSON `QueryResult`) |
|------|--------|------------------------------|
| `atlas_graph` | `{ projectId?, options? }` | `kind:"graph"` |
| `atlas_spec_relationships` | `{ specId, projectId?, options? }` | `kind:"spec"` |
| `atlas_status_summary` | `{ projectId?, options? }` | `kind:"status"` |
| `atlas_orphans` | `{ projectId?, options? }` | `kind:"orphans"` |
| `atlas_check` | `{ rule?, projectId?, options? }` | `kind:"check"` |

All tools accept an optional `root` (default: the server's `--root`/cwd).

## Behavioral contract (assertable with an in-process SDK client over stdio, plain Node)

- **MCP-1**: The server lists exactly the five tools above with valid input schemas.
- **MCP-2**: `atlas_graph` returns the same envelope the CLI's `graph` produces for the same
  root/options (both call the same core).
- **MCP-3**: `atlas_spec_relationships` with an unknown `specId` returns `found:false` (a
  normal result, not a protocol error).
- **MCP-4**: `atlas_check` returns `{ ok, violations }`; agents branch on `ok` (the server
  does not exit — it stays serving).
- **MCP-5**: The server performs **no workspace writes** and **no network** access; it reads
  specs read-only via `node:fs` and answers over stdio.
- **MCP-6**: Results are the same versioned, deterministic JSON envelope as the CLI (one
  contract, two surfaces).
- **MCP-7**: The server is resilient — a malformed workspace yields envelopes with
  `warnings`, and a bad tool call returns an error result without crashing the server.
