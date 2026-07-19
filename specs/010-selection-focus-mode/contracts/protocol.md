# Contract: postMessage protocol additions

Additive, back-compatible changes to `src/webview/protocol.ts`. Existing variants are
unchanged; new fields are new discriminated-union members. Both webviews and the host
share these types (Principle I — pure types only).

## Controls sidebar → Host

Add one variant to `ControlsToHost`:

```ts
| { readonly type: "setFocusMode"; readonly enabled: boolean }
```

- Emitted by the "Focus on selection" toggle in `src/webview/controls/main.ts` on change.
- `enabled` reflects the checkbox state.

## Host → Map panel

Add one variant to `HostToPanel`:

```ts
| { readonly type: "focusMode"; readonly enabled: boolean }
```

- Posted by `MapPanel.setFocusMode(enabled)` (`src/extension/mapPanel.ts`).
- The host relays `setFocusMode` → `focusMode` in `onControlMessage`
  (`src/extension/extension.ts`), mirroring `focusSpec` → `panel.focus`.

## Host relay contract

```text
controls: setFocusMode(enabled)  ──►  host.onControlMessage  ──►  panel.setFocusMode(enabled)
                                                             └──►  HostToPanel focusMode(enabled)
```

## Behavioral contract (map panel handling of `focusMode` + selection)

1. On `focusMode { enabled }`: set `focusModeOn = enabled`, then `applyFocus()`.
2. On SPECS-list `focus(nodeId)`: `unselect()` all, `select(nodeId)`, set
   `selectedNodeId = nodeId`, center/zoom, then `applyFocus()`.
3. On map node `tap`: set `selectedNodeId = nodeId` (Cytoscape single-selects), then
   `applyFocus()`.
4. On background `tap`: `selectedNodeId = null`, then `applyFocus()`.
5. `applyFocus()`:
   - If `!focusModeOn` or `computeFocusVisible(...).showAll` → `cy.elements().show()`
     (restore full graph); leave `.dimmed` untouched.
   - Else compute visible nodes + induced edges; `show()` them and `hide()` the rest.
6. After `updateInPlace`: restore pan/zoom, re-select the single preserved id (dropping any
   id no longer present, which nulls `selectedNodeId`), then `applyFocus()`.

## Invariants asserted by tests

- **At most one selected** after any sequence of `focus`/tap events (SC-001).
- **Focus hides, filter dims** — enabling focus never clears `.dimmed`, and `setFilter`
  never `show()`s a focus-hidden element (SC-004 / FR-008).
- **Layout preserved** — focus apply/restore emits no `persistLayout` and does not change
  node positions (FR / `006-persist-map-layout` interplay).
- **Removed selection** — if the selected spec is gone after an update, focus falls back to
  the full graph (US2 edge case).
