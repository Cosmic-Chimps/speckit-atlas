# Quickstart / Validation: MCP Setup for Any Agent Client

Feature 008. Proves the extension generates a correct, copy-ready MCP registration for a
non-VS-Code client — writing nothing. Run from repo root.

## Prerequisites

- `npm install`; `npm run build`.
- The extension installed/running (F5 dev host) on a Spec Kit workspace.

## Build & static gates

```bash
npm run build
npm run lint
npm run typecheck
```

## Automated tests

```bash
npm run test:contracts   # pure formatRegistration: each client form + quoting + bundled/npm launch
npm run test:integration # command registered; generate-for-client hook; asserts NO file written
```

## Manual validation (matches spec Success Criteria)

1. **Set up my agent (SC-001, US1)**
   - Command palette → **SpecKit Atlas: Set up MCP for your agent**.
   - Pick **Claude Code** → the `claude mcp add speckit-atlas -- …` command is copied to the
     clipboard and shown. Paste it into a terminal, run it, then `/mcp` in Claude Code →
     the `atlas_*` tools appear.

2. **Right form per client (SC-002, US2)**
   - Re-run and pick **Cursor** → a `.cursor/mcp.json` JSON snippet; **Claude Desktop** → a
     `claude_desktop_config.json` block; **Other** → the generic stdio command+args. Each
     applies to that client without hand-editing.

3. **Works without the npm package (SC-003, US3)**
   - Without `speckit-atlas-mcp` installed, the generated config points at the extension's
     bundled `dist/mcp.js` (an absolute, existing path) and launches.

4. **Quoting (FR-010)**
   - On an install path containing a space, confirm the produced command/JSON is valid and
     runs verbatim.

5. **Multi-root (SC-006, FR-008)**
   - In a multi-root workspace, pick a folder → the registration's `--root` is that folder.

6. **No workspace (FR-007)**
   - With no folder open, the command explains what's needed and produces nothing.

7. **Read-only + offline (SC-004/SC-005, FR-011/FR-006)**
   - After generating for every client, `git status` shows **no** workspace writes, and no
     global config file is created by the extension; works offline.

## Definition of done

- Static gates green; `test:contracts` (formatter) + `test:integration` (command + no-write)
  green.
- Read-only (clipboard + untitled doc only), offline, telemetry-free; `core/`, `platform/`,
  `mcp/`, and `cli/` unchanged; no new dependency.

## Reference

- Contract: [`contracts/mcp-setup.md`](./contracts/mcp-setup.md)
- Data model: [`data-model.md`](./data-model.md)
- Decisions: [`research.md`](./research.md)
