# Implementation Plan: Persist Map Layout Across Close/Reopen

**Branch**: `006-persist-map-layout` | **Date**: 2026-07-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-persist-map-layout/spec.md`

## Summary

Make the map's arrangement *sticky*. Today, closing the Map tab disposes the
`WebviewPanel`; reopening it reloads the webview with `cy` undefined and re-runs the
non-deterministic `cose` force layout (`src/webview/map/main.ts:95`), so every node
lands somewhere new. The fix: the webview reports node positions and viewport
(pan/zoom) back to the host; the host persists them per project in
`context.workspaceState` (a VS Code Memento — **editor storage, not a workspace
file**, so Principle III holds); on (re)open the host ships the saved layout in the
`render` message and the webview seeds Cytoscape with a **`preset`** layout instead
of `cose`. New/unknown nodes are placed without disturbing saved ones, removed nodes
are pruned, and a **"Reset layout"** control clears the saved arrangement and re-runs
`cose`. Corrupt/absent state falls back to `cose` (resilience). Pure `core/` is
untouched — node positions are a shell/rendering concern the core does not own.

## Technical Context

**Language/Version**: TypeScript (`strict`); VS Code `^1.90.0`.

**Primary Dependencies**: No new runtime dependencies. Reuses the existing
Cytoscape.js (its built-in `preset` and `cose` layouts) and the VS Code
`ExtensionContext.workspaceState` Memento already available to the host.

**Storage**: `context.workspaceState` (workspace-scoped Memento) under the single
key `speckitAtlas.mapLayout`. Survives Map-tab close/reopen **and** editor restart
for the same workspace. Nothing is written into the user's repository.

**Testing**: pure layout-merge/prune helpers via `node:test` (plain Node);
`@vscode/test-electron` for persist→dispose→reopen→restore and reset-layout
integration; a CSP/no-telemetry contract test remains green (no new remote sources,
no network).

**Target Platform**: VS Code desktop webview (canvas rendering).

**Performance Goals**: reopening with an unchanged node set applies saved positions
via `preset` (no force simulation) — comparable to the existing incremental update
and well under the < 200 ms budget on a 200-spec workspace. Position reporting from
the webview is debounced so dragging never floods the host.

**Constraints**: read-only (Memento only, no workspace-file writes); offline; no
telemetry; strict CSP + nonce unchanged (no new script/style/network sources);
webview JS and `.vsix` stay within existing budgets (no new deps).

**Scale/Scope**: rendering + host-persistence only. Positions keyed by
`(projectId, nodeId)` so per-project arrangements are independent and slug
collisions across projects can't clobber each other. Consumes feature-002's model
and feature-003's render pipeline unchanged.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Gate | Status |
|---|-----------|------|--------|
| I | Pure Domain Core, Thin Editor Shell | Core unchanged. New logic is a pure layout-merge/prune helper (unit-tested in Node) plus host `workspaceState` I/O and webview seeding — all in `extension/` + `webview/`; the renderer still receives everything via `postMessage` and does no fs access. | ✅ PASS |
| II | Resilient Parsing Over Rigid Schemas | Absent, malformed, version-mismatched, or fully-stale saved layout degrades to a fresh `cose` layout — never a crash or blank panel. Partial saved layout restores known nodes and lays out the rest. | ✅ PASS — FR-009, research D3. |
| III | Read-Only by Default | Persistence uses the editor's `workspaceState` Memento only; **zero** create/modify/move/delete of workspace files. Reset only clears the Memento. | ✅ PASS — FR-011, research D1. |
| IV | Responsive at Workspace Scale | Reopen uses `preset` (no simulation); position reports are debounced; restore stays within the existing < 200 ms incremental-update budget; no full re-layout for an unchanged node set. | ✅ PASS — FR-013, SC-002, research D5. |
| V | Complement the Ecosystem | Vanilla repo; `speckitAtlas.*` ids/keys only; no file associations; coexists with speckit-companion; requires nothing proprietary. | ✅ PASS. |
| VI | Offline, Private, Telemetry-Free | Layout stays local in the Memento; no network, no remote assets, no telemetry; CSP + nonce unchanged; no new dependency. | ✅ PASS — FR-012. |
| — | Tech constraints (TS strict, layering, esbuild, no new deps, size budget) | No `any`/`@ts-ignore` in core; no new runtime dependency; bundle budgets unaffected. | ✅ PASS. |

**Result**: All gates pass. No new dependency, no core change, no workspace writes.
No deviations → Complexity Tracking empty.

## Project Structure

### Documentation (this feature)

```text
specs/006-persist-map-layout/
├── plan.md · research.md · data-model.md · quickstart.md
├── contracts/layout-persistence.md
└── checklists/requirements.md
```

### Source Code (repository root) — additions/changes in **bold**

```text
src/
├── core/                          # UNCHANGED (pure; node positions are not a core concern)
├── extension/
│   ├── extension.ts               # ** update ** wire layout store: seed render, persist reports, reset command
│   ├── mapPanel.ts                # ** update ** carry savedLayout into `render`; relay `persistLayout`; add `relayout`
│   ├── layoutStore.ts             # ** NEW ** thin workspaceState wrapper: load/save/prune/clear per project
│   └── controlsView.ts            # ** update ** "Reset layout" control → `resetLayout` message
├── webview/
│   ├── protocol.ts                # ** update ** render gains savedPositions/savedViewport; new persistLayout + relayout + resetLayout
│   ├── map/main.ts                # ** update ** seed preset positions; emit debounced positions on dragfree/layoutstop; handle relayout
│   └── controls/                  # ** update ** reset-layout button + disabled-state helper (pure)
media/
│   ├── map.css · controls.css     # ** update ** minimal styling for the reset control (no new remote assets)
test/
├── core|webview/                  # ** NEW ** pure merge/prune + reset-enabled unit tests (node:test)
└── integration/                   # ** NEW ** dispose→reopen→restore, drag-persist, reset, restart-persist
```

**Structure Decision**: Single VS Code extension project (existing layout). All work
lands in the two shell layers — `extension/` (host persistence + wiring) and
`webview/` (seed + report) — plus one new pure helper module and its tests. `core/`
is deliberately untouched, matching feature 003's boundary.

## Complexity Tracking

> No constitution violations. Section intentionally empty.
