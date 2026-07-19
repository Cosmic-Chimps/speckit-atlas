# Changelog

All notable changes to this extension are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **Relationships are now folder-name-based** (`009-folder-name-identity`): link and
  slug-mention edges resolve against the actual set of sibling feature folders, so they form
  under **any** numbering scheme — sequential (`003-…`), **timestamp**
  (`20260719-143022-…`), or unnumbered / preset. Previously the graph collapsed (losing the
  definitive-link and strong-mention tiers) when a repo used anything but a 3-digit prefix,
  which made switching `.specify/init-options.json` to `"timestamp"` (to avoid concurrent
  feature-number collisions) safe only for the node list, not the edges. Sequential repos
  produce identical graphs to before. Bare-number (risky) stays scoped to numbered features.
  Pure-core change; rendering, query, and CLI/MCP consume it unchanged.

- **Minimum VS Code raised to `1.101`** (`007-mcp-provider-contribution`): required for the
  MCP server-definition provider API below. Users on older editors keep full functionality
  via the standalone npm CLI/MCP (`speckit-atlas` / `speckit-atlas-mcp`).

### Added

- MCP setup for any agent client (`008-mcp-client-setup`): a new command **"SpecKit Atlas:
  Set up MCP for your agent"** generates a paste-ready MCP registration for the clients that
  don't read VS Code's registry — **Claude Code** (`claude mcp add …`), **Cursor**
  (`.cursor/mcp.json`), **Claude Desktop** (config JSON), and a generic stdio form. It scopes
  the registration to the chosen workspace folder, targets the bundled server (with the npm
  `speckit-atlas-mcp` form offered as an alternative), copies it to the clipboard, and opens
  full instructions. Read-only — the extension **writes no files**; you apply the config.
  Complements 007 (which covers VS Code's built-in agent automatically).

- In-editor MCP auto-discovery (`007-mcp-provider-contribution`): installing the extension
  now makes the query surface (feature 004) available to in-editor AI agents automatically —
  no `npm install`, no manual MCP config. The extension advertises its bundled MCP server
  (`dist/mcp.js`, now shipped in the `.vsix`) to VS Code's MCP registry via a server-
  definition provider, one stdio server per workspace folder (scoped with `--root`, launched
  via the editor's own Node). Read-only, offline (stdio), telemetry-free; tool parity with
  the standalone `speckit-atlas-mcp` is structural (same server). The `speckit-atlas` CLI
  remains npm-only (excluded from the `.vsix`).

- Persistent map layout (`006-persist-map-layout`): the map now remembers where its nodes
  are. Positions and viewport (pan/zoom) are captured as you drag or as the automatic
  layout settles, and restored when you close and reopen the Map tab — and across editor
  restarts for the same workspace. New specs are placed without disturbing your existing
  arrangement, removed specs are pruned, and each project keeps its own layout. A
  **Reset layout** control in the sidebar clears the saved arrangement and re-runs the
  automatic layout. Persistence uses the editor's `workspaceState` only — **no workspace
  files are written** — and stays offline and telemetry-free.

- Agent query surface (`004-agent-query-surface`): a headless way to query the graph
  outside the editor, delivered as **both** a CLI (`speckit-atlas`) and a local **MCP
  server** (`speckit-atlas-mcp`), sharing the pure core + a read-only `node:fs` scan.
  Queries: full graph, a spec's relationships (dependsOn/dependedOnBy with tier/weight/
  evidence), status/completeness summary, orphaned specs, and a deterministic `no-orphans`
  check (CLI exits 1 on failure; MCP returns `{ ok, violations }`). Output is a versioned,
  deterministic JSON envelope (CLI also offers `--format text`). Read-only, offline
  (MCP over stdio), no telemetry; the bins ship via npm and are excluded from the `.vsix`.

- Graph rendering (`003-graph-rendering`): the specification graph now renders in a
  center editor panel using **Cytoscape.js** (bundled locally, force-directed `cose`
  layout), with the sidebar repurposed to **controls** — legend, per-heuristic toggles,
  tier/status filters, spec search, and a multi-root project selector. Nodes encode
  status + task-completion + artifact completeness; edges encode tier/weight/direction
  with viewable evidence. Select a node to open its spec read-only. A debounced file
  watcher updates the map incrementally (in place, preserving pan/zoom/selection) when a
  spec changes. Strict CSP, fully offline, ≤ 2 MB vsix / ≤ 800 KB webview JS.

### Added (graph model)

- Spec-relationship graph model (`002-spec-graph-model`): a pure `core/graph/` module
  that turns each Spec Kit project into a graph — one node per feature (title, status,
  task-completion, artifact completeness) and inferred, tiered, weighted, toggleable
  edges (definitive links, strong slug mentions, medium code-pinned shared entities,
  risky bare numbers off by default; optional spec→code layer). Per-project scoping (no
  cross-project edges). `MapViewModel.graph` is now populated from a workspace scan
  (was always null); rendering remains a later feature.

### Added (extension scaffold)

- Extension scaffold (`001-extension-scaffold`): an installable VS Code extension that
  activates lazily in a Spec Kit workspace (detected via `.specify/` or
  `specs/*/spec.md`) and contributes a single namespaced **SpecKit Atlas** activity-bar
  view hosting a sandboxed webview with a welcome/empty state.
- Pure domain core (`src/core/`) with workspace detection and view-model construction,
  unit-tested in plain Node.
- Strict Content-Security-Policy (with per-load nonce) for the webview; no network
  calls, no remote assets, no telemetry.
- Build (esbuild), type-check (strict, incl. core-purity project), lint (with a
  core import-boundary rule), format, and test tooling; CI workflow running the gate
  against the `engines.vscode` floor and `stable`.
- Resilience coverage for malformed Spec Kit workspaces: a `.specify/`-present repo
  with a broken `specs/` layout still activates and degrades to a safe state.
