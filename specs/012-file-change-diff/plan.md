# Implementation Plan: See what changed to fulfill a spec (before/after diff)

**Branch**: `012-file-change-diff` | **Date**: 2026-07-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/012-file-change-diff/spec.md`

## Summary

From a selected spec's detail panel, let the user see what changed to fulfill it. **US1 (MVP)** adds a
per-file **"Open changes"** action to each 011 Files-list entry that opens the *editor's own* diff view
comparing the file's spec-start baseline against its current state. **US2** adds a **"See all changes"**
action that opens the editor's native **multi-file diff** for the whole set of files attributed to the
spec. All diff rendering is delegated to the editor (`vscode.diff` / `vscode.changes`) — we decide
*what* to compare, never build a diff renderer. Git is read via the **built-in VS Code Git extension
API** (no new dependency, no process spawning, offline, read-only). Attribution uses a documented,
toggleable heuristic — spec-named branch → commit-range fallback → honest "couldn't determine" — with a
tiny pure helper for the branch-name/basis decision. This is the first feature to read version control;
it stays strictly read-only and offline.

## Technical Context

**Language/Version**: TypeScript `strict`, ES modules. Extension host + existing sandboxed webview.

**Primary Dependencies**: **None new.** Uses the built-in `vscode.git` extension's API (`getAPI(1)`) for
repository/ref/diff data, and built-in editor commands `vscode.diff` (single-file) and `vscode.changes`
(multi-file diff) for rendering. Vendored `git.d.ts` type declarations (types only, no runtime code).

**Storage**: N/A (read-only; no persistence, no VCS mutation).

**Testing**: `node:test` in plain Node for the pure attribution helper (branch-name derivation, basis
selection, determinacy). `@vscode/test-electron` for the host handlers against a **throwaway git-history
fixture repo** created in the test's temp dir (the standard render-demo fixture is not a git repo).

**Target Platform**: VS Code `engines.vscode ^1.101.0` (unchanged), fully offline.

**Project Type**: Single project — reuse the `core` → `extension` → `webview` layering. Git I/O is a new
adapter in `extension/` (the I/O layer); the graph core is untouched.

**Performance Goals**: No change to activation (< 50 ms) or incremental-update (< 200 ms) budgets — git
queries happen **only on user action** (clicking "Open changes" / "See all changes"), never on
activation or scan. Long queries run async with the editor's progress affordance.

**Constraints**: Read-only, offline, telemetry-free (local git only, no network). Pure attribution logic
stays `vscode`-free and unit-tested (Principle I). Risky attribution heuristic is documented + toggleable
(Principle II).

**Scale/Scope**: A spec's changeset may be hundreds of files → US2 delegates to the native multi-diff
editor, which is built for that. Feature touches ~6 files (1 pure helper, 1 git adapter, protocol,
renderer, host, package.json config) + vendored types + tests.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment |
|-----------|------------|
| **I. Pure core, thin shell** | ✅ Graph core untouched. Git access is I/O → lives in a new `extension/` adapter. The only new *logic* (branch-name derivation, basis selection, determinacy) is a pure, `vscode`-free module unit-tested in plain Node (precedent: `extension/layoutModel.ts`). |
| **II. Resilient parsing/degradation** | ✅ No repo / no changes / indeterminate attribution / malformed history → clear message, never a throw or crash. Attribution is a **documented, toggleable** heuristic that returns "couldn't determine" rather than a wrong changeset. |
| **III. Read-only** | ⚠️→✅ Introduces version control as a data source — but **read-only**: only queries git and opens read-only diff views (`vscode.diff`/`vscode.changes`); never writes workspace files or mutates git state. No write-capable git command is ever invoked. Recorded as a deliberate, justified expansion (Complexity Tracking). |
| **IV. Responsive** | ✅ Git queries are on-demand (user click), not on activation/scan; run async. Large changesets delegated to the native multi-diff editor. Budgets unaffected. |
| **V. Complement, nothing proprietary** | ✅ Reuses the editor's diff/multi-diff + built-in Git extension; full value on a vanilla Spec Kit repo under git; folder-name branch reuses 009. No proprietary metadata; no conflicting ids/associations. |
| **VI. Offline, private, telemetry-free** | ✅ Local git only; no network (no fetch/remote ops), no telemetry, no remote webview assets. |

**Deliberate expansion (recorded, not a violation):** this is the first feature to read VCS. It holds
Principles III & VI because it is strictly read-only and offline. Logged in Complexity Tracking so the
expansion is explicit rather than implicit.

**Gate result: PASS** (pre-Phase-0). Re-checked post-design below.

## Project Structure

### Documentation (this feature)

```text
specs/012-file-change-diff/
├── plan.md              # This file
├── research.md          # Phase 0 — git-access mechanism, attribution/baseline resolution, the spike
├── data-model.md        # Phase 1 — entities (FileChange, SpecChangeset, AttributionBasis) + protocol delta
├── quickstart.md        # Phase 1 — validation (pure tests + git-fixture integration + manual)
├── contracts/
│   ├── attribution.md   # Pure basis-selection + branch-name contract
│   └── protocol.md      # openFileDiff / showChangeset messages + host git-adapter contract
└── checklists/
    └── requirements.md  # (from /speckit-specify) — all items pass
