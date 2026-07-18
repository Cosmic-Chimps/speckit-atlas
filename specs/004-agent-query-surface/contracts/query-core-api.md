# Contract: Query Core API

Added to `src/core/query/` (pure; no `vscode`/DOM/Node imports). All functions are pure and
total (never throw; bad input → empty/`found:false` + warnings). Types in `data-model.md`.

## Functions

```ts
export function getGraph(graph: WorkspaceGraph, scope?: QueryScope): WorkspaceGraph | ProjectGraph;
export function specRelationships(graph: WorkspaceGraph, specId: string, scope?: QueryScope): SpecRelationships;
export function statusSummary(graph: WorkspaceGraph, scope?: QueryScope): StatusSummary;
export function orphans(graph: WorkspaceGraph, scope?: QueryScope): Orphans;
export function runCheck(graph: WorkspaceGraph, rule: string, scope?: QueryScope): CheckResult;
export function toEnvelope<K extends QueryKind>(kind: K, data: unknown, warnings: readonly Warning[]): QueryResult;
```

## Behavioral contract (assertable in `test/core`, plain Node)

- **Q-1**: `getGraph` with `scope.projectId` returns only that project; with null returns all
  projects; never includes cross-project edges.
- **Q-2**: `specRelationships` returns `dependsOn` = edges with `source === specId`,
  `dependedOnBy` = edges with `target === specId`, each carrying tier/weight/evidence;
  an unknown id → `{ found: false, spec: null, dependsOn: [], dependedOnBy: [] }` (no throw).
- **Q-3**: `statusSummary.perSpec` has one row per spec with status + done/total (nulls where
  absent); `aggregate.byStatus` counts match.
- **Q-4**: `orphans` returns exactly the specs with no incident edge (source or target),
  sorted; a fully-connected project returns `[]`.
- **Q-5**: `runCheck(graph, "no-orphans")` → `ok:false` with `violations` = the orphan ids
  when any exist, else `ok:true` with `[]`. An unknown rule → `ok:true` with a warning (fails
  open, documented) OR a distinct error result — **documented behavior, not a throw**.
- **Q-6**: Every output collection is deterministically **sorted**; `toEnvelope` output
  round-trips through JSON unchanged and is byte-identical for identical inputs (SC-005).
- **Q-7**: All functions are total on empty/malformed graphs (empty results + warnings),
  never throwing (Principle II).
- **Q-8**: Heuristic option overrides are applied **upstream** by the adapter (via feature
  002's `buildWorkspaceGraph`) before querying; the pure query functions operate only on the
  already-built graph they are given and a `QueryScope` (projectId) — they do not take or
  apply `GraphOptions` themselves.
