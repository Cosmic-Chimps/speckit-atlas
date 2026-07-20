# Phase 1 Data Model: View Graph JSON

No new persistent entities and no new envelope shape — this feature surfaces the **existing**
004 graph envelope. The only new code artifact is a pure composition helper.

## Pure helper (`src/core/query/queries.ts`)

```ts
/**
 * Feature 014 — build the versioned graph envelope from an already-built WorkspaceGraph
 * (no scan). Composes getGraph + toEnvelope; warnings are derived from the scoped result so
 * they describe exactly the data returned. Pure, total, deterministic.
 */
export function graphEnvelope(graph: WorkspaceGraph, scope?: QueryScope): QueryResult;
```

**Algorithm**

1. `data = getGraph(graph, scope)` → a `ProjectGraph` when `scope.projectId` is set, else a
   `WorkspaceGraph` (existing behavior; both are deterministically sorted).
2. `warnings = "projects" in data ? data.projects.flatMap(p => p.warnings) : data.warnings`
   (whole-workspace → all projects' warnings; single project → that project's warnings).
3. `return toEnvelope("graph", data, warnings)`.

**Guarantees**: never throws; empty workspace → `{ schemaVersion:1, kind:"graph",
data:{projects:[]}, warnings:[] }`; identical `(graph, scope)` → byte-identical envelope
(inherits `getGraph` sorting + timestamp-free `toEnvelope`).

## Envelope produced (unchanged 004 contract)

```jsonc
{
  "schemaVersion": 1,
  "kind": "graph",
  "data": {
    // whole workspace (activeProjectId === null):
    "projects": [
      { "projectId": "<uri>", "name": "…", "nodes": [ /* SpecNode */ ], "edges": [ /* RelationEdge */ ], "warnings": [] }
    ]
    // OR a single ProjectGraph object when scoped to one project:
    // { "projectId": "<uri>", "name": "…", "nodes": [...], "edges": [...], "warnings": [...] }
  },
  "warnings": [ /* Warning[] describing the returned data */ ]
}
```

`SpecNode`, `RelationEdge`, `ProjectGraph`, `WorkspaceGraph`, `Warning`, `QueryResult`,
`QueryScope` are all existing types (features 002/004) — unchanged.

## Extension wiring (`src/extension/extension.ts`)

- New command handler `viewGraphJson()`:
  - `scope = activeProjectId && specExistsInProject(activeProjectId) ? { projectId: activeProjectId } : undefined`
    (stale/absent project → whole workspace, per R-4).
  - `const text = JSON.stringify(graphEnvelope(graph, scope), null, 2)`.
  - `const doc = await vscode.workspace.openTextDocument({ content: text, language: "json" })`.
  - `await vscode.window.showTextDocument(doc, { preview: true })`.
- New `AtlasApi.getGraphJson(): string` — returns the same string (for the integration test to
  assert contents/scope without inspecting the opened editor).

## Entities → spec mapping

| Spec entity | Realized as |
|-------------|-------------|
| **Graph JSON document** (versioned envelope: schema version + graph data + warnings) | the `QueryResult` from `graphEnvelope`, pretty-printed and opened as an untitled `json` document |
| **Export scope** (single project or whole workspace) | `QueryScope` derived from `activeProjectId` |

## What is explicitly NOT changed

- The 002 graph model and the 004 query envelope/`getGraph`/`toEnvelope` semantics (consumed, not modified).
- `platform/runQuery`, the CLI, the MCP server, the webview protocol, and the renderer.
- No new runtime dependency; `engines.vscode` stays `^1.101.0`.
