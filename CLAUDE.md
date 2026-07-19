# SpecKit Atlas — Agent Context

VS Code extension that reads GitHub Spec Kit repositories and renders the
relationships between specs (dependencies, cross-references, shared data-model
entities) alongside implementation status. Companion to — not a replacement for —
speckit-companion. ("SpecKit Atlas" is a working name; confirm availability and
rename before publishing.)

## Non-negotiables (from `.specify/memory/constitution.md`)

1. **Pure core, thin shell** — all discovery/parsing/model logic lives in `src/core/`
   with **zero `vscode`/DOM/webview imports**. `extension/` and `webview/` are thin
   adapters. Dependencies point inward only; `core/` imports neither.
2. **Resilient parsing** — partial/malformed/missing input degrades to per-item
   warnings + partial results, never an exception or crashed host. Risky heuristics
   are documented and toggleable.
3. **Read-only** — never create/modify/move/delete workspace files.
4. **Responsive** — lazy activation (`workspaceContains`, no `*`/startup); < 50 ms
   startup cost; incremental cached updates (< 200 ms after a save on 200 specs).
5. **Complement, require nothing proprietary** — full value on a vanilla Spec Kit
   repo; namespace all ids under `speckitAtlas.*`; no file associations; coexist with
   speckit-companion.
6. **Offline, private, telemetry-free** — no network, no remote webview assets (strict
   CSP + nonce), no telemetry ever.

## Tech stack

- TypeScript `strict` (`any` justified inline; `// @ts-ignore` banned in `core/`).
- esbuild bundle; `@vscode/vsce` package → VS Code Marketplace **and** Open VSX.
- `engines.vscode` `^1.90.0` (explicit, tested floor).
- Tests: `node:test` for `core/` (plain Node); `@vscode/test-electron` for
  integration. Fixture-driven — every parsing-heuristic change updates a fixture.

## Layout

```
src/core/        pure domain (detection, model)
src/extension/   activate/deactivate, WebviewViewProvider, the only fs I/O
src/webview/     renderer; receives MapViewModel via postMessage
media/  test/  fixtures/
```

## Features

- `001-extension-scaffold` — **done**: installable skeleton, lazy activation, one
  namespaced webview welcome state, offline + read-only. See `specs/001-extension-scaffold/`.
- `002-spec-graph-model` — **done**: headless spec-relationship graph in pure `core/graph/`.
  `parseFeature` + `buildProjectGraph` + `buildWorkspaceGraph`. Edges tiered/weighted/
  toggleable: `link` (definitive, locked) → `slug-mention` (strong, count-weighted) →
  `shared-entity` (medium, code-pinned) → `bare-number` (risky); optional `spec-code`. All
  tiers are ON by default (each individually toggleable in the controls sidebar).
  Per-project scoping. Fills `MapViewModel.graph`. See `specs/002-spec-graph-model/`.
- `003-graph-rendering` — **active (planned)**: render the graph. Center `WebviewPanel`
  (map) via `openMap` + sidebar `WebviewView` repurposed to controls (legend, heuristic
  toggles, search, project selector); host is the message hub. Renderer = **Cytoscape.js**
  (bundled local, built-in `cose` force layout), strict CSP+nonce, ≤2 MB vsix / ≤800 KB
  webview JS. Debounced `FileSystemWatcher` → incremental per-feature re-parse → in-place
  update preserving pan/zoom/selection (<200 ms). Read-only (opens spec for viewing only).
  Core unchanged. See `specs/003-graph-rendering/`.
- `004-agent-query-surface` — **active (planned)**: headless query surface over the 002
  model, delivered as **both** a CLI (`speckit-atlas`) and a local **MCP** server
  (`speckit-atlas-mcp`) — sibling entry points sharing the pure core + a read-only
  `node:fs` scan (`src/platform/nodeScan.ts`). New pure `src/core/query/` (getGraph /
  specRelationships / statusSummary / orphans / runCheck / toEnvelope). Versioned JSON
  envelope (deterministic) + optional CLI text; `check` exits 1 on failure. Read-only,
  offline, no telemetry; bins excluded from the `.vsix`. Tests run in plain Node (no
  electron). See `specs/004-agent-query-surface/`.
