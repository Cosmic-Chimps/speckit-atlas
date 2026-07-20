# Implementation Plan: Show Specs for File

**Branch**: `013-show-specs-for-file` | **Date**: 2026-07-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/013-show-specs-for-file/spec.md`

## Summary

Reverse traceability — the inverse of feature 011. Given a source file, list the spec(s)
that reference it, and let the user open a spec or reveal + focus it on the map. The lookup
is one **pure** function `specsForFile(graph, path, scope?)` added to the 004 query layer
(`src/core/query/`) that inverts each `SpecNode.codeReferences` (feature 011, artifact-derived,
already normalized to workspace-root-relative). Because it is a pure query over the built
`WorkspaceGraph`, the *same* function backs three surfaces via the existing shared plumbing:
a new editor command (`speckitAtlas.showSpecsForFile`), the `speckit-atlas` CLI, and the
`speckit-atlas-mcp` server. Matching is **exact-file first, folder fallback** with a `matchKind`
label; data source is **011 references only — no git** (deterministic, offline). Read-only,
offline, telemetry-free. No new dependency, no engine bump.

## Technical Context

**Language/Version**: TypeScript `strict` (ESM, `.js` import specifiers), same as the repo.

**Primary Dependencies**: None new. Core is dependency-free; MCP surface reuses the existing
`@modelcontextprotocol/sdk`; CLI uses `node:util`. No git, no network.

**Storage**: N/A — operates on the in-memory `WorkspaceGraph` (extension) or a fresh read-only
`node:fs` scan (CLI/MCP via `platform/nodeScan` + `platform/runQuery`).

**Testing**: `node:test` in plain Node for the pure query + format + CLI/MCP parity (fixtures
under `fixtures/graph/code-references/`); `@vscode/test-electron` for the command integration
(active-file resolution, quick pick, open/reveal actions, no-active-file degradation).

**Target Platform**: VS Code extension host (Node) + headless Node (CLI/MCP). Offline.

**Project Type**: Single TypeScript project, layered `core/` → `platform/` → {`cli/`,`mcp/`} and
`core/` → `extension/` → `webview/` (dependencies point inward; `core/` imports neither).

**Performance Goals**: Reverse lookup is O(nodes × codeReferences) over the already-built,
cached graph — sub-millisecond at the 200-spec scale. The extension command does **no** re-scan
(reuses the in-memory graph), so it adds nothing to the Principle IV budgets.

**Constraints**: Offline; read-only (no create/modify/move/delete); telemetry-free; pure core
with zero `vscode`/DOM imports; deterministic output (byte-identical for identical inputs);
degrade to partial results + warnings, never throw.

**Scale/Scope**: Hundreds of specs across dozens of projects; a file may match several specs
across (scoped) projects. One pure function + thin adapters on four existing surfaces.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment | Verdict |
|-----------|------------|---------|
| **I. Pure core, thin shell** | `specsForFile` is a pure function in `src/core/query/` (no `vscode`/DOM/Node imports). CLI/MCP reach it through the existing `platform/runQuery`; the editor command is a thin adapter that resolves the active/explorer file to a `(projectId, relPath)` and calls the core over the in-memory graph. | ✅ Pass |
| **II. Resilient parsing** | The function is total and never throws: unknown file → empty match set; `specToCode` off (no `codeReferences`) → empty set; malformed inputs → skipped, not fatal. The command shows a clear "no related specs" / "no active file" message rather than erroring. | ✅ Pass |
| **III. Read-only** | Only reads. Actions open a spec / reveal-focus the map read-only (reusing 011's `openSpec` and 010's focus). **Data source is 011 references only — git (012) is intentionally excluded**, so this feature reads no VCS at all. | ✅ Pass |
| **IV. Responsive** | Extension path reuses the cached in-memory `WorkspaceGraph` — no new scan, no new watcher. Lookup is trivially linear. Command activation is lazy (`onCommand`, auto-added by VS Code). | ✅ Pass |
| **V. Complement, require nothing proprietary** | Works on a vanilla Spec Kit repo (references come from ordinary `tasks.md`/spec artifacts via 011). All ids namespaced `speckitAtlas.*`; new command id `speckitAtlas.showSpecsForFile`; menu contributions do not claim file associations. Coexists with speckit-companion. | ✅ Pass |
| **VI. Offline, private, telemetry-free** | No network, no git, no telemetry. CLI/MCP stay stdio/offline. | ✅ Pass |

**Result**: PASS — no violations. Complexity Tracking below is intentionally empty.

**Re-check after Phase 1 design**: PASS (unchanged). The design adds one pure function, one
new `QueryKind` (`"file"`), thin adapters on four surfaces, and at most one small host→controls
protocol echo (`focusMode`, see research R-6) — none of which touch a principle. The 002/004/011
model and semantics are unchanged; `codeReferences` is consumed, not modified.

## Project Structure

### Documentation (this feature)

```text
specs/013-show-specs-for-file/
├── plan.md              # This file (/speckit-plan)
├── research.md          # Phase 0 output — resolved decisions
├── data-model.md        # Phase 1 output — query types + match algorithm
├── quickstart.md        # Phase 1 output — how to validate end-to-end
├── contracts/           # Phase 1 output — query/CLI/MCP/command contracts
│   ├── query-file.md
│   ├── cli-specs-for-file.md
│   ├── mcp-atlas_specs_for_file.md
│   └── command-show-specs-for-file.md
└── checklists/
    └── requirements.md  # Written by /speckit-specify
```

### Source Code (repository root)

```text
src/core/query/
├── types.ts          # + QueryKind "file"; + SpecsForFile, RelatedSpec, MatchKind; extend QueryResult union
├── queries.ts        # + specsForFile(graph, path, scope?)  (exact-then-folder matcher)
├── format.ts         # + "file" case in formatText
└── index.ts          # export specsForFile + new types

src/core/
├── path.ts           # NEW pure util: normalizeWorkspacePath() — single source of truth for
│                      #   root-relative normalization, shared by graph heuristics + the query
└── graph/heuristics.ts  # normalizeCodePath delegates to core/path (no behavior change; kills drift)

src/platform/
└── runQuery.ts       # + `path?` on RunQueryInput; + case "file" → specsForFile

src/cli/
└── main.ts           # + `specs-for-file <path>` command (honors --root, --project)

src/mcp/
└── main.ts           # + `atlas_specs_for_file` tool (required `path`, + COMMON)

src/extension/
└── extension.ts      # + registerCommand("speckitAtlas.showSpecsForFile"); resolve file→(projectId,relPath);
│                      #   run core specsForFile over in-memory graph; quick pick; open-spec / reveal-focus actions
src/webview/
└── protocol.ts       # (only if R-6 sync chosen) + HostToControls "focusMode" echo

package.json          # + command contribution; + menus (commandPalette, editor/context,
                      #   explorer/context, editor/title). No new dep, no engine bump.

test/  (mirrors)      # node:test: specsForFile, format "file", CLI/MCP parity;
fixtures/graph/code-references/   # reuse + extend for reverse-lookup cases
```

**Structure Decision**: Single project, existing layering. The feature's weight lives almost
entirely in one pure core function; every surface (command, CLI, MCP) is an existing adapter
that gains a thin case. The one genuinely new file is a tiny shared path-normalizer
(`src/core/path.ts`) so the query normalizes the incoming path *identically* to how 011
normalized the stored `codeReferences` — a single source of truth that guarantees determinism
(SC-004) and prevents drift.

## Complexity Tracking

> No constitutional violations — this feature is additive and stays within all six principles.
> Table intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
