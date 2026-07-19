# SpecKit Atlas

> ⚠️ **Working name.** "SpecKit Atlas" is a placeholder — confirm availability on the
> VS Code Marketplace and Open VSX and rename before publishing.

A VS Code extension that reads [GitHub Spec Kit](https://github.com/github/spec-kit)
repositories and renders the relationships between specs — dependencies,
cross-references, and shared data-model entities — alongside implementation status.
It is a companion to, not a replacement for, `speckit-companion`.

This repository currently contains:

- **`001-extension-scaffold`** — an installable skeleton that activates lazily in a
  Spec Kit workspace and shows a placeholder Map view.
- **`002-spec-graph-model`** — the pure headless model that turns a project into a
  spec-relationship graph (nodes per feature + inferred, tiered, toggleable edges),
  populating `MapViewModel.graph`.
- **`003-graph-rendering`** — renders that model: a center **map** panel
  (Cytoscape.js, force-directed) plus a **controls** sidebar (legend, heuristic toggles,
  tier/status filters, search, project selector). Open a node's spec read-only; the map
  updates live and incrementally as specs change.
- **`004-agent-query-surface`** — a headless **CLI** (`speckit-atlas`) and local **MCP
  server** (`speckit-atlas-mcp`) over the same core, so agents and CI can query the graph
  (relationships, status, orphans, a `no-orphans` check) without the editor. Versioned
  JSON output, read-only, offline. Ships via npm; excluded from the `.vsix`.
- **`006-persist-map-layout`** — the map **remembers its arrangement**. Node positions and
  the viewport are saved as you drag or as the layout settles, and restored when you close
  and reopen the Map tab (and across editor restarts). New specs slot in without scrambling
  what's placed; a **Reset layout** control re-runs the automatic layout. Saved in the
  editor's `workspaceState` — no workspace files written, offline, telemetry-free.
- **`007-mcp-provider-contribution`** — **in-editor agents discover the query tools on
  install**. The extension advertises its bundled MCP server to the editor's MCP registry
  (one stdio server per workspace folder), so an in-editor AI agent can call the `atlas_*`
  tools with no `npm install` and no config. Read-only, offline, telemetry-free; requires
  VS Code ≥ 1.101. Users on older editors, CI, and terminals keep the npm CLI/MCP.
- **`008-mcp-client-setup`** — **connect any other agent in seconds**. The command
  _SpecKit Atlas: Set up MCP for your agent_ generates a paste-ready registration for
  clients that don't read VS Code's registry (Claude Code, Cursor, Claude Desktop, or a
  generic stdio form), scoped to your workspace, and copies it. The extension writes
  nothing — you apply the config. Read-only, offline.
- **`009-folder-name-identity`** — **relationships work with any numbering scheme**.
  Identity is the feature **folder name**, and references resolve against the real set of
  sibling folders, so link/mention edges form for sequential (`003-…`), timestamp
  (`20260719-143022-…`), unnumbered, and preset repos alike. Sequential repos are unchanged.
  Safe to switch `.specify/init-options.json` to `"timestamp"` to avoid concurrent
  feature-number collisions in a team.

### Headless usage (feature 004)

```bash
speckit-atlas graph --root .                 # JSON envelope of the graph
speckit-atlas spec 001-foo --root .          # a spec's relationships
speckit-atlas status --root . --format text  # human-readable summary
speckit-atlas check --rule no-orphans        # exit 1 if any spec is orphaned (CI gate)
```

MCP client config (e.g. Claude Code / Desktop):

```jsonc
{ "speckit-atlas": { "command": "npx", "args": ["speckit-atlas-mcp", "--root", "."] } }
```

## Principles (see `.specify/memory/constitution.md`)

- **Pure core, thin shell** — all logic lives in `src/core/` with zero `vscode`/DOM
  imports and is unit-tested in plain Node.
- **Resilient** — partial/malformed input degrades to warnings, never a crash.
- **Read-only** — the extension never writes to your workspace.
- **Responsive** — lazy activation; no cost until a Spec Kit workspace is detected.
- **Complementary** — full value on a vanilla Spec Kit repo; coexists with
  `speckit-companion`; all contributions namespaced `speckitAtlas.*`.
- **Offline & telemetry-free** — no network calls, no remote assets, no telemetry.

## Architecture

```
src/core/        pure domain (detection + view model) — no vscode/DOM
src/extension/   VS Code adapters (activation, webview provider, the only fs I/O)
src/webview/     sandboxed renderer (strict CSP + nonce)
test/core/       node:test unit tests (plain Node)
test/contracts/  static contract tests (CSP, coexistence, no-telemetry) — plain Node
test/integration/ @vscode/test-electron suites
fixtures/        Spec Kit fixture workspaces
```

## Develop

```bash
npm install
npm run build        # esbuild → dist/extension.js + media/webview.js
npm run typecheck    # strict tsc, incl. core-purity project
npm run lint         # eslint (incl. core import-boundary rule)
npm run format       # prettier --check
npm run test:core        # pure core tests (plain Node)
npm run test:contracts   # static contract tests (plain Node)
npm run test:integration # editor integration (downloads VS Code; needs a display)
```

Press **F5** to launch the Extension Development Host against
`fixtures/vanilla-speckit`.

## Package

```bash
npm run package      # @vscode/vsce → *.vsix
```

Set a real `publisher` in `package.json` first. Publish to both the VS Code
Marketplace and Open VSX.

## Minimum editor version

`engines.vscode`: `^1.90.0` (tested against this floor and `stable` in CI).

## License

MIT — see the `LICENSE` file in this repository.
