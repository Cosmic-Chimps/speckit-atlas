# Phase 1 Data Model: Graph Rendering

This feature is a view layer. The **graph data** (`SpecNode`, `RelationEdge`,
`ProjectGraph`, `WorkspaceGraph`, `GraphOptions`) is owned by feature 002 and consumed
**unchanged**. The types below are the view-side / message-protocol shapes 003 adds.
They are plain and JSON-serializable (they cross `postMessage`).

## View-state entities

### ViewOptions

The current control state the sidebar expresses; maps onto feature 002's `GraphOptions`.

| Field | Type | Notes |
|-------|------|-------|
| `graphOptions` | `GraphOptions` | Which heuristics are enabled (links locked on). Drives a model rebuild. |
| `filterTier` | `EdgeTier[] \| null` | Optional visual filter/highlight by tier (null = all). |
| `filterStatus` | `string[] \| null` | Optional filter/highlight by implementation status. |
| `focusNodeId` | `string \| null` | Node to center/highlight (from search or the spec list). |
| `activeProjectId` | `string \| null` | For multi-root: which sub-graph the map shows (null = all). |

### PanelState (in the map webview)

| Field | Type | Notes |
|-------|------|-------|
| `pan` | `{ x: number; y: number }` | Current pan offset (captured/restored across updates). |
| `zoom` | `number` | Current zoom (captured/restored). |
| `selectedNodeId` | `string \| null` | Selected node (captured/restored). |

Not persisted to the workspace (Principle III); lives only in the webview for the
session and is preserved across incremental re-renders (SC-003).

### NodeDetail (host → panel, on selection)

Derived entirely from the `SpecNode` already in the model — no new data source.

| Field | Type |
|-------|------|
| `id`, `title`, `status`, `taskCompletion`, `completeness`, `warnings` | from `SpecNode` |

## Message protocol (extends feature 001's `webview/protocol.ts`)

### Host → Map panel

```ts
type HostToPanel =
  | { type: "render"; graph: WorkspaceGraph; options: GraphOptions; activeProjectId: string | null }
  | { type: "focus"; nodeId: string } // center/highlight a node
  | { type: "filter"; filterTier: EdgeTier[] | null; filterStatus: string[] | null }; // visual dim/hide
```

### Map panel → Host

```ts
type PanelToHost =
  | { type: "ready" }
  | { type: "rendered"; nodeCount: number; edgeCount: number; ok: boolean } // render diagnostics
  | { type: "openSpec"; nodeId: string; projectId: string } // read-only navigation
  | { type: "selectNode"; nodeId: string | null }; // for detail display / sync
```

### Host → Controls (sidebar)

```ts
type HostToControls = {
  type: "state";
  options: GraphOptions;
  projects: { id: string; name: string }[];
  specs: { id: string; projectId: string; title: string; status: string | null }[];
  activeProjectId: string | null;
};
```

### Controls → Host

```ts
type ControlsToHost =
  | { type: "ready" }
  | { type: "setOption"; key: keyof GraphOptions; value: boolean } // never disables `links`
  | { type: "selectProject"; projectId: string | null }
  | { type: "focusSpec"; nodeId: string } // search/list selection
  | { type: "setFilter"; filterTier: EdgeTier[] | null; filterStatus: string[] | null }; // visual filter
```

## Flow & rules

```
watcher/activation → host builds WorkspaceGraph (feature 002) with current GraphOptions
   → posts `render` to panel  AND  `state` to controls
controls `setOption` → host rebuilds graph with new options → posts `render` (panel) + `state`
panel `openSpec` → host resolves {projectId,nodeId} → opens spec.md read-only (graceful if missing)
panel `selectNode` → host may relay detail; controls `focusSpec` → host posts `focus` to panel
controls `setFilter` → host posts `filter` to panel → panel dims/hides non-matching nodes/edges
panel `rendered` → host records diagnostics (node/edge counts, cytoscape-init ok) — test/telemetry-free hook
single spec file change → debounced → incremental per-feature re-parse → rebuild → `render`
```

- **Invariant**: neither webview reads the file system or the network; both only render
  what the host posts and emit intent back (Principles I & VI).
- **Invariant**: `render` never contains cross-project edges (guaranteed by 002).
- **Invariant**: an incremental `render` preserves the panel's `PanelState`
  (pan/zoom/selection) — SC-003.
- **`MapViewState`**: this feature drives the previously-reserved `"ready"` state when a
  non-empty graph is present.