- `005-help-and-clear-filters` — **active (planned)**: controls-sidebar UX only. A
  "Clear filters" button (emits `setFilter(null,null)` + resets checkboxes; disabled via
  pure `hasActiveFilter`) and a collapsible **help/legend** from a pure
  `src/webview/controls/help.ts` (`HELP_ENTRIES` + `ENCODING_NOTES`, kept consistent with
  `DEFAULT_GRAPH_OPTIONS`). Pure helpers unit-tested; no core/model/query/protocol/host
  changes. See `specs/005-help-and-clear-filters/`.
- `006-persist-map-layout` — **active (planned)**: make the map arrangement sticky across
  Map-tab close/reopen (and editor restart). Root cause: closing disposes the panel, reopen
  re-runs non-deterministic `cose`. Webview reports node positions + viewport (debounced,
  on `dragfree`/`layoutstop`); host persists per `(projectId, nodeId)` in
  `context.workspaceState` (`speckitAtlas.mapLayout` Memento — **not** a workspace file, so
  read-only holds). Reopen seeds Cytoscape `preset` (no drift, no re-sim); new nodes placed
  without moving saved ones; stale pruned; corrupt/absent → `cose` fallback. "Reset layout"
  control clears the store. No core change; new pure merge/prune helper +
  `extension/layoutStore.ts`; protocol adds `persistLayout`/`relayout`/`resetLayout` +
  render `savedPositions`/`savedViewport`. See `specs/006-persist-map-layout/`.
- `007-mcp-provider-contribution` — **active (planned)**: installing the extension makes the
  004 query surface auto-discoverable to in-editor AI agents (no npm install / MCP config).
  Advertises the **existing** `dist/mcp.js` via VS Code's MCP server-definition provider
  (`contributes.mcpServerDefinitionProviders` + `lm.registerMcpServerDefinitionProvider`);
  one `McpStdioServerDefinition` per workspace folder (`--root <folder>`, launched via
  `process.execPath` + `ELECTRON_RUN_AS_NODE=1`). Ships `dist/mcp.js` in the `.vsix`
  (reverses 004's exclusion; keeps `cli.js` out); raises `engines.vscode` → `^1.101.0`.
  Parity is structural (same server); read-only, offline (stdio), telemetry-free. New pure
  `extension/mcpProvider.ts` (`buildServerDefinitions`); no core/query/server changes. See
  `specs/007-mcp-provider-contribution/`.
- `008-mcp-client-setup` — **active (planned)**: covers the MCP clients 007 can't reach
  (Claude Code, Cursor, Claude Desktop — they don't read VS Code's registry). A command
  `speckitAtlas.setupMcpClient` **generates** the exact registration for a chosen client
  (`claude mcp add …` / `.cursor/mcp.json` / Claude Desktop JSON / generic stdio) scoped to
  the workspace, then **copies/shows it** — writes nothing (Read-Only preserved, no
  amendment; resolved decision). Reuses 007's `serverEntryPath` (bundled `dist/mcp.js`
  default; npm `speckit-atlas-mcp` offered as alt). New pure `extension/mcpSetup.ts`
  (`formatRegistration` + `CLIENTS`); no core/server changes; no new dep, no engine bump.
  See `specs/008-mcp-client-setup/`.
- `009-folder-name-identity` — **active (planned)**: relationship identity = the **folder
  name**, so link/slug edges form under any numbering scheme (sequential, **timestamp**,
  unnumbered, preset) — fixes the graph collapsing when a team switches off `NNN-` to avoid
  concurrent-number collisions. Revises 002's pure core: `buildProjectGraph` already resolves
  against the real sibling `idSet`; the gap is extraction. Broaden `extractLinks` to
  per-path-segment candidates; replace the `NNN-slug` regex with a sibling-aware
  `matchSiblingMentions(text, siblingIds, self)` (whole-word, count-weighted — resolved
  FR-004) run in `buildProjectGraph` via a longest-first alternation scan; carry transient
  `FeatureFacts.mentionText`. `number`/bare-number stay 3-digit (FR-005/6) → `projectScan`/
  `nodeScan` unchanged. Byte-identical on sequential repos (SC-003). Fixture-driven
  (timestamp/mixed/unnumbered + sequential regression); no shell/renderer/query/CLI/MCP
  change. See `specs/009-folder-name-identity/`.
