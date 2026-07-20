# Implementation Plan: Modified-files list in the detail panel

**Branch**: `011-modified-files-panel` | **Date**: 2026-07-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/011-modified-files-panel/spec.md`

## Summary

Add a labeled, alphabetically-sorted **Files** section to the map's right-side detail panel that
lists the source files a selected spec touches (the files modified to fulfill it), each clickable to
open read-only. The list is derived entirely from source-file references already parsed from the
spec's own artifacts (its `tasks.md` / `plan.md` / `spec.md`) — the existing `SpecNode.codeReferences`
attribute, which is populated today but rendered nowhere. Two changes make it real: (1) **broaden the
pure code-reference extractor** so it recognizes the file-path forms that actually appear in
`tasks.md` (backtick-wrapped and relative-link paths), fixture-driven per the constitution; (2)
**surface the list in the webview** (a `files` field on the pure `CyNodeData`, a Files section in
`showDetail`, and an `openFile` protocol message the host resolves read-only). No new scan, no new
dependency, core stays pure.

## Technical Context

**Language/Version**: TypeScript `strict` (ES modules, `.js` import specifiers), targeting the VS
Code extension host and a sandboxed webview.

**Primary Dependencies**: None new. Existing esbuild bundle; Cytoscape.js already in the webview
(untouched here — the file list is plain DOM in the detail panel, not a graph element).

**Storage**: N/A (read-only; no persistence). Layout persistence (006) is unaffected.

**Testing**: `node:test` in plain Node for pure core + pure webview modules (heuristics, `elements.ts`
sorting/dedup); fixture assertions for the broadened extractor; `@vscode/test-electron` for the
`openFile` host round-trip if an integration point warrants it.

**Target Platform**: VS Code `engines.vscode ^1.101.0` (Marketplace + Open VSX), fully offline.

**Project Type**: Single project — VS Code extension with the pure-core / thin-shell / webview
layering already established (`src/core`, `src/extension`, `src/webview`).

**Performance Goals**: No change to the < 50 ms activation or < 200 ms incremental-update budgets.
The file list is computed from already-parsed references at render time (O(files) sort); rendering the
panel section is negligible DOM work.

**Constraints**: Offline, read-only, telemetry-free (Principles III/VI). The pure core must not import
`vscode`/DOM (Principle I). Extraction change must ship with fixtures (workflow gate).

**Scale/Scope**: A spec may reference tens of files; the panel scrolls the list rather than growing
unbounded. Feature touches ~5 files (1 core heuristic, 1 pure webview mapper, 1 renderer, 1 protocol,
1 host handler) plus CSS and fixtures/tests.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment |
|-----------|------------|
| **I. Pure core, thin shell** | ✅ Reference extraction stays in pure `core/graph/heuristics.ts`; list dedup/sort stays in pure `webview/map/elements.ts` (no `vscode`/DOM). The only I/O — opening a file — lives in the `extension/` host handler. Dependencies still point inward. |
| **II. Resilient parsing** | ✅ Broadened extractor is total and never throws (existing `parseFeature` try/catch degrades to a warning + partial data). No files ⇒ explicit empty state. Unresolved `openFile` path ⇒ a warning, panel/map unchanged. The broadened heuristic is documented and conservative (known source extensions only). |
| **III. Read-only** | ✅ Nothing is created/modified/moved/deleted. `openFile` opens a document read-only for viewing (`showTextDocument`, `preview:true`), exactly like `openSpec`. |
| **IV. Responsive** | ✅ No new scan; list derives from cached references, sorted at render. Incremental rebuild path unchanged; budgets unaffected. |
| **V. Complement, nothing proprietary** | ✅ Works on a vanilla Spec Kit repo; reads only standard artifacts already scanned. No new ids beyond `speckitAtlas.*`; no file associations. |
| **VI. Offline, private, telemetry-free** | ✅ No network, no remote assets, no telemetry. Detail-panel DOM only. |

**Fixture-driven gate**: The extractor change adds/updates fixtures asserting the resulting
`codeReferences` (Development Workflow gate). No principle violation — Complexity Tracking is empty.

**Gate result: PASS** (pre-Phase-0). Re-checked post-design below.

## Project Structure

### Documentation (this feature)

```text
specs/011-modified-files-panel/
├── plan.md              # This file
├── research.md          # Phase 0 output — decisions (file source, gating, extraction shape)
├── data-model.md        # Phase 1 output — CyNodeData.files, extraction contract, protocol delta
├── quickstart.md        # Phase 1 output — validation scenarios
├── contracts/
│   ├── extraction.md    # Broadened code-reference extraction contract (inputs → refs)
│   └── protocol.md      # openFile message contract (webview ↔ host)
└── checklists/
    └── requirements.md  # (from /speckit-specify) — all items pass
```

### Source Code (repository root)

```text
src/core/graph/
├── heuristics.ts        # CHANGE: broaden extractCodeReferences (backtick + relative-link paths)
├── parseFeature.ts      # unchanged (already feeds allText through extractCodeReferences)
└── buildProjectGraph.ts # unchanged path (codeReferences already surfaced on SpecNode via toNode)

src/webview/
├── map/elements.ts      # CHANGE: add `files: readonly string[]` to CyNodeData (dedup + name-sort, pure)
├── map/main.ts          # CHANGE: showDetail renders the Files section (list, empty state, click→openFile)
└── protocol.ts          # CHANGE: add PanelToHost `openFile` message

src/extension/
├── mapPanel.ts          # CHANGE: relay `openFile` to a host handler
└── extension.ts         # CHANGE: implement openFile(path, projectId) — resolve under root, open read-only

media/                   # CHANGE: CSS for the Files list (scroll, wrap/elide long paths)

test/                    # CHANGE: extractor fixtures + elements sort/dedup unit tests
fixtures/                # CHANGE: a feature fixture whose tasks.md lists files in real-world forms
```

**Structure Decision**: Single-project VS Code extension; reuse the established
`core` → `extension` → `webview` layering. No new top-level modules. The feature is deliberately
thin: one pure-core heuristic edit, one pure-webview mapper edit, and thin renderer/host/protocol
wiring — matching how 005/010 were scoped as webview-forward, core-minimal changes.

## Complexity Tracking

> No constitution violations. No entries.

## Post-Design Constitution Re-Check

Re-evaluated after Phase 1 (data-model + contracts): still **PASS**. No new dependency, no core
`vscode`/DOM leak, no write path, no network. The single risk — extraction false positives — is
contained (list-only, not graph edges), conservative (known extensions), documented in
`contracts/extraction.md`, and locked by fixtures. `specToCode`/`codeReferences` semantics are
preserved (Decision D2), so features 002/004 stay byte-identical on existing repos.
