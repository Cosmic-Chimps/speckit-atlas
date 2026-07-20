# Contract: MCP tool `atlas_specs_for_file`

**Server**: `speckit-atlas-mcp` (`src/mcp/main.ts`), stdio only — offline, read-only, no telemetry.

## Tool definition

```jsonc
{
  "name": "atlas_specs_for_file",
  "description": "Which spec(s) reference/relate to a source file (reverse traceability). Derived from spec artifacts (feature 011), no git.",
  "inputSchema": {
    "type": "object",
    "required": ["path"],
    "properties": {
      "path": { "type": "string", "description": "File path relative to the workspace root." },
      "root": { "type": "string", "description": "Workspace root (default: server root)." },
      "projectId": { "type": "string", "description": "Scope to one project." },
      "options": { "$ref": "OPTIONS_SCHEMA" }
    }
  }
}
```

Added to the `TOOLS` array as `{ name:"atlas_specs_for_file", kind:"file", … }`; the shared
`CallToolRequestSchema` handler already forwards `args.path` into `runQuery`.

## Result

`content: [{ type:"text", text: JSON.stringify(result) }]` where `result` is the `kind:"file"`
envelope — **identical** to the CLI's JSON for the same `(root, path, projectId, options)`
(FR-008, SC-003).

## Behavior

- Missing `path` → the SDK rejects on the `required` schema (client-side validation).
- Zero matches → a valid envelope with `matches: []` (never an MCP error; FR-014).

## Tests

- List tools includes `atlas_specs_for_file` with `required:["path"]`.
- Call with a fixture `path` → parsed envelope deep-equals the CLI/core result (parity).
