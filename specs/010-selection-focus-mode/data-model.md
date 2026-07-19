# Phase 1 Data Model: Selection & Focus Mode

This feature adds **no persisted data** and **no `core/` model change**. It introduces
transient webview view-state and one pure computation over already-built graph adjacency.

## Transient view-state (webview: `src/webview/map/main.ts`)

| Field | Type | Default | Meaning |
|-------|------|---------|---------|
| `selectedNodeId` | `string \| null` | `null` | The single currently-selected spec id. At most one. Set by SPECS-list `focus()` and map node `tap`; cleared by background `tap` or when the selected spec disappears on update. |
| `focusModeOn` | `boolean` | `false` | Whether focus mode is enabled. Toggled by the `focusMode` host→panel message. Not persisted. |

**Invariants**
- At most one node is Cytoscape-`:selected` at any time (US1 / SC-001).
- Visibility is a pure function of `(focusModeOn, selectedNodeId, current elements)`; it is
  re-derived — never incrementally patched — after every render/update (D5).
- Focus toggles element **display** (`hidden`); it never touches the `.dimmed` opacity
  class owned by the tier/status filter (D4).

## Derived value: focused-visible set

`computeFocusVisible(adjacency, selectedId)` — pure helper in
`src/webview/map/focus.ts`, unit-testable in plain Node (no `vscode`/DOM imports).

**Input**
- `adjacency: ReadonlyMap<string, ReadonlySet<string>>` — undirected neighbor map derived
  from the current edges (both endpoints added for each edge; direction ignored per the
  spec assumption).
- `selectedId: string | null`.

**Output**
- `FocusVisible = { nodes: ReadonlySet<string>; showAll: boolean }`
  - `showAll: true` (and `nodes` empty) when `selectedId` is `null` or not present in
    `adjacency` — the caller shows the entire graph.
  - Otherwise `nodes = { selectedId } ∪ adjacency.get(selectedId)` — the closed one-hop
    neighborhood. The caller then shows those nodes and the induced edges
    (`visibleNodes.edgesWith(visibleNodes)`), hiding everything else.

**Rules**
- Isolated selected node (no neighbors) → `nodes = { selectedId }`, only that node visible.
- Unknown / absent `selectedId` → `showAll: true` (graceful, never throws — Principle II).

## Protocol additions (see `contracts/protocol.md`)

- `ControlsToHost` gains `{ type: "setFocusMode"; enabled: boolean }`.
- `HostToPanel` gains `{ type: "focusMode"; enabled: boolean }`.
- No change to `PanelToHost`, `HostToControls`, or any existing variant.

## Explicitly unchanged

- `WorkspaceGraph`, `GraphOptions`, and all of `core/` — untouched (Principle I).
- `persistLayout` / saved positions (`006-persist-map-layout`) — focus uses
  `show()/hide()`, which preserve positions; no layout message is emitted by focus.
- `setFilter` / `.dimmed` dimming (`005-help-and-clear-filters`) — untouched; composes
  orthogonally.
