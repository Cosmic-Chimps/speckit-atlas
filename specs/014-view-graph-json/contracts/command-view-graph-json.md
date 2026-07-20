# Contract: Editor command `speckitAtlas.viewGraphJson`

**Host**: `src/extension/extension.ts`. Read-only. Reuses the in-memory `WorkspaceGraph` (no
re-scan) and the pure `graphEnvelope`.

## package.json contributions

```jsonc
"commands": [
  { "command": "speckitAtlas.viewGraphJson", "title": "SpecKit Atlas: View Graph JSON" }
]
```

Palette-only (the graph is a workspace-level artifact — no file to hang editor/explorer menus
off). No `activationEvents` change (VS Code auto-activates on `onCommand`). No `engines` bump.

## Handler flow

```text
viewGraphJson():
  1. scope = (activeProjectId != null && the graph still has that project)
               ? { projectId: activeProjectId }
               : undefined                                   // whole workspace / stale → all (R-4)
  2. text = JSON.stringify(graphEnvelope(graph, scope), null, 2)   // pure; pretty-printed (FR-004)
  3. doc  = await workspace.openTextDocument({ content: text, language: "json" })  // untitled; no write (FR-002)
  4. await window.showTextDocument(doc, { preview: true })
```

- Never creates/modifies/moves/deletes a workspace file (Principle III).
- Empty workspace → still opens a valid empty-graph JSON document (FR-007).
- Total: `graphEnvelope` cannot throw; the command surfaces a document, not an error (FR-012).

## AtlasApi (test surface)

```ts
/** Feature 014 — the JSON the command would open, for the current scope (deterministic). */
getGraphJson(): string;
```

## Tests (@vscode/test-electron)

- command registered & palette-contributed (extend the activate.test command-list assertion).
- `getGraphJson()` parses as valid JSON with `schemaVersion:1`, `kind:"graph"`.
- with a project selected in the controls, the JSON's `data` is that single `ProjectGraph`;
  with "All projects", `data.projects` covers the workspace (matches rendered scope, SC-003).
- running the command opens a document whose languageId is `json` and whose text parses.
- no workspace file is created/modified across the flow (read-only).
