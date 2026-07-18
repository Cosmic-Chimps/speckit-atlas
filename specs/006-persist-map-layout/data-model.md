# Data Model: Persist Map Layout Across Close/Reopen

Feature 006. These are **shell/rendering** types (host + webview + protocol). Pure
`core/` is unchanged — the graph model does not carry positions.

## Entities

### NodePosition

A single node's saved 2-D placement.

| Field | Type | Notes |
|-------|------|-------|
| `x` | `number` | Cytoscape model x. |
| `y` | `number` | Cytoscape model y. |

Keyed externally by `nodeId` (feature slug) within a project bucket.

### Viewport

The saved pan/zoom for a project's map.

| Field | Type | Notes |
|-------|------|-------|
| `pan` | `{ x: number; y: number }` | Cytoscape pan. |
| `zoom` | `number` | Cytoscape zoom (> 0). |

### ProjectLayout

One project's saved arrangement.

| Field | Type | Notes |
|-------|------|-------|
| `positions` | `Record<string, NodePosition>` | Keyed by `nodeId`. Stale ids pruned on save. |
| `viewport` | `Viewport \| null` | Last known pan/zoom; `null` until first report. |

### SavedMapLayout (persisted root)

The entire persisted document, stored in `context.workspaceState` under
`speckitAtlas.mapLayout`.

| Field | Type | Notes |
|-------|------|-------|
| `version` | `number` | Schema version (start at `1`). Unknown/absent version → discard and re-layout (resilience, FR-009). |
| `projects` | `Record<string, ProjectLayout>` | Keyed by `projectId`. `"__all__"` bucket for the all-projects view. |

**Validation / resilience rules**
- Missing key, non-object payload, wrong `version`, or `projects` not an object →
  treat as empty (`{}`) and fall back to `cose`. Never throw (FR-009).
- On save, drop any `positions` entry whose `nodeId` is absent from the current graph
  for that project (FR-007), and any `projectId` bucket with no positions.
- `zoom` must be finite and `> 0`; `x`/`y` must be finite. Non-finite entries are
  dropped, not applied.

## Storage

- **Medium**: `ExtensionContext.workspaceState` (Memento) — editor storage, not a
  workspace file (Principle III). Single key `speckitAtlas.mapLayout`.
- **Scope**: per workspace; survives Map-tab close/reopen and editor restart.
- **Writer**: host `layoutStore.ts` only. The webview never writes storage; it reports
  positions via `postMessage`.

## Relationships

```text
SavedMapLayout
  └─ projects: Record<projectId, ProjectLayout>
        ├─ positions: Record<nodeId, NodePosition>   # (projectId, nodeId) composite key
        └─ viewport: Viewport | null
```

`nodeId` ↔ the id in `CyNodeData.id`; `projectId` ↔ `CyNodeData.projectId`. Both already
exist in the feature-003 element model, so no identity changes are needed.

## Lifecycle / state transitions

| Trigger | Effect on store |
|---------|-----------------|
| Webview `dragfree` / `layoutstop` / viewport-end (debounced) | Host merges reported positions+viewport into the project bucket; prunes stale ids; writes Memento. |
| Map (re)open | Host reads Memento; sends `savedPositions`+`savedViewport` for the active project in `render`. |
| New spec appears (no saved position) | Node placed by subset-`cose`/centroid; on settle, `layoutstop` persists it. Existing saved nodes untouched. |
| Spec removed | Its position pruned on the next save; never applied on restore. |
| Active project switched | Host sends that project's bucket; each project's arrangement independent. |
| Reset layout | Host clears the active project's bucket, posts `relayout`; webview re-runs `cose`; settled result re-persisted. |
| Corrupt/absent store | Treated as empty → `cose`; no error surfaced. |
