# Implementation Plan: View Graph JSON

**Branch**: `014-view-graph-json` | **Date**: 2026-07-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/014-view-graph-json/spec.md`

## Summary

Add a namespaced command **"SpecKit Atlas: View Graph JSON"** that opens the graph the map is
built from as pretty-printed JSON in a new (untitled) editor tab. The payload is the existing
canonical **versioned graph envelope** from the 004 query layer (`schemaVersion` + `kind:"graph"`
+ `data` + `warnings`) — the same JSON the CLI `graph` command and the MCP `atlas_graph` tool
emit — so there is one shape across every surface. Scope follows the controls' current project
selection (one project, or the whole workspace). Read-only (opens a document, writes no
workspace file), offline, telemetry-free. No new dependency, no engine bump.

A tiny pure helper `graphEnvelope(graph, scope?)` is added to `src/core/query/` (compose
`getGraph` + `toEnvelope`, deriving warnings from the scoped result) so the exact JSON is
unit-testable and deterministic; the editor command is a thin adapter that stringifies it and
opens a document (the feature-008 `openTextDocument` pattern).

## Technical Context

**Language/Version**: TypeScript `strict` (ESM, `.js` import specifiers).

**Primary Dependencies**: None new. Reuses the pure 004 query layer (`getGraph`, `toEnvelope`)
and the VS Code `workspace.openTextDocument` / `window.showTextDocument` APIs already used by
feature 008.

**Storage**: N/A — operates on the extension's in-memory `WorkspaceGraph` (no scan, no file I/O).

**Testing**: `node:test` in plain Node for the pure `graphEnvelope` (determinism, scope, empty,
warnings); `@vscode/test-electron` integration for the command (opens a JSON document, matches
the rendered scope, writes no workspace file).

**Target Platform**: VS Code extension host (Node). Offline.

**Project Type**: Single TypeScript project; layering `core/` → `extension/` (dependencies
point inward; `core/` imports no `vscode`/DOM).

**Performance Goals**: O(nodes+edges) `getGraph` sort + one `JSON.stringify` over the cached
in-memory graph — trivially within the Principle IV budget; no scan, no watcher.

**Constraints**: Read-only (open a document, never create/modify/move/delete a workspace file);
offline; telemetry-free; pure core with zero `vscode`/DOM imports; deterministic output.

**Scale/Scope**: Hundreds of specs; one pure helper + one thin command + one command/menu
contribution. No protocol change, no webview change.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment | Verdict |
|-----------|------------|---------|
| **I. Pure core, thin shell** | The JSON is produced by a pure `graphEnvelope(graph, scope?)` in `src/core/query/` (no `vscode`/DOM). The command is a thin adapter: pick scope, stringify, open a document. | ✅ Pass |
| **II. Resilient parsing** | `graphEnvelope` is total: empty workspace → valid empty graph; malformed input → the model's existing warnings are surfaced in the envelope; never throws. The command degrades to a valid document or a clear message. | ✅ Pass |
| **III. Read-only** | Opens an **untitled** editor document the user may save themselves (feature-008 pattern). The extension creates/modifies **no** workspace file. Clipboard/save-dialog were excluded from scope to keep this clean. | ✅ Pass |
| **IV. Responsive** | Reuses the cached in-memory graph — no scan, no watcher. One sort + one stringify. Lazy `onCommand` activation. | ✅ Pass |
| **V. Complement, require nothing proprietary** | Works on a vanilla repo; the JSON is the already-public graph contract. Command id namespaced `speckitAtlas.viewGraphJson`; palette-only contribution; coexists with speckit-companion. | ✅ Pass |
| **VI. Offline, private, telemetry-free** | No network, no telemetry — pure in-memory transform to text. | ✅ Pass |

**Result**: PASS — no violations. Complexity Tracking below is intentionally empty.

**Re-check after Phase 1 design**: PASS (unchanged). The design adds one pure function and one
thin command + palette contribution; it touches no principle, no protocol, no webview, and the
002/004 model/semantics are unchanged (the envelope is consumed, not modified).

## Project Structure

### Documentation (this feature)

```text
specs/014-view-graph-json/
├── plan.md              # This file (/speckit-plan)
├── research.md          # Phase 0 output — resolved decisions
├── data-model.md        # Phase 1 output — graphEnvelope shape + scope/warnings rule
├── quickstart.md        # Phase 1 output — how to validate end-to-end
├── contracts/           # Phase 1 output
│   ├── query-graph-envelope.md    # the pure graphEnvelope function + envelope
│   └── command-view-graph-json.md # the editor command + palette contribution
└── checklists/
    └── requirements.md  # Written by /speckit-specify
```

### Source Code (repository root)

```text
src/core/query/
├── queries.ts   # + graphEnvelope(graph, scope?)  (compose getGraph + toEnvelope; scoped warnings)
└── index.ts     # export graphEnvelope

src/core/
└── index.ts     # re-export graphEnvelope

src/extension/
└── extension.ts # + registerCommand("speckitAtlas.viewGraphJson"): scope from activeProjectId,
                 #   JSON.stringify(graphEnvelope(graph, scope), null, 2), open an untitled json doc;
                 #   + AtlasApi.getGraphJson() test hook

package.json     # + command contribution (palette only). No new dep, no engine bump.

test/
├── core/query.graph-envelope.test.ts     # node:test — determinism, scope, empty, warnings
└── integration/view-graph-json.test.ts   # electron — opens a JSON doc, matches scope, no write
```

**Structure Decision**: Single project, existing layering. The only genuinely new logic is the
tiny pure `graphEnvelope`; everything else is an existing adapter pattern (feature 008 opens a
document; feature 013 registered a palette command). No `platform/`, CLI, MCP, protocol, or
webview change — the headless surfaces already expose this JSON via `graph`/`atlas_graph`.

## Complexity Tracking

> No constitutional violations — additive, read-only, within all six principles. Table empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