```

### Source Code (repository root)

```text
src/extension/
├── attribution.ts       # NEW (pure, vscode-free): candidateBranchName(folderId), chooseBasis(availability),
│                        #   determinacy — unit-tested in plain Node
├── gitChanges.ts        # NEW (I/O adapter): wrap the vscode.git API — resolve repo, resolve basis refs
│                        #   (branch base via merge-base, or first-commit-touching specs/<id>), list changed
│                        #   files in range, build diff URIs, open single/multi diff. Read-only.
├── git.d.ts             # NEW (types only): vendored VS Code Git extension API declarations
├── mapPanel.ts          # CHANGE: relay openFileDiff / showChangeset to host handlers
└── extension.ts         # CHANGE: implement handlers via gitChanges; read the attribution setting; wire API

src/webview/
├── protocol.ts          # CHANGE: PanelToHost += openFileDiff, showChangeset
└── map/main.ts          # CHANGE: per-file "Open changes" affordance + a spec-level "See all changes" action

package.json             # CHANGE: contributes.configuration — enable/disable + attribution basis (toggle, FR-006)
media/map.css            # CHANGE: styling for the new affordances

test/
├── contracts/attribution.test.ts   # NEW: pure attribution unit tests
└── integration/git-changes.test.ts # NEW: temp git-repo fixture → basis resolution + diff open + degradation
```

**Structure Decision**: Single-project VS Code extension, existing layering. Git access is confined to
one new `extension/` adapter (`gitChanges.ts`) — the I/O boundary — with the decision logic factored into
a pure, `vscode`-free `attribution.ts`. Rendering is delegated to built-in editor commands, so there is
no new webview diff renderer and no new runtime dependency.

## Complexity Tracking

| Deviation | Why needed | Simpler alternative rejected because |
|-----------|-----------|--------------------------------------|
| **New data source: version control (git)** | The feature's entire premise is "show what changed to fulfill a spec," which only VCS history can answer. 011 deliberately avoided VCS; this feature intentionally crosses that line. | Artifact-only (011's approach) cannot express before/after. Kept safe by making it **read-only + offline** via the built-in Git API and read-only diff views — so Principles III & VI still hold; the expansion is scoped to this feature's adapter. |

## Post-Design Constitution Re-Check

Re-evaluated after Phase 1: still **PASS**. No new runtime dependency; git access read-only via the
built-in API; rendering delegated to the editor; pure logic isolated and tested; core untouched. The one
recorded expansion (reading VCS) is contained in `gitChanges.ts`, guarded (read-only, offline), toggleable
(FR-006 setting), and degrades to clear messages. The load-bearing risk — whether the built-in Git API
exposes merge-base / path-filtered log / openable diff URIs at the engine floor — is isolated to
`gitChanges.ts` and resolved by the Phase-0 spike (research.md D1), with a narrow read-only `git` CLI
fallback documented if an API gap is found.
