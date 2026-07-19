# Implementation Plan: In-Editor MCP Auto-Discovery

**Branch**: `007-mcp-provider-contribution` | **Date**: 2026-07-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-mcp-provider-contribution/spec.md`

## Summary

Make the feature-004 query surface discoverable to in-editor AI agents the moment the
extension is installed — no `npm install`, no manual MCP config. The extension already
contains a complete stdio MCP server (`src/mcp/main.ts` → `dist/mcp.js`, five `atlas_*`
tools over the shared `runQuery` → pure core + read-only `nodeScan`). This feature does
**not** write a second server; it **advertises the existing one** to VS Code via the
stable **MCP server-definition provider** contribution (`contributes.mcpServerDefinition
Providers` + `vscode.lm.registerMcpServerDefinitionProvider`). The provider returns one
`McpStdioServerDefinition` **per workspace folder**, each spawning the bundled `dist/mcp.js`
with `--root <folder>` (run via `process.execPath` + `ELECTRON_RUN_AS_NODE=1`, so no
external Node is required). To ship it, `dist/mcp.js` is **included in the `.vsix`**
(reversing the feature-004 exclusion) and `engines.vscode` is raised to the release that
stabilized the API (~`^1.101.0`, the resolved spec decision). Parity with the standalone
`speckit-atlas-mcp` is automatic — same binary, same `runQuery`. Read-only, offline
(stdio), telemetry-free. Pure `core/` is unchanged; the CLI/MCP npm channel is untouched.

## Technical Context

**Language/Version**: TypeScript (`strict`); VS Code raised to **`^1.101.0`** (the MCP
server-definition provider API's stable floor).

**Primary Dependencies**: No new runtime dependency. Reuses the already-present
`@modelcontextprotocol/sdk` (bundled into `dist/mcp.js`) and the VS Code `lm` MCP API.

**Storage**: N/A — the server reads the workspace via the existing read-only `node:fs`
scan; nothing persisted.

**Testing**: pure builder (`buildServerDefinitions`) via `node:test` (plain Node);
`@vscode/test-electron` for provider registration + bundled-binary presence; the existing
`test/mcp/tools.test.ts` continues to prove tool parity (same `runQuery`).

**Target Platform**: VS Code desktop (extension host spawns a local stdio subprocess).

**Performance Goals**: registering the provider is O(1) at activation; the server
subprocess is lazily started by VS Code only when an agent uses a tool — no eager work,
no regression to the < 50 ms activation budget.

**Constraints**: read-only; offline (stdio only, no network/HTTP); no telemetry; `.vsix`
stays within the ≤ 2 MB budget after adding `dist/mcp.js` (~565 KB) — measured in the
plan's size check. Lazy activation (`workspaceContains`) preserved.

**Scale/Scope**: a thin editor-shell adapter (a provider + a pure definition builder) plus
packaging/manifest changes. No `core/`, query, CLI, or MCP-server-logic changes.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Gate | Status |
|---|-----------|------|--------|
| I | Pure Domain Core, Thin Editor Shell | Core, query, and the MCP server logic are unchanged. New code is a pure `buildServerDefinitions` helper + a thin `registerMcpServerDefinitionProvider` adapter in `extension/`. | ✅ PASS |
| II | Resilient Parsing Over Rigid Schemas | The server reuses `runQuery`, which never throws; a folder with no specs yields an empty envelope, not an error (FR-008). Provider returns `[]` when there are no folders. | ✅ PASS |
| III | Read-Only by Default | The advertised server is the existing read-only surface (node:fs scan only); no workspace writes anywhere in this feature (FR-005). | ✅ PASS |
| IV | Responsive at Workspace Scale | Provider registration is trivial; VS Code lazily spawns the server only on first tool use; activation stays `workspaceContains` and within budget (FR-011). | ✅ PASS |
| V | Complement the Ecosystem | Namespaced provider id `speckitAtlas.mcp`; coexists with a user-registered standalone server (FR-013); requires nothing proprietary. | ✅ PASS |
| VI | Offline, Private, Telemetry-Free | stdio transport only — no network/HTTP; SDK bundled locally (no CDN); no telemetry (FR-006). | ✅ PASS |
| — | Tech constraints (TS strict, layering, esbuild, deps, size, explicit engine) | No new dep; `engines.vscode` raised **explicitly** and tested against the electron floor; `.vsix` ≤ 2 MB asserted after bundling `mcp.js`. | ✅ PASS |

**Result**: All gates pass. The engine-floor raise and bundling `mcp.js` are deliberate,
spec-resolved decisions (they widen in-editor value, not complexity). No new dependency,
no core change. Complexity Tracking empty.

## Project Structure

### Documentation (this feature)

```text
specs/007-mcp-provider-contribution/
├── plan.md · research.md · data-model.md · quickstart.md
├── contracts/mcp-provider.md
└── checklists/requirements.md
```

### Source Code (repository root) — additions/changes in **bold**

```text
src/
├── core/                         # UNCHANGED (pure)
├── mcp/main.ts                   # UNCHANGED (the stdio server it advertises)
├── platform/                     # UNCHANGED (runQuery + nodeScan)
├── cli/                          # UNCHANGED (npm-only, still excluded from .vsix)
└── extension/
    ├── mcpProvider.ts            # ** NEW ** pure buildServerDefinitions() + provider factory
    └── extension.ts              # ** update ** register the MCP server-definition provider
package.json                      # ** update ** engines.vscode ^1.101.0; contributes.mcpServerDefinitionProviders
.vscodeignore                     # ** update ** stop excluding dist/mcp.js (+.map); keep cli excluded
esbuild.js                        # UNCHANGED (already emits dist/mcp.js)
test/
├── contracts/mcp-provider.test.ts   # ** NEW ** pure: folders → definitions (root/env/cwd/label)
├── mcp/tools.test.ts                # UNCHANGED (proves tool parity via runQuery)
└── integration/mcp-provider.test.ts # ** NEW ** provider registers; bundled dist/mcp.js present; api gated
```

**Structure Decision**: Single VS Code extension project. All new code lands in the
`extension/` shell — one pure, unit-tested definition builder and one provider registration
— plus manifest/packaging edits. `core/`, `platform/`, `mcp/`, and `cli/` are untouched,
so parity with the standalone server is structural, not asserted by duplication.

## Complexity Tracking

> No constitution violations. Section intentionally empty.
