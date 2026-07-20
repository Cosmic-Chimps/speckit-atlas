# SpecKit Atlas

> "SpecKit Atlas" is a placeholder — confirm availability on the
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

## Connect your AI agent (feature 008)

**What it's for.** In-editor agents (VS Code's built-in agent / Copilot) discover the Atlas
tools automatically the moment the extension is installed (feature 007). But agents that keep
their **own** MCP configuration — **Claude Code, Cursor, Claude Desktop**, and other stdio
clients — don't read VS Code's registry, so the tools never appear for them. This feature
closes that gap.

**Why connect it.** Once the `atlas_*` tools are wired in, your AI agent can reason about your
specs from the **actual repository** instead of whatever you happen to paste into the chat.
You can ask things like _"what depends on `004-agent-query-surface`?"_, _"which specs are
orphaned?"_, or _"what's the implementation status across the project?"_ and get answers
grounded in the same graph the map shows — deterministic, read-only, and offline. That means
less manual context-wrangling, fewer hallucinated relationships, and an agent that can plan
changes (or spot a spec nothing links to) with real dependency and status data. It's
especially useful before editing a spec, during code review, or when onboarding to an
unfamiliar Spec Kit repo.

**How it helps.** Instead of hand-crafting a registration and hunting for the server's path,
the extension generates the exact, copy-ready MCP registration for your chosen client, scoped
to the current workspace, and copies it to the clipboard. Apply it once and your agent lists
the five read-only `atlas_*` tools. The extension **writes no files** — it only generates and
hands off the snippet — so it stays fully read-only and offline.

**Set it up:**

1. Open a Spec Kit workspace in VS Code.
2. Command Palette (`⇧⌘P` / `Ctrl+Shift+P`) → **SpecKit Atlas: Set up MCP for your agent**.
3. Pick your client:
   - **Claude Code** → a `claude mcp add speckit-atlas -- …` command. Paste it into a terminal
     and run it, then `/mcp` in Claude Code to confirm the tools appear.
   - **Cursor** → a `.cursor/mcp.json` snippet — add it to that file.
   - **Claude Desktop** → a `claude_desktop_config.json` block — add it and restart the app.
   - **Other** → a generic stdio `command` + `args` form for any MCP client that speaks stdio.
4. The registration is copied to your clipboard (and shown on screen). Apply it in your client.

The generated config always targets a **real, present server**: the standalone
`speckit-atlas-mcp` when it's installed, otherwise the extension's own bundled server by
absolute path — so it works with nothing extra installed. Paths are correctly quoted (spaces
and all), and in a multi-root workspace you choose the folder so the registration's `--root`
is scoped to it. Regenerating is safe and idempotent.

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
