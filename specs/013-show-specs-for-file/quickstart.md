# Quickstart: Show Specs for File

Validate reverse file→spec traceability end-to-end across all four surfaces. Read-only,
offline. See `contracts/` for exact shapes and `data-model.md` for the match algorithm.

## Prerequisites

- Repo deps installed (`npm install`) and a build (`npm run build` / esbuild) for CLI/MCP bins.
- A Spec Kit fixture (or this repo itself) where at least one spec's `tasks.md`/artifacts
  reference a source file, e.g. `002-spec-graph-model` referencing `src/core/graph/parseFeature.ts`.
  Fixtures live under `fixtures/graph/code-references/`.

## 1. Pure core (fastest signal)

```bash
npm test            # runs node:test for core/query, format, and CLI/MCP parity
```

Expect the new `specsForFile` suite to pass: exact match, folder fallback (only when no exact),
root-level-file guard, path normalization, project scoping, `specToCode`-off empty, determinism.

## 2. CLI

```bash
# JSON (the contract)
node dist/cli.js specs-for-file src/core/graph/parseFeature.ts --root .

# human-readable
node dist/cli.js specs-for-file src/core/graph/parseFeature.ts --root . --format text
```

Expected (text):

```text
# specs for src/core/graph/parseFeature.ts (N exact)
  002-spec-graph-model      [done]  (exact)
  …
```

- A file no spec references → exit `0`, empty `matches` (text: `# specs for … (0)`).
- Missing `<path>` → exit `2` + usage.

## 3. MCP (parity)

Start the server (stdio) and call the tool, or assert parity in tests:

```bash
node dist/mcp.js --root .
# → call tool "atlas_specs_for_file" { "path": "src/core/graph/parseFeature.ts" }
```

The tool's JSON envelope MUST deep-equal the CLI JSON for the same inputs (SC-003).

## 4. Editor command

1. Launch the Extension Development Host (F5).
2. Open a referenced source file (e.g. `src/core/graph/parseFeature.ts`).
3. Run **SpecKit Atlas: Show Specs for File** from:
   - the Command Palette,
   - the editor right-click menu,
   - the Explorer right-click menu (works even if the file is not open),
   - the editor title `⋯` menu.
4. A quick pick lists the related spec(s). For each:
   - **Open spec** → opens `specs/<id>/spec.md` (read-only preview).
   - **Reveal + focus on map** → the map panel reveals, the spec becomes the single selection,
     and focus mode scopes the view to it + its one-hop neighbors (feature 010); the sidebar
     focus-mode toggle reflects the change.
5. On a file no spec references → an informational "no related specs" message (no error).
6. With no active file / a non-file target → a clear "open or select a file first" message.

## Success checklist (maps to Success Criteria)

- [ ] Listing a file's specs takes ≤ 2 interactions; open/reveal is 1 more. (SC-001/002)
- [ ] Command, CLI, and MCP return the same match set for the same file. (SC-003)
- [ ] Two runs on unchanged inputs are byte-identical. (SC-004)
- [ ] Unreferenced file → clean "no related specs" everywhere, zero errors. (SC-005)
- [ ] Folder-only reference still surfaces, labeled distinctly from exact. (SC-006)
- [ ] No file writes, no network calls during any invocation. (SC-007)
- [ ] Malformed/partial specs never crash; result + warnings returned. (SC-008)
```
