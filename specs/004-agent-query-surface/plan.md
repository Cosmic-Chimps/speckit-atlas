# Implementation Plan: Agent Query Surface

**Branch**: `004-agent-query-surface` | **Date**: 2026-07-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-agent-query-surface/spec.md`

## Summary

Expose the feature-002 graph headlessly through **two sibling entry points** — a **CLI**
(`speckit-atlas`) and a local **MCP server** (`speckit-atlas-mcp`) — that share the pure
core and a new read-only `node:fs` scan. A new **pure `src/core/query/`** module answers
the queries (graph, a spec's relationships, status summary, orphans, a `no-orphans` check)
and wraps them in a versioned, deterministic JSON envelope; the CLI adds an optional human
text mode and maps a failed check to exit 1. Read-only, offline, telemetry-free; the bins
are excluded from the `.vsix`. Tests run entirely in plain Node — no editor.

## Technical Context

**Language/Version**: TypeScript (`strict`), Node.js LTS.

**Primary Dependencies**: **`@modelcontextprotocol/sdk`** (MCP server only — one new
runtime dep, local/stdio, does not enter the `.vsix`). CLI uses built-in `node:util
parseArgs` (no dep). Core query layer has no dependencies.

**Storage**: N/A — read-only; nothing persisted.

**Testing**: `node:test` for the pure query/envelope/format/check helpers; CLI tested by
spawning `node dist/cli.js`; MCP tested via an in-process SDK client over stdio. No
`@vscode/test-electron`.

**Target Platform**: plain Node (headless); launched by a person, CI, or an MCP client.

**Performance Goals**: one-shot queries fast enough for interactive agent use on hundreds
of specs (target: a few seconds); deterministic output.

**Constraints**: pure core reused unchanged; only new I/O is read-only `node:fs`; fully
offline (MCP over stdio, no network); no telemetry; no workspace writes (no cache/memory
file); vanilla repo; versioned, byte-deterministic JSON.

**Scale/Scope**: query surface only — consumes 002's model, adds no parsing/rendering.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Gate | Status |
|---|-----------|------|--------|
| I | Pure Domain Core, Thin Editor Shell | Queries are pure functions in `src/core/query/`; CLI/MCP are thin adapters; the only new I/O is a read-only `node:fs` scan feeding the existing `buildWorkspaceGraph`. | ✅ PASS — research D1/D2. |
| II | Resilient Parsing Over Rigid Schemas | Query functions are total; empty/malformed graphs → empty results + warnings; unknown spec id → `found:false`; MCP survives bad tool calls. | ✅ PASS — Q-7, MCP-7. |
| III | Read-Only by Default | No writes anywhere — no cache, no memory file; `node:fs` reads only. Explicitly baked into FR-014 + Out of Scope. | ✅ PASS — SC-004, CLI-7, MCP-5. |
| IV | Responsive at Workspace Scale | Headless one-shot; per-project scoping; deterministic; no editor. (The <50 ms activation budget is an extension concern, N/A here.) | ✅ PASS. |
| V | Complement the Ecosystem | Vanilla repo, no proprietary metadata; separate bins that don't touch the extension's contributions or speckit-companion. | ✅ PASS. |
| VI | Offline, Private, Telemetry-Free | No network (MCP=stdio, CLI local); no telemetry; the one new dep is local/audited and MCP-only, outside the `.vsix`. | ✅ PASS — research D4/D8. |
| — | Tech constraints (TS strict, layering, minimal deps, fixture-driven) | Only MCP SDK added; CLI dep-free; query heuristics reuse 002's fixtures. | ✅ PASS. |

**Result**: All gates pass. The one new runtime dependency (`@modelcontextprotocol/sdk`)
is scoped to the MCP entry, local, and audited — within the constitution's "minimal,
audited runtime dependencies." No deviations → Complexity Tracking empty.

## Project Structure

### Documentation (this feature)

```text
specs/004-agent-query-surface/
├── plan.md · research.md · data-model.md · quickstart.md
├── contracts/query-core-api.md · contracts/cli-contract.md · contracts/mcp-contract.md
└── checklists/requirements.md
```

### Source Code (repository root) — additions in **bold**

```text
src/
├── core/
│   ├── graph/                  # UNCHANGED (feature 002)
│   └── query/                  # ** NEW pure module **
│       ├── queries.ts          # getGraph/specRelationships/statusSummary/orphans/runCheck
│       ├── envelope.ts         # toEnvelope + deterministic ordering
│       ├── format.ts           # pure human-text renderer (CLI --format text)
│       └── index.ts            # re-exported via core/index.ts
├── platform/
│   └── nodeScan.ts             # ** NEW ** read-only node:fs → ProjectSnapshot[] (CLI + MCP)
├── cli/
│   └── main.ts                 # ** NEW ** parseArgs → query → JSON|text; exit codes → dist/cli.js
├── mcp/
│   └── main.ts                 # ** NEW ** @modelcontextprotocol/sdk stdio server → dist/mcp.js
├── extension/                  # UNCHANGED
└── webview/                    # UNCHANGED

esbuild.js                      # ** + dist/cli.js and dist/mcp.js (node/cjs) entries **
package.json                    # ** + bin {speckit-atlas, speckit-atlas-mcp}; dep @modelcontextprotocol/sdk **
.vscodeignore                   # ** + exclude dist/cli.js, dist/mcp.js from the .vsix **
test/
├── core/                       # + query/envelope/format/check tests (Q-1…Q-8)
├── cli/                        # ** NEW ** spawn dist/cli.js (CLI-1…CLI-9)
└── mcp/                        # ** NEW ** in-process SDK client over stdio (MCP-1…MCP-7)
fixtures/graph/                 # reuse feature 002/003 fixtures (render-demo, two-projects, …)
```

**Structure Decision**: `core/` gains only a pure `query/` module; the two surfaces
(`cli/`, `mcp/`) and the `node:fs` scan (`platform/`) are the sole new adapters, both
read-only. The extension and webview are untouched. Both bins build via esbuild (Node
target) and are kept out of the `.vsix`; they ship via npm `bin`. Because everything is
headless, the entire test suite for 004 runs in plain Node — no Electron.

## Complexity Tracking

> No constitution violations. The single new runtime dependency is explicitly permitted.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
