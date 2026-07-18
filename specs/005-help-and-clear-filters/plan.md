# Implementation Plan: Help & Clear Filters

**Branch**: `005-help-and-clear-filters` | **Date**: 2026-07-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-help-and-clear-filters/spec.md`

## Summary

A contained UX addition to feature 003's controls sidebar: a **"Clear filters"** button that
resets the tier/status filters to "show all" (reusing 003's `setFilter(null, null)` path,
disabled when nothing is filtered) and a collapsible **help/legend** explaining the five
relationship types (with tiers + default-on state) and the node/edge visual encodings. Help
copy lives in a pure, testable `src/webview/controls/help.ts` kept consistent with
`DEFAULT_GRAPH_OPTIONS`. No changes to the core, model, query surface, host, or message
protocol.

## Technical Context

**Language/Version**: TypeScript (`strict`); VS Code `^1.90.0`.

**Primary Dependencies**: None new. Reuses the feature-003 controls webview + existing
`setFilter` message.

**Storage**: N/A (no persisted preferences).

**Testing**: `node:test` for the pure help content + `hasActiveFilter` (plain Node). The
dim-clear visual and help open/close are manual/quickstart (webview canvas), consistent with
003's filter-highlight disposition.

**Target Platform**: the sandboxed controls `WebviewView` (from feature 003).

**Performance Goals**: N/A — trivial UI additions; no graph recomputation.

**Constraints**: sandboxed CSP webview (unchanged), fully offline (static help), read-only,
no telemetry, keyboard-accessible, theme-aware.

**Scale/Scope**: presentation/interaction only, in `src/webview/controls/`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Gate | Status |
|---|-----------|------|--------|
| I | Pure Domain Core, Thin Editor Shell | No core change; help copy is a pure data module; the only logic (`hasActiveFilter`) is pure; DOM wiring stays in the controls webview. | ✅ PASS |
| II | Resilient Parsing Over Rigid Schemas | Help is static and renders regardless of graph state; clearing filters is a safe reset. | ✅ PASS |
| III | Read-Only by Default | Presentation/interaction only; no workspace writes; no persisted preferences. | ✅ PASS — FR-010. |
| IV | Responsive at Workspace Scale | No graph recompute; clearing filters just removes dimming; no budget impact. | ✅ PASS |
| V | Complement the Ecosystem | Lives in the existing sidebar; no new commands/views/associations. | ✅ PASS |
| VI | Offline, Private, Telemetry-Free | Static local help (no remote), no network, no telemetry; CSP unchanged. | ✅ PASS — FR-009/010, HLP-6. |
| — | Tech constraints (TS strict, layering, no new deps, fixture/pure tests) | No new dependency; pure help/helper tested. | ✅ PASS. |

**Result**: All gates pass. No deviations → Complexity Tracking empty.

## Project Structure

### Documentation (this feature)

```text
specs/005-help-and-clear-filters/
├── plan.md · research.md · data-model.md · quickstart.md
├── contracts/controls-ui.md
└── checklists/requirements.md
```

### Source Code (repository root) — additions/changes in **bold**

```text
src/webview/controls/
├── main.ts        # ** update ** add "Clear filters" button (setFilter(null,null) + reset
│                  #   checkboxes; disabled via hasActiveFilter) and a collapsible help section
└── help.ts        # ** NEW pure ** HELP_ENTRIES + ENCODING_NOTES + hasActiveFilter (DOM-free)

media/controls.css # ** update ** styles for the help section + clear button
test/contracts/
└── controls-help.test.ts  # ** NEW ** HELP_ENTRIES completeness/consistency vs
                           #   DEFAULT_GRAPH_OPTIONS; ENCODING_NOTES coverage; hasActiveFilter (HLP-2..5, H-4)

# UNCHANGED: src/core/**, src/extension/**, src/webview/map/**, src/webview/protocol.ts,
#            src/cli/**, src/mcp/**  (no host/protocol/model/query changes)
```

**Structure Decision**: Everything lives in `src/webview/controls/`. The testable seam is
`help.ts` — a pure data + `hasActiveFilter` module with no DOM/`cytoscape`/`vscode` imports —
so help-content consistency (FR-008) and the clear-button enabled logic are asserted in plain
Node. `main.ts` wires the button to the existing `setFilter` message (no new protocol) and
renders the help section. No new bundle, dependency, command, or `.vsix` budget impact.

## Complexity Tracking

> No constitution violations. No entries.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
