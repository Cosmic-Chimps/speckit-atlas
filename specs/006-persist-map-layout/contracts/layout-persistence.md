# Contract: Layout Persistence (host ↔ webview)

Feature 006. Extends the feature-003 `postMessage` contracts in `src/webview/protocol.ts`.
All fields are additive and backward-compatible; existing messages keep working.

## Message additions

### `HostToPanel` — extend `render`, add `relayout`

```ts
// render gains two optional fields (omitted/null ⇒ behave as feature 003 today):
{
  type: "render";
  graph: WorkspaceGraph;
  options: GraphOptions;
  activeProjectId: string | null;
  savedPositions?: Record<string, { x: number; y: number }> | null; // for activeProjectId's bucket
  savedViewport?: { pan: { x: number; y: number }; zoom: number } | null;
}

// new: reset — discard seeded positions and run a fresh cose
{ type: "relayout" }
```

### `PanelToHost` — add `persistLayout`

```ts
{
  type: "persistLayout";
  projectId: string;                 // the bucket these positions belong to ("__all__" for all-projects view)
  positions: Record<string, { x: number; y: number }>; // nodeId → position
  viewport: { pan: { x: number; y: number }; zoom: number };
}
```

### `ControlsToHost` — add `resetLayout`

```ts
{ type: "resetLayout" }               // clears the active project's saved layout, triggers relayout
```

## Behavioral contract

- **C-1 (restore)**: When `render` carries `savedPositions` covering **all** current
  nodes, the webview MUST place nodes with `layout({ name: "preset" })` — no `cose`, no
  drift (SC-001). If `savedViewport` is present, apply it after layout (FR-003).
- **C-2 (partial)**: When some current nodes lack a saved position, the webview MUST keep
  saved nodes at their saved positions and lay out only the new nodes (FR-006). Zero saved
  nodes move (SC-003).
- **C-3 (empty/absent)**: When `savedPositions` is null/empty, the webview MUST run the
  existing `cose` layout (unchanged feature-003 behavior).
- **C-4 (report)**: On `dragfree`, `layoutstop`, and settled pan/zoom, the webview MUST
  emit a **debounced** `persistLayout` for the current view. It MUST NOT emit on every
  animation frame (Principle IV).
- **C-5 (persist)**: On `persistLayout`, the host MUST merge into
  `workspaceState["speckitAtlas.mapLayout"]`, prune stale nodeIds (FR-007), and write —
  and MUST NOT write any workspace file (FR-011).
- **C-6 (reset)**: On `resetLayout`, the host MUST clear the active project's bucket and
  post `relayout`; the webview MUST run a fresh `cose` and (via C-4) re-persist the result.
- **C-7 (resilience)**: A missing, malformed, or version-mismatched store MUST be treated
  as empty and MUST NOT throw or blank the panel (FR-009).
- **C-8 (privacy)**: No message field carries file contents; persistence is local to the
  Memento; no network, no telemetry (Principle VI). The CSP/nonce shell is unchanged.

## Non-goals (contract boundary)

- No change to `core/` types or the graph model.
- No cross-project position sharing; buckets are isolated by `projectId`.
- No persistence of selection or filter state (out of scope; only positions + viewport).
