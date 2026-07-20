# Phase 1 Data Model: See what changed to fulfill a spec

No persisted entities. Transient shapes computed on demand by the git adapter, plus two new protocol
messages. All shapes are plain and JSON-serializable; nothing new touches the graph core.

## Transient shapes (extension/gitChanges.ts + pure attribution.ts)

### `AttributionBasis` (result of the pure `chooseBasis`)

| Field | Type | Notes |
|-------|------|-------|
| `kind` | `"branch" \| "range" \| "none"` | `none` ⇒ couldn't determine (FR-006). |
| `label` | `string` | Human-readable, shown to the user (FR-007), e.g. `"spec branch base"`, `"since spec was added"`, `"undetermined"`. |
| `beforeRef` | `string \| null` | Resolved "before" ref (branch base / parent-of-first-commit); null when `kind: "none"`. |
| `reason` | `string \| null` | When `kind: "none"`, a brief why (e.g. "branch merged/deleted; spec folder not found in history"). |

- Produced by pure `chooseBasis(availability)` (inputs: `folderBranchExists`, `defaultBranchKnown`,
  `firstCommitFound`, plus the resolved refs supplied by the adapter). Deterministic; total.
- `candidateBranchName(folderId)` (pure) derives the branch name to look for from the spec's folder id
  (reuses 009's folder-name identity; any numbering scheme).

### `FileChange`

| Field | Type | Notes |
|-------|------|-------|
| `path` | `string` | Workspace-relative path (same normalization as 011). |
| `changeKind` | `"added" \| "modified" \| "removed" \| "renamed"` | Per-file indicator (FR-005). |
| `beforeUri` / `afterUri` | editor URIs | For rendering: `beforeUri` = `git:` URI at `beforeRef`; `afterUri` = working-tree/HEAD URI (D3). Not serialized to the webview — used host-side only. |

### `SpecChangeset`

| Field | Type | Notes |
|-------|------|-------|
| `basis` | `AttributionBasis` | Which basis/baseline was used (FR-007). |
| `files` | `FileChange[]` | Name-sorted ascending (deterministic), de-duplicated. Empty ⇒ "no changes". |

## Changed shape: protocol `PanelToHost` (`webview/protocol.ts`)

Add two variants (both webview → host; the editor renders the result, so no host→panel reply is needed):

```ts
// feature 012 — open one listed file's before/after diff in the editor's diff view.
| { readonly type: "openFileDiff"; readonly path: string; readonly projectId: string; readonly nodeId: string }
// feature 012 — open the spec's full attributed changeset in the native multi-file diff editor.
| { readonly type: "showChangeset"; readonly nodeId: string; readonly projectId: string }
```

- `openFileDiff` carries `nodeId` (the spec) so the host resolves the attribution basis for that spec,
  and `path` (one of `CyNodeData.files` from 011).
- No `HostToPanel` change: results are rendered by the editor (`vscode.diff` / `vscode.changes`); failure
  states surface as editor notifications, not panel messages.

## Detail-panel affordances (`webview/map/main.ts`)

- Each file entry in the 011 Files list gains an **"Open changes"** affordance → posts `openFileDiff`.
- The spec detail view gains a single **"See all changes"** action → posts `showChangeset`.
- Both appear only for a spec selection (never edges — FR-009), consistent with 011's `showDetail` /
  `showEdgeDetail` split.

## Host handlers (`extension/extension.ts` → `extension/gitChanges.ts`)

| Handler | Behavior |
|---------|----------|
| `openFileDiff(nodeId, path, projectId)` | Resolve repo + basis for the spec; if the file changed in the range, `vscode.diff(beforeUri, afterUri, title)` (title states basis/baseline); if unchanged/no-repo/indeterminate → info message, no change (FR-004). |
| `showChangeset(nodeId, projectId)` | Resolve repo + basis; list changed files in range; `vscode.changes(title, resources)`; title + info message state the basis (FR-007); `none`/empty → info message, offer per-file fallback (FR-006/010). |

## Validation rules (from requirements)

| Rule | Source | Where enforced |
|------|--------|----------------|
| Per-file "Open changes" opens editor diff | FR-001, SC-001 | `openFileDiff` → `vscode.diff` |
| Read-only; no VCS mutation | FR-002, SC-005 | adapter uses read-only APIs only; diffs open read-only |
| Offline; no network | FR-003, SC-005 | built-in Git API + local refs only |
| Degrade to clear message; leave state | FR-004/010/011, SC-003/006 | handlers' guard branches |
| Spec-level changeset, name-sorted, per-file kind | FR-005 | `showChangeset` + `vscode.changes` |
| Toggleable attribution heuristic | FR-006 | `speckitAtlas.diff.attribution` setting → `chooseBasis` |
| State the basis used (and why, if none) | FR-007, SC-004 | title + info message from `AttributionBasis.label`/`reason` |
| Defined before/after baseline, stated | FR-008, SC-004 | D3 baseline + title |
| Only for spec selections | FR-009 | `showDetail` vs `showEdgeDetail` |
