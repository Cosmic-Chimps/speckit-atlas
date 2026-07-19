# Implementation Plan: Selection & Focus Mode

**Branch**: `010-selection-focus-mode` | **Date**: 2026-07-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/010-selection-focus-mode/spec.md`

## Summary

Two webview-only refinements to the interactive map from `003-graph-rendering`:

1. **Single active selection (US1, P1)** — a correctness fix. `focus()` in the map
   webview calls `n.select()` without clearing the prior selection, so sidebar clicks
   accumulate blue borders. Deselect before selecting; keep the single-selection
   invariant across map clicks, background clicks, and incremental updates.
2. **Focus mode (US2, P2)** — a new sidebar toggle that scopes the map to the selected
   spec plus its one-hop neighbors and the edges induced among that set, hiding
   everything else; toggling off (or clearing the selection) restores the full graph.

Technical approach: a small pure helper `computeFocusVisible(adjacency, selectedId)`
(unit-testable in plain Node) decides the visible node set; the webview translates that
into Cytoscape `show()`/`hide()` (which preserves positions, so `006-persist-map-layout`
is undisturbed). Focus composes with the existing tier/status *dimming* filter from
`005-help-and-clear-filters` (hide vs. dim are independent layers). Two new protocol
messages (`setFocusMode` control→host, `focusMode` host→panel) carry the toggle. No
change to the pure relationship model of `002-spec-graph-model`.

## Technical Context

**Language/Version**: TypeScript `strict` (ES2022 modules), same as the rest of the repo.

**Primary Dependencies**: Cytoscape.js (already bundled, `003-graph-rendering`). No new
runtime dependency.

**Storage**: None. Focus-mode and selection are transient view state in the webview;
neither is persisted (unlike layout in `006-persist-map-layout`).

**Testing**: `node:test` for the pure helper (`test/contracts/`), following the
`layout-seed.test.ts` pattern; `@vscode/test-electron` integration for panel behavior
(`test/integration/`), following the `render`/`layout-*` suites.

**Target Platform**: VS Code `^1.101.0` webview (sandboxed, strict CSP + nonce).

**Project Type**: VS Code extension — pure `core/` + `extension/` adapters + `webview/`
renderer. This feature touches only `webview/` and the thin `extension/` relay.

**Performance Goals**: Focus apply/restore is a single batched `show()/hide()` pass over
the current elements — O(nodes+edges), no relayout, well within the interactive budget;
no impact on the `< 200 ms` incremental-update budget (Principle IV).

**Constraints**: Offline, read-only, telemetry-free. Must not disturb persisted layout
positions or the existing dimming filters. No new bundle weight (no new dep).

**Scale/Scope**: Hundreds of specs; focus visibility must stay a linear pass. Roughly
five touched files (protocol, map webview, controls webview, mapPanel, extension relay)
plus two test files. No core files touched.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Pure Domain Core, Thin Editor Shell** — ✅ PASS. Zero `core/` changes. New logic
  is a pure helper in `webview/map/` plus thin Cytoscape/relay wiring. The pure helper
  imports nothing from `vscode`/DOM.
- **II. Resilient Parsing Over Rigid Schemas** — ✅ PASS. No parsing change. Focus reads
  already-built adjacency; a missing/absent selection degrades to "show full graph"
  (never throws). New protocol fields are optional/back-compatible.
- **III. Read-Only by Default** — ✅ PASS. Selection and focus are view-only; no file or
  workspace-state writes (focus state is not persisted).
- **IV. Responsive at Workspace Scale** — ✅ PASS. One batched linear show/hide pass, no
  relayout, no new file I/O. Does not affect activation or incremental-update budgets.
- **V. Complement the Ecosystem** — ✅ PASS. No new ids beyond `speckitAtlas.*` surface;
  no file associations; works on a vanilla Spec Kit repo.
- **VI. Offline, Private, Telemetry-Free** — ✅ PASS. No network, no telemetry, no remote
  webview assets.

**Result: PASS — no violations, Complexity Tracking not required.**

## Project Structure

### Documentation (this feature)

```text
specs/010-selection-focus-mode/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── protocol.md      # Phase 1 output — postMessage additions
└── tasks.md             # Phase 2 (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
src/
├── core/                         # UNCHANGED (Principle I) — adjacency already built here
├── webview/
│   ├── protocol.ts               # + setFocusMode/focusMode; + selection (host→controls, FR-011/012)
│   ├── map/
│   │   ├── main.ts               # fix single-selection; add focus state + apply/restore;
│   │   │                         #   re-apply focus & selection after updateInPlace
│   │   └── focus.ts              # NEW — pure computeFocusVisible(adjacency, selectedId)
│   └── controls/
│       └── main.ts               # + "Focus on selection" toggle; selected-row highlight
│                                 #   + related-spec count badge (FR-011/012)
└── extension/
    ├── mapPanel.ts               # + setFocusMode(enabled) post method
    ├── controlsView.ts           # + setSelection() + re-push selection on `ready` (FR-011)
    └── extension.ts              # relay setFocusMode; selectedSpecId source-of-truth,
                                  #   pushSelection + relatedCountFor + getSelection() (FR-011/012)

media/
└── controls.css                  # selected-row + .rel-count badge styling (FR-011/012)

test/
├── contracts/
│   └── focus-set.test.ts         # NEW — unit tests for computeFocusVisible (node:test)
└── integration/
    └── selection-focus.test.ts   # NEW — focus/relay smoke + selection-echo & count (SF-1..6)
```

**Structure Decision**: Existing VS Code extension layout. This feature is confined to
the `webview/` renderer and the `extension/` message relay; the pure focus computation is
isolated into `webview/map/focus.ts` so it is unit-testable in plain Node (mirroring
`webview/map/layout.ts`). No `core/` file is touched, honoring Principle I. FR-011/FR-012
(sidebar selection highlight + related-spec count) were added after review; the host stays
the single source of truth for the selection, echoing it (with a neighbor count computed
from the graph) to the controls sidebar — no core or model change.

## Complexity Tracking

> No Constitution Check violations — this section intentionally left empty.
