# Contract: Editor command `speckitAtlas.showSpecsForFile`

**Host**: `src/extension/extension.ts`. Read-only. Reuses the in-memory `WorkspaceGraph`
(no re-scan) and the pure `specsForFile`.

## package.json contributions

```jsonc
"commands": [
  { "command": "speckitAtlas.showSpecsForFile", "title": "SpecKit Atlas: Show Specs for File" }
],
"menus": {
  "commandPalette": [
    { "command": "speckitAtlas.showSpecsForFile", "when": "editorIsOpen || resourceScheme == file" }
  ],
  "editor/context":  [ { "command": "speckitAtlas.showSpecsForFile", "when": "resourceScheme == file", "group": "navigation@100" } ],
  "explorer/context":[ { "command": "speckitAtlas.showSpecsForFile", "when": "resourceScheme == file", "group": "navigation@100" } ],
  "editor/title":    [ { "command": "speckitAtlas.showSpecsForFile", "when": "resourceScheme == file", "group": "navigation" } ]
}
```

No `activationEvents` change (VS Code auto-activates on `onCommand`). No `engines.vscode` bump.

## Handler flow

```text
showSpecsForFile(uri?: vscode.Uri):
  1. target = uri ?? window.activeTextEditor?.document.uri
     if none → info "SpecKit Atlas: open or select a file first."  (FR-018)  → return
  2. folder = workspace.getWorkspaceFolder(target)
     project = the graph project whose root (projectId URI) owns `target`
     if none → info "no related specs"  → return
  3. relPath = normalized path of `target` relative to the project root
  4. result = specsForFile(graph, relPath, { projectId: project.projectId })  // pure core
  5. if result.matches.length === 0:
        if specToCode option is OFF → info hint to enable Spec→Code references
        else → info `No specs reference "<relPath>".`             (FR-014)
        return
     if result.matches.length === 1 → treat as the single pick (may skip the list)  (FR-013)
  6. QuickPick items: label = specId, description = title + (folder-match ⇒ "· folder"),
     each with two actions: "Open spec" and "Reveal + focus on map".
  7. action "Open spec"          → openSpec(specId, projectId)                (FR-011, read-only)
     action "Reveal + focus map" → panel.reveal(); panel.focus(specId);
                                     pushSelection(specId); setFocusMode(true) (FR-012, feature 010)
```

- Path safety mirrors `openFile`: reject absolute/root-escaping before use.
- "Reveal + focus" sets focus mode on and echoes `{type:"focusMode",enabled:true}` to the
  controls sidebar so its toggle stays in sync (research R-6).

## AtlasApi (test surface)

Add for integration assertions:

```ts
/** Feature 013 — related specs for a workspace file (mirrors the command's core call). */
specsForFile(path: string, projectId?: string): SpecsForFile;
```

## Tests (@vscode/test-electron)

- active editor on a referenced file → API/command returns the expected matches; quick pick shown.
- "Open spec" opens `specs/<id>/spec.md` read-only.
- "Reveal + focus" reveals the panel, selects the node, enables focus mode (getSelection reflects it).
- no active file / non-file target → info message, no throw.
- explorer `uri` (file not open) → resolves and returns matches.
- file with no referencing spec → "no related specs" message, no error.
- read-only: no workspace file is created/modified across the flow.
