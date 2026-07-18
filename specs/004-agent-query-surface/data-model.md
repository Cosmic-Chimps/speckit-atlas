# Phase 1 Data Model: Agent Query Surface

Feature 002's model (`SpecNode`, `RelationEdge`, `ProjectGraph`, `WorkspaceGraph`,
`GraphOptions`, `Warning`) is **reused unchanged**. The types below are what 004 adds — a
pure query layer and a versioned result envelope. All are plain, JSON-serializable, and
free of `vscode`/DOM/Node imports (they live in `src/core/query/`).

## Query inputs

### QueryKind

`"graph" | "spec" | "status" | "orphans" | "check"`

### QueryScope

The scope passed to the **pure query functions** — it filters the already-built graph:

| Field | Type | Notes |
|-------|------|-------|
| `projectId` | `string \| null` | Target one project, or all when null. |

> **Heuristic options are an adapter/build-time concern, not a query-function parameter.**
> The CLI/MCP flags (`--slug-mentions`, etc.) are `Partial<GraphOptions>` applied *before*
> the graph is built (`buildWorkspaceGraph`, feature 002). The pure query functions then
> operate on the resulting graph and take only `QueryScope` (projectId). See Q-8.

## Query outputs (data payloads)

### SpecRelationships (kind: "spec")

| Field | Type | Notes |
|-------|------|-------|
| `spec` | `SpecNode \| null` | The queried node; null ⇒ "not found". |
| `dependsOn` | `RelationEdge[]` | Edges where the spec is the source. |
| `dependedOnBy` | `RelationEdge[]` | Edges where the spec is the target. |
| `found` | `boolean` | Whether the spec id resolved. |

### StatusSummary (kind: "status")

| Field | Type | Notes |
|-------|------|-------|
| `perSpec` | `{ id; status; done; total }[]` | One row per spec (nulls where absent). |
| `aggregate` | `{ specs: number; byStatus: Record<string, number>; tasksDone: number; tasksTotal: number }` | Rollup. |

### Orphans (kind: "orphans")

| Field | Type | Notes |
|-------|------|-------|
| `orphans` | `string[]` | Ids of specs with no incident edges (sorted). |

### CheckResult (kind: "check")

| Field | Type | Notes |
|-------|------|-------|
| `rule` | `string` | e.g. `"no-orphans"`. |
| `ok` | `boolean` | Pass/fail. |
| `violations` | `string[]` | Offending spec ids (sorted). |

*(kind "graph" returns a `WorkspaceGraph` or a single `ProjectGraph` directly.)*

### QueryResult (the envelope — FR-010/011)

| Field | Type | Notes |
|-------|------|-------|
| `schemaVersion` | `1` | Explicit version. |
| `kind` | `QueryKind` | Which query produced this. |
| `data` | payload above | The result. |
| `warnings` | `Warning[]` | Aggregated model + query warnings. |

**Rules**: every collection is **sorted by stable key** (node id; edges by
source→target→heuristic); no timestamps or run metadata → identical repo + options ⇒
byte-identical JSON (SC-005). The envelope is always fully populated (never partial), even
for empty/malformed inputs (Principle II).

## Pure query functions (`src/core/query/`)

```
getGraph(graph, scope) → WorkspaceGraph | ProjectGraph
specRelationships(graph, specId, scope?) → SpecRelationships
statusSummary(graph, scope?) → StatusSummary
orphans(graph, scope?) → Orphans
runCheck(graph, rule, scope?) → CheckResult
toEnvelope(kind, data, warnings) → QueryResult
```

All total (never throw); scope filters to one project without ever crossing project
boundaries (invariant inherited from feature 002).

## Adapter-side (not core)

- **`ProjectSnapshot[]`** (feature 002 input type) is produced by `src/platform/nodeScan.ts`
  via read-only `node:fs`, then fed to `buildWorkspaceGraph` **with the heuristic
  `Partial<GraphOptions>` parsed from the flags** — the resulting graph is then queried.
- **CLI** maps a subcommand → `QueryKind` + `QueryScope` (+ options applied at build above),
  prints the envelope as JSON (or human text via `formatText`), and exits `1` when a
  `check` fails.
- **MCP** exposes one tool per `QueryKind`, returning the envelope JSON.
