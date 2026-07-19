# Quickstart / Validation: In-Editor MCP Auto-Discovery

Feature 007. Proves that installing the extension makes the query tools auto-discoverable
to an in-editor agent — no npm install, no MCP config. Run from repo root.

## Prerequisites

- VS Code ≥ 1.101 (the raised floor).
- `npm install` done; `npm run build` (emits `dist/extension.js` and `dist/mcp.js`).

## Build & static gates

```bash
npm run build            # esbuild emits dist/mcp.js (now shipped in the vsix)
npm run lint
npm run typecheck        # strict; engines bump does not break the type project
```

## Automated tests

```bash
npm run test:contracts   # + pure buildServerDefinitions: per-folder, --root, env, cwd, bundled path
npm run test:mcp         # unchanged — proves the advertised server's tool parity via runQuery
npm run test:integration # + provider registers under the real API; dist/mcp.js present; api gated
```

## Manual validation (matches spec Success Criteria)

1. **Zero-config discovery (SC-001, US1)**
   - Launch the Extension Development Host (F5) on a Spec Kit workspace.
   - Open the editor's MCP / agent-tools view → a **SpecKit Atlas** server appears with the
     five `atlas_*` tools, with **no** `npm install` and **no** config edit.
   - Ask the agent "which specs depend on 003?" / "any orphaned specs?" → it calls a tool
     and answers.

2. **Parity (SC-002, US2)**
   - Run the same query via the standalone CLI: `node dist/cli.js spec 003-graph-rendering --root .`
   - Compare with the agent's tool result → equivalent.

3. **Per-project scoping (SC-003)**
   - Open a multi-root workspace (e.g. `fixtures/graph/two-projects`).
   - Confirm one **SpecKit Atlas — <folder>** server per folder; a scoped query returns only
     that project's sub-graph, zero cross-project edges.

4. **No-workspace / no-specs (SC-005, FR-008)**
   - Open a plain folder with no specs → tools return a clear empty result (no error/crash).

5. **Read-only + offline (SC-004, FR-005/006)**
   - After exercising every tool, `git status` shows **no** workspace writes; disconnect the
     network and confirm tools still work (stdio, no HTTP).

6. **npm channel intact (US3, FR-007)**
   - `node dist/cli.js graph --root .` and `node dist/mcp.js` still run exactly as before.

7. **Editor floor (SC-006, FR-012)**
   - Confirm `package.json` declares `engines.vscode: ^1.101.0`; an editor below that is
     offered the npm channel, not a half-working install.

8. **Packaging / size (D5)**
   - `npx @vscode/vsce ls` lists `dist/mcp.js` and does **not** list `dist/cli.js`.
   - Packaged `.vsix` size is under the ≤ 2 MB budget.

## Definition of done

- Static gates green; `dist/mcp.js` bundled in the vsix; `.vsix` ≤ 2 MB.
- `test:contracts` (builder) + `test:mcp` (parity) + `test:integration` (registration) green.
- Read-only, offline, telemetry-free across every tool; `core/`, `platform/`, `src/mcp`,
  and the CLI unchanged.

## Reference

- Contract: [`contracts/mcp-provider.md`](./contracts/mcp-provider.md)
- Data model: [`data-model.md`](./data-model.md)
- Decisions: [`research.md`](./research.md)
