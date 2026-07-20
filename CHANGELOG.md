# Changelog

All notable changes to this extension are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- View Graph JSON (`014-view-graph-json`): a new **SpecKit Atlas: View Graph JSON** command
  (Command Palette) opens the graph the map is built from as pretty-printed JSON in a new editor
  tab — the same canonical, versioned `kind:"graph"` envelope the CLI `graph` command and the MCP
  `atlas_graph` tool emit. The output follows the controls' current project selection (one project,
  or the whole workspace). Read-only (opens an untitled document; writes no workspace file),
  offline, and telemetry-free; no new dependency.

- Show Specs for File (`013-show-specs-for-file`): the inverse of the Files list — from a source
  file, see which spec(s) reference it (code→spec reverse traceability). A new **SpecKit Atlas:
  Show Specs for File** command (Command Palette, editor/Explorer context menus, and editor title
  menu) lists the related spec(s) in a quick pick; each offers **Open spec** (read-only) and
  **Reveal + focus on map** (selects the spec and scopes the map to it and its neighbors). The same
  lookup is available headlessly: `speckit-atlas specs-for-file <path>` and the MCP tool
  `atlas_specs_for_file`. Matches are derived purely from each spec's declared code references
  (feature 011) — **deterministic, offline, no git** — using exact-file matching with a
  containing-folder fallback. Read-only and telemetry-free; no new dependency.

- Before/after diff from a spec (`012-file-change-diff`): the detail panel now lets you see what
  changed to fulfill a spec. Each file in the Files list gains an **"Open changes"** action that
  opens the editor's own before/after diff, and a spec-level **"See all changes"** opens the native
  multi-file diff for everything attributed to the spec. This is the first feature to read version
  control — **read-only and offline** (built-in Git extension API + built-in diff views; no new
  dependency, no network, no VCS mutation). Attribution uses a documented, **toggleable** heuristic
  (`speckitAtlas.diff.attribution`: `auto` → spec-named branch base, else the commit range from when
  the spec was added; `branch`/`range`/`off`), and degrades to a clear "couldn't determine" message
  rather than a wrong changeset. Complements — does not reinvent — the editor's diff/Timeline.

- Modified-files list in the detail panel (`011-modified-files-panel`): selecting a spec on the
  map now shows a **Files** section in the right-side detail panel listing the source files that
  fulfill it — derived from the file paths named in the spec's own artifacts (`tasks.md` /
  `plan.md` / `spec.md`), de-duplicated and ordered by file name. Each entry opens read-only for
  viewing (like "Open spec"); a spec that references no source files shows a neutral empty state.
  The list follows the on-by-default **"Spec → code layer"** toggle. To surface it, the pure
  code-reference extractor was broadened to recognize backtick-wrapped paths (not just relative
  markdown links) and to normalize every path to a workspace-root-relative form. Read-only,
  offline; webview + a thin read-only host handler, no core-model or query change.

## [0.1.0] - 2026-07-19

### Added

- Focus on selection (`010-selection-focus-mode`): a new **"Focus on selection"** toggle in
  the controls sidebar's **View** section scopes the map to the selected spec, its directly
  connected neighbors, and the edges among that set — hiding everything else so a single
  spec's neighborhood is legible on large graphs. Turning it off (or clearing the selection)
  restores the full graph. Focus **hides** (display) and composes orthogonally with the tier/
  status dimming filter; it preserves saved layout positions. Webview-only; no core change.

- Selected spec is highlighted in the **Specs** list, with a related-spec count
  (`010-selection-focus-mode`): selecting a spec — from the list or by clicking a node on the
  map — now highlights that row in the sidebar and shows how many specs relate to it (e.g.
  "2 related"). The highlight persists across refreshes and stays in sync between the list and
  the map.

### Fixed

- Map selection no longer accumulates (`010-selection-focus-mode`): selecting specs from the
  **Specs** list now replaces the previous selection instead of leaving a trail of
  blue-bordered nodes — exactly one spec is highlighted at a time, consistent with clicking
  nodes on the map. (Programmatic selection was additive; it now clears the prior selection
  first.)

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
