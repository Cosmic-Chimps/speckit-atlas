# Contract: `specsForFile` pure query + `"file"` envelope

**Module**: `src/core/query/queries.ts` (exported via `src/core/query/index.ts` and `src/core/index.ts`)

## Signature

```ts
specsForFile(graph: WorkspaceGraph, path: string, scope?: QueryScope): SpecsForFile
```

## Guarantees

- **Pure & total**: no I/O, no throw, no mutation of `graph`. (Principles I, II.)
- **Deterministic**: identical `(graph, path, scope)` ⇒ byte-identical result. (SC-004.)
- **Read-only data source**: derives only from `SpecNode.codeReferences`. No git, no fs, no network. (Principle III/VI, FR-002.)

## Behavior

| Input | Output |
|-------|--------|
| `path` matching a node's `codeReferences` exactly (after normalization) | `{ path: <normalized>, matches: [{…, matchKind:"exact"}, …] }` |
| `path` with **no** exact match but whose containing dir prefixes some ref | folder matches only: `matchKind:"folder"` |
| `path` with neither | `{ path:<normalized>, matches: [] }` |
| empty / whitespace `path` | `{ path:"", matches: [] }` |
| root-level file (no `/`) with no exact match | `{ matches: [] }` — **no** folder fallback (dir is empty) |
| `scope.projectId` set | matches restricted to that project; `projectId` never crosses (FR-006) |
| nodes without `codeReferences` (`specToCode` off / none) | contribute nothing |

## Ordering (stable)

`matchKind` (`exact` before `folder`) → `projectId` (localeCompare) → `specId` (localeCompare).

## Envelope

```jsonc
{
  "schemaVersion": 1,
  "kind": "file",
  "data": {
    "path": "src/core/graph/parseFeature.ts",
    "matches": [
      { "specId": "002-spec-graph-model", "projectId": "<folder-uri>", "title": "Spec Graph Model", "status": "done", "matchKind": "exact" },
      { "specId": "009-folder-name-identity", "projectId": "<folder-uri>", "title": "Folder Name Identity", "status": "planned", "matchKind": "exact" }
    ]
  },
  "warnings": []
}
```

## Tests (node:test, plain Node)

- exact single / exact multiple (multi-spec) ordering
- folder fallback fires only when no exact match; labeled `folder`
- root-level file → no fallback → empty
- path normalization: `./src/a.ts`, `..\\src\\a.ts`, `src/a.ts` all match a stored `src/a.ts`
- `scope.projectId` isolates a project; same path in two projects does not conflate
- `specToCode` off (no `codeReferences`) → empty
- determinism: two calls deep-equal; JSON stable
