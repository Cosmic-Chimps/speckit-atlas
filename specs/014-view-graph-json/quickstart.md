# Quickstart: View Graph JSON

Validate that the command surfaces the map's underlying graph as JSON. Read-only, offline.
See `contracts/` for exact shapes and `data-model.md` for the `graphEnvelope` rule.

## Prerequisites

- Repo deps installed (`npm install`) and a build (`npm run build`).
- A Spec Kit workspace with specs (this repo, or `fixtures/graph/render-demo`).

## 1. Pure core (fastest signal)

```bash
npm run test:core
```

Expect the `graphEnvelope` suite to pass: unscoped whole-workspace envelope, scoped single
`ProjectGraph`, unknown project id → empty, empty workspace → valid empty envelope, determinism,
and parity with the CLI/MCP `graph` envelope shape.

## 2. Parity check with the existing headless surface

The command's JSON should equal the CLI's for the same scope:

```bash
node dist/cli.js graph --root . | head -20            # whole workspace
node dist/cli.js graph --root . --project "<projectId>"  # one project
```

The editor view mirrors these (same `schemaVersion` / `kind:"graph"` / `data` / `warnings`).

## 3. Editor command

1. Launch the Extension Development Host (F5) on a Spec Kit workspace.
2. Run **SpecKit Atlas: View Graph JSON** from the Command Palette.
3. Confirm a new tab opens containing pretty-printed JSON (`schemaVersion`, `kind:"graph"`,
   `data.projects` with nodes/edges, `warnings`), syntax-highlighted as JSON.
4. In the controls sidebar, select a single project, re-run the command → the JSON's `data` is
   just that project. Switch to "All projects", re-run → all projects appear.
5. On an empty workspace, run the command → a valid empty-graph JSON document still opens.
6. Confirm nothing was written: the tab is untitled/unsaved and no workspace file changed.

## Success checklist (maps to Success Criteria)

- [ ] One command invocation goes from map → readable graph JSON. (SC-001)
- [ ] The opened text always parses as valid JSON, incl. empty/malformed workspaces. (SC-002)
- [ ] JSON contents + scope match the currently rendered graph. (SC-003)
- [ ] Two runs on unchanged state + scope are byte-identical. (SC-004)
- [ ] Zero file writes, zero network requests per invocation. (SC-005)
- [ ] Several-hundred-spec workspace opens without a perceptible freeze. (SC-006)
```
