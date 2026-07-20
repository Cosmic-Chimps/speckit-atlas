# Phase 1 Data Model: Modified-files list in the detail panel

No new persisted entities. This feature adds one transient field to the renderer's node data and one
message type; both derive from existing model shapes. All shapes remain plain and JSON-serializable.

## Existing shapes reused (no change)

- **`Reference` (`core/model/types.ts`)** — a `code`-kind reference: `{ kind: "code", targetHint:
  <path>, evidence: <path>, count }`. Produced by `extractCodeReferences`.
- **`SpecNode.codeReferences?: readonly string[]` (`core/model/types.ts`)** — de-duplicated code
  paths for a spec, present when `specToCode` is on (Decision D2). Already populated by `toNode`;
  **no change to when/how it is set.**

## Changed shape: `CyNodeData` (`webview/map/elements.ts`, pure)

Add one field:

| Field | Type | Notes |
|-------|------|-------|
| `files` | `readonly string[]` | Workspace-relative source paths for this spec, **de-duplicated** and **sorted ascending by file name** (final segment, case-insensitive; full-path tiebreak). Empty array when the spec references none (or `specToCode` is off). |

- **Population**: in `nodeElement(node)`, `files = sortFilesByName(dedupe(node.codeReferences ?? []))`.
- **Purity**: computed by a new pure helper in `elements.ts`; no `vscode`/DOM imports; unit-tested in
  plain Node.

### `sortFilesByName` (pure helper) — contract

- **Input**: `readonly string[]` (may contain duplicates, mixed case, nested paths).
- **Output**: new `string[]`, each input path at most once, ordered by:
  1. `basename.toLocaleLowerCase()` ascending (basename = segment after the last `/`),
  2. then full path (`localeCompare`) as a stable tiebreak.
- **Total**: never throws; empty in ⇒ empty out.

## Changed shape: protocol `PanelToHost` (`webview/protocol.ts`)

Add one variant:

```ts
| { readonly type: "openFile"; readonly path: string; readonly projectId: string }
```

- `path` — the workspace-relative path exactly as listed (one of `CyNodeData.files`).
- `projectId` — the owning project's id (same value already carried on `openSpec`), so the host
  resolves against the correct root in a multi-root workspace.
- **No `HostToPanel` change** — the file list itself rides the existing `render` payload (the panel
  already receives the full graph and rebuilds `CyNodeData`).

## Detail-panel view state (`webview/map/main.ts`)

`showDetail(data: CyNodeData)` renders, after the existing Status/Tasks/Artifacts lines and before or
after "Open spec":

- A section heading (e.g. `Files`).
- If `data.files.length > 0`: a list; each item is an activatable element that posts
  `{ type: "openFile", path, projectId: data.projectId }`. The item shows the path (long paths wrap
  or elide via CSS; see FR edge cases). List scrolls within the panel.
- If `data.files.length === 0`: a neutral empty state ("No source files referenced").

`showEdgeDetail` is **unchanged** — the Files section never appears for edge selections (FR-005).

## Validation rules (from requirements)

| Rule | Source | Where enforced |
|------|--------|----------------|
| Ordered ascending by file name, deterministic | FR-002, SC-002 | `sortFilesByName` (pure, unit-tested) |
| Each file at most once | FR-003 | `sortFilesByName` dedupe (+ `toNode` dedupe) |
| Explicit empty state, never omitted/broken | FR-004 | `showDetail` empty branch |
| Updates on selection change; absent for edges | FR-005 | `showDetail` vs `showEdgeDetail` |
| Read-only | FR-006 | No write path; `openFile` uses `showTextDocument` preview |
| Clickable → open read-only | FR-006a | `openFile` message + host handler |
| Files derived from spec artifacts only | FR-008 | `extractCodeReferences` over `allText` (D1/D3) |
| Graceful degradation | FR-007 | `parseFeature` try/catch; `openFile` stat-guard |
