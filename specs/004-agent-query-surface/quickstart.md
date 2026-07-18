# Quickstart & Validation: Agent Query Surface

Runnable steps proving the headless surface works. Types/behaviors: `data-model.md`,
`contracts/`. The graph model comes from feature 002 unchanged. **No editor required** —
everything runs in plain Node.

## Prerequisites

- Node.js (LTS); `npm install` (adds `@modelcontextprotocol/sdk` for the MCP server).
- Run from the repo root.

## Build & static gates

```bash
npm run typecheck        # strict; core-purity project still passes (query layer is pure)
npm run lint
npm run format
npm run build            # esbuild also emits dist/cli.js and dist/mcp.js (Node)
```

## Pure query tests (plain Node)

```bash
npm run test:core        # + query functions: getGraph / specRelationships / statusSummary
                         #   / orphans / runCheck / toEnvelope (Q-1…Q-8)
```

## CLI tests (plain Node — spawn the built CLI)

```bash
npm run test:cli         # spawns `node dist/cli.js …` against fixtures/graph/* (CLI-1…CLI-9)
```

Manual smoke:

```bash
node dist/cli.js graph   --root fixtures/graph/render-demo            # JSON envelope
node dist/cli.js spec    001-alpha --root fixtures/graph/render-demo  # dependsOn/dependedOnBy
node dist/cli.js status  --root fixtures/graph/render-demo
node dist/cli.js orphans --root fixtures/graph/render-demo
node dist/cli.js check   --rule no-orphans --root fixtures/graph/render-demo; echo "exit=$?"
node dist/cli.js graph   --root fixtures/graph/render-demo --format text
```

## MCP tests (plain Node — in-process SDK client over stdio)

```bash
npm run test:mcp         # starts dist/mcp.js, lists tools, calls each (MCP-1…MCP-7)
```

## Validation → Success Criteria

1. **SC-001/SC-002** — `graph` and `spec` envelopes equal the model (CLI-1/CLI-2, MCP-2).
2. **SC-003** — `status` + `orphans` match the model (CLI-3, Q-3/Q-4).
3. **SC-004** — a file-watch/`git status` around any command shows **zero** workspace
   writes; no network (CLI-7, MCP-5).
4. **SC-005** — run any command twice on an unchanged repo → byte-identical stdout (CLI-6).
5. **SC-006** — `--project`/tool `projectId` on `fixtures/graph/two-projects` → one
   sub-graph, zero cross-project edges (CLI-8).
6. **SC-007** — `check --rule no-orphans` exits 1 on a repo with orphans, 0 on a clean one
   (CLI-4); the MCP tool returns `ok:false`/`ok:true` (MCP-4).
7. **SC-008** — a large synthetic workspace query returns in a few seconds, no editor.

## Definition of done

- Static gates green; `dist/cli.js` + `dist/mcp.js` build; `core/` still pure.
- test:core (queries) + test:cli + test:mcp green — all in plain Node, no `@vscode/test-electron`.
- Read-only, offline, no telemetry across every command/tool. `.vsix` unchanged (bins excluded).
