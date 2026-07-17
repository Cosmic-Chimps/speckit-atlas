# Implementation Plan: Extension Scaffold

**Branch**: `001-extension-scaffold` | **Date**: 2026-07-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-extension-scaffold/spec.md`

## Summary

Establish an installable VS Code extension skeleton for SpecKit Atlas: it activates
lazily only in Spec Kit workspaces, contributes a single namespaced `SpecKit Atlas`
view container hosting a sandboxed webview that shows a welcome/empty state, and does
so offline, read-only, and telemetry-free. The scaffold also lays down the
constitution-mandated `core/ → extension/ → webview/` layering, the esbuild build, and
the dual test setup — so later parsing/graph features drop into a proven structure.
No specification parsing or graph rendering is in scope here.

## Technical Context

**Language/Version**: TypeScript (`strict`), Node.js LTS toolchain; targets VS Code
`^1.90.0`.

**Primary Dependencies**: VS Code Extension API (`@types/vscode`), esbuild (bundling),
`@vscode/vsce` (packaging), `@vscode/test-electron` (integration tests). Runtime deps
kept to none beyond the platform (no graph library yet — deferred).

**Storage**: N/A — read-only, no persistence; in-memory only.

**Testing**: `node:test` for the pure `core/` on plain Node; `@vscode/test-electron`
for editor-integration.

**Target Platform**: VS Code desktop, `engines.vscode` `^1.90.0` (explicit, tested
floor).

**Project Type**: Single-project VS Code extension with internal `core/ → extension/
→ webview/` layering.

**Performance Goals**: Extension adds < 50 ms to editor startup in non-qualifying
workspaces (SC-001); lazy activation via `workspaceContains` so no code loads until a
Spec Kit signal matches. (The < 200 ms incremental-update budget applies to later
parsing features, not this scaffold.)

**Constraints**: No runtime network calls; no remote webview assets (strict CSP +
nonce); no workspace file writes; no telemetry; coexist with speckit-companion; no
file associations; `any` justified inline, `// @ts-ignore` banned in `core/`.

**Scale/Scope**: Scaffold only. Structure must scale to the stated future target
(hundreds of specs across dozens of projects) without rework of the layering.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Gate | Status |
|---|-----------|------|--------|
| I | Pure Domain Core, Thin Editor Shell | `core/` has zero `vscode`/DOM/webview imports; detection logic is pure and Node-testable; `extension/` & `webview/` are thin adapters. | ✅ PASS — see `contracts/core-api.md` (I/O injected, no fs in core). |
| II | Resilient Parsing Over Rigid Schemas | Empty/partial/malformed input degrades to warnings + welcome state, never throws. | ✅ PASS — C-4, FR-011; `Warning` type carries per-item notices. |
| III | Read-Only by Default | No create/modify/move/delete of workspace files. | ✅ PASS — FR-006, SC-004; no write APIs used. |
| IV | Responsive at Workspace Scale | Lazy activation (`workspaceContains`, no `*`/startup); < 50 ms startup cost. | ✅ PASS — research Decision 3, SC-001. |
| V | Complement the Ecosystem | Full value on vanilla repo; no proprietary config required; namespaced ids; no file associations; coexists with companion. | ✅ PASS — FR-009/010, SC-005, `speckitAtlas.*` namespace. |
| VI | Offline, Private, Telemetry-Free | No network, no remote assets (strict CSP), no telemetry. | ✅ PASS — FR-007/008, W-6/W-7, SC-004. |
| — | Tech constraints (TS strict, layering, esbuild, vsce, dual registry) | Honored. | ✅ PASS — Technical Context + research. |

**Result**: All gates pass. No deviations → Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
specs/001-extension-scaffold/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── core-api.md
│   ├── extension-contributions.md
│   └── webview-protocol.md
├── checklists/
│   └── requirements.md  # from /speckit-specify
└── tasks.md             # /speckit-tasks output (NOT created here)
```

### Source Code (repository root)

```text
src/
├── core/                     # PURE — no vscode/DOM/webview imports (Principle I)
│   ├── detection/            # detectRoot / detectRoots heuristics
│   ├── model/                # WorkspaceRoot, DetectionResult, Warning, MapViewModel
│   └── index.ts              # public barrel (the core-api.md contract)
├── extension/                # VS Code adapters (thin)
│   ├── extension.ts          # activate() / deactivate()
│   ├── workspaceProbe.ts     # reads fs entries → WorkspaceRoot (only place doing I/O)
│   └── mapViewProvider.ts    # WebviewViewProvider; owns postMessage channel + CSP
└── webview/                  # renderer (thin) — receives MapViewModel, renders welcome
    └── main.ts

media/                        # local webview assets (icon, css, bundled webview js)
test/
├── core/                     # node:test — asserts core-api.md contract (C-1..C-8)
└── integration/              # @vscode/test-electron — E-* and W-* contracts
fixtures/                     # Spec Kit fixture repos (vanilla-speckit, non-speckit, ...)
.vscode/                      # launch.json / tasks.json for F5 dev host
package.json                  # contributions per extension-contributions.md
tsconfig.json                 # strict
esbuild.js                    # bundle extension + webview
```

**Structure Decision**: Single-project VS Code extension. The three top-level `src/`
directories are the physical enforcement of Principle I's layering; dependencies point
inward only (`webview/` and `extension/` may import `core/`; `core/` imports neither).
`extension/workspaceProbe.ts` is the sole place that touches the file system, keeping
`core/` pure and fully unit-testable in plain Node.

## Complexity Tracking

> No constitution violations. No entries.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
