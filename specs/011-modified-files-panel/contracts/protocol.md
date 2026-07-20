# Contract: `openFile` message + Files-list rendering

**Modules**: `src/webview/protocol.ts`, `src/webview/map/main.ts`, `src/extension/mapPanel.ts`,
`src/extension/extension.ts`.

## Message: `openFile` (webview panel → host)

Added to `PanelToHost`:

```ts
| { readonly type: "openFile"; readonly path: string; readonly projectId: string }
```

- **Emitted by**: the map panel's `showDetail`, when the user activates a file entry.
- **`path`**: workspace-relative source path, exactly one of the selected node's `CyNodeData.files`.
- **`projectId`**: the owning project's id (the same value already sent with `openSpec`).

No change to `HostToPanel`, `HostToControls`, or `ControlsToHost`. The file list itself is delivered
inside the existing `render` payload (panel already receives the full graph and derives `CyNodeData`).

## Host handling (`mapPanel.ts` → `extension.ts`)

`mapPanel` relays `openFile` to a new handler `openFile(path, projectId)` alongside the existing
`openSpec`. The handler MUST:

1. Resolve `root = Uri.parse(projectId)`, then `uri = Uri.joinPath(root, path)`.
2. **Reject unsafe paths**: if `path` is absolute or escapes the root (contains a `..` segment that
   resolves outside `root`), do not open; show the same warning as (4). Listed paths come from the
   extractor and should be workspace-relative, so this is a defensive guard.
3. `await workspace.fs.stat(uri)` (throws if missing), then
   `await window.showTextDocument(uri, { preview: true })` — **read-only viewing**, identical posture
   to `openSpec` (Principle III).
4. On any failure (missing, moved, unsafe): `window.showWarningMessage("SpecKit Atlas: could not open
   \"<path>\" (file missing or moved).")` and change nothing.

## Behavioral guarantees

- **Read-only**: no file is created/modified/moved/deleted; opening uses preview mode (FR-006).
- **Resilient**: an unresolved/unsafe path never throws to the host or disturbs the map/panel
  (FR-007, User Story 2 scenario 2).
- **Selection-scoped**: `openFile` is only reachable from a spec's detail view; edge details render
  no file list (FR-005).

## Rendering guarantees (Files section in `showDetail`)

- Files shown in `CyNodeData.files` order (already name-sorted, de-duplicated — see
  `data-model.md` / D4).
- `files.length === 0` ⇒ neutral empty state, section still present (FR-004).
- Long paths wrap/elide via CSS; the list scrolls within the panel so existing actions (e.g. "Open
  spec") stay reachable (SC-004, edge cases).
