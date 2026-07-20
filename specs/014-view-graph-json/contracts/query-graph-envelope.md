# Contract: `graphEnvelope` pure helper

**Module**: `src/core/query/queries.ts` (exported via `src/core/query/index.ts` and `src/core/index.ts`)

## Signature

```ts
graphEnvelope(graph: WorkspaceGraph, scope?: QueryScope): QueryResult
```

## Guarantees

- **Pure & total**: no I/O, no throw, no mutation of `graph`. (Principles I, II.)
- **Deterministic**: identical `(graph, scope)` ⇒ byte-identical `QueryResult` (via `getGraph`
  sorting + timestamp-free `toEnvelope`). (SC-004.)
- **Kind**: always `"graph"`; `schemaVersion: 1`.

## Behavior

| Input | `data` | `warnings` |
|-------|--------|------------|
| no scope (or `projectId` null) | `WorkspaceGraph` (all projects, sorted) | all projects' warnings, flattened |
| `scope.projectId` set to an existing project | that `ProjectGraph` (sorted) | that project's warnings |
| `scope.projectId` set to an unknown id | empty `ProjectGraph` `{ projectId, name:id, nodes:[], edges:[], warnings:[] }` | `[]` |
| empty graph `{ projects: [] }`, no scope | `{ projects: [] }` | `[]` |

## Tests (node:test, plain Node)

- unscoped envelope wraps the whole workspace; `schemaVersion===1`, `kind==="graph"`.
- scoped envelope returns a single `ProjectGraph` in `data` and only that project's warnings.
- unknown project id → valid empty `ProjectGraph`, no throw.
- empty workspace → valid empty envelope.
- determinism: two calls deep-equal and JSON-string-equal.
- parity: `JSON.stringify(graphEnvelope(g, s))` equals the CLI/MCP `graph` envelope for the same
  built graph + scope (same shape/contract).
