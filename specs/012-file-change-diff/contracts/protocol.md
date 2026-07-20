# Contract: diff messages + host git adapter

**Modules**: `src/webview/protocol.ts`, `src/webview/map/main.ts`, `src/extension/mapPanel.ts`,
`src/extension/extension.ts`, `src/extension/gitChanges.ts`.

## Messages (webview panel → host)

Added to `PanelToHost` (no `HostToPanel` change — the editor renders results):

```ts
| { readonly type: "openFileDiff"; readonly path: string; readonly projectId: string; readonly nodeId: string }
| { readonly type: "showChangeset"; readonly nodeId: string; readonly projectId: string }
```

- `openFileDiff` — emitted by a file entry's **"Open changes"** affordance. `path` is one of the
  selected spec's `CyNodeData.files` (011); `nodeId` identifies the spec (for basis resolution);
  `projectId` selects the repo/root.
- `showChangeset` — emitted by the spec's **"See all changes"** action.

Both are only reachable from a spec's detail view (never edges — FR-009).

## Host relay (`mapPanel.ts`)

`mapPanel` relays both to new handlers on its `handlers` object, alongside `openSpec`/`openFile`:

```ts
openFileDiff(nodeId: string, path: string, projectId: string): void;
showChangeset(nodeId: string, projectId: string): void;
```

## Host adapter (`extension/gitChanges.ts`) — read-only

The adapter wraps the built-in `vscode.git` API (research D1). It MUST:

1. Resolve the repository containing the project root; if the Git extension or a repo is unavailable →
   return an "unavailable" result (caller shows an info message).
2. Resolve the attribution basis: derive `candidateBranchName(nodeId)`, gather facts
   (`folderBranchExists`, `branchBaseRef` via merge-base, `firstCommitParentRef` via first-commit-touching
   `specs/<id>/`), read the `speckitAtlas.diff.attribution` setting, and call the pure `chooseBasis`.
3. For `openFileDiff`: if the file changed between `basis.beforeRef` and current, open
   `vscode.diff(beforeUri, afterUri, title)` where `title` states the basis/baseline (FR-004/007/008);
   otherwise return "no changes".
4. For `showChangeset`: list changed files in the range (name-sorted, per-file `changeKind`) and open
   `vscode.commands.executeCommand("vscode.changes", title, resources)`; `title` + an info message state
   the basis (FR-005/007). `kind:"none"` or empty → info message (offer per-file fallback).
5. **Never** call a write/mutating git command; **never** perform a network op (no fetch/pull/push).
   All failures resolve to an info message and no state change (FR-002/003/004/010/011).

### Behavioral guarantees

- **Read-only** (FR-002, SC-005): only query APIs + read-only diff views; workspace and git state
  unchanged.
- **Offline** (FR-003, SC-005): local refs only; no network.
- **Resilient** (FR-004/010/011, SC-003/006): missing repo / refs / changes / malformed history →
  clear message, no throw, other panels unaffected.
- **Interpretable** (FR-007/008, SC-004): every opened diff/changeset states its basis and baseline.

## Configuration (`package.json` → `contributes.configuration`)

- `speckitAtlas.diff.attribution`: enum `["auto","branch","range","off"]`, default `"auto"` (FR-006
  toggle). `off` disables the changeset (US2); per-file "Open changes" still works where a diff exists.
