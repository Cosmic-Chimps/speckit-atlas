---
description: "Task list for Agent Query Surface implementation"
---

# Tasks: Agent Query Surface

**Input**: Design documents from `/specs/004-agent-query-surface/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: INCLUDED. The constitution mandates a passing CI test gate; the contracts define
assertable behaviors (Q-*, CLI-*, MCP-*). Everything is headless — the whole suite runs in
plain Node (`node:test`, spawned CLI, in-process MCP client); no `@vscode/test-electron`.

**Organization**: By user story. US1 (graph + a spec's relationships, via CLI **and** MCP) is
the MVP; US2 adds status/orphans; US3 adds the deterministic CI check. Polish adds the CLI
text mode + docs + gate.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallelizable (different files, no dependency on an incomplete task)
- **[Story]**: US1 / US2 / US3 (Setup, Foundational, Polish carry no label)
- `core/` (incl. the new pure `core/query/`) has zero `vscode`/DOM/Node imports; the only new
  I/O is read-only `node:fs` in `src/platform/nodeScan.ts`.

---

## Phase 1: Setup

- [X] T001 Add `@modelcontextprotocol/sdk` runtime dependency and `bin` entries (`speckit-atlas` → `dist/cli.js`, `speckit-atlas-mcp` → `dist/mcp.js`) to `package.json`; run `npm install`
- [X] T002 [P] Add esbuild Node/CJS entries for `src/cli/main.ts` → `dist/cli.js` and `src/mcp/main.ts` → `dist/mcp.js` in `esbuild.js` (bundle the MCP SDK; `vscode` stays external and is not imported here)
- [X] T003 [P] Exclude `dist/cli.js` and `dist/mcp.js` from the `.vsix` in `.vscodeignore` (bins ship via npm, not the extension package)
- [X] T004 [P] Add `test:cli` and `test:mcp` npm scripts (compile + `node --test`) and include them in the aggregate `test` script in `package.json`

**Checkpoint**: build emits `dist/cli.js` + `dist/mcp.js`; existing suites still green.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The pure query plumbing + the read-only scan every surface/story depends on.

**⚠️ CRITICAL**: No user-story work begins until this phase is complete.

- [X] T005 Define query types (`QueryKind`, `QueryScope`, `SpecRelationships`, `StatusSummary`, `Orphans`, `CheckResult`, `QueryResult`) in `src/core/query/types.ts` per data-model.md
- [X] T006 Implement `toEnvelope` + deterministic ordering helpers (stable node/edge sort; no timestamps/run metadata) in `src/core/query/envelope.ts`
- [X] T007 [P] Implement read-only `src/platform/nodeScan.ts`: `node:fs` two-layer scan (feature-folder artifacts + content files) → `ProjectSnapshot[]`, mirroring `extension/projectScan.ts` but editor-free
- [X] T008 Create `src/core/query/index.ts` barrel and re-export the query API from `src/core/index.ts` (query functions are filled in per story)
- [X] T009 [P] Core test for `toEnvelope` determinism + JSON round-trip in `test/core/query-envelope.test.ts` (Q-6)

**Checkpoint**: `test:core` green; envelope deterministic; scan produces snapshots headlessly.

---

## Phase 3: User Story 1 - Graph & spec relationships, headless (Priority: P1) 🎯 MVP

**Goal**: From outside the editor, get a project's graph and a single spec's relationships,
via both the CLI and the MCP server.

**Independent Test**: Run `node dist/cli.js graph`/`spec` against `fixtures/graph/render-demo`
and call `atlas_graph`/`atlas_spec_relationships` via an MCP client; both return the model's
data as a versioned JSON envelope.

### Tests for User Story 1

- [X] T010 [P] [US1] Core tests: `getGraph` scoping (Q-1) + `specRelationships` incl. unknown-id `found:false` (Q-2) in `test/core/query.test.ts`
- [X] T011 [P] [US1] CLI test: spawn `node dist/cli.js graph|spec … --root fixtures/graph/render-demo` and assert the envelope + zero workspace writes (CLI-1, CLI-2, CLI-7) in `test/cli/graph.test.ts`
- [X] T012 [P] [US1] MCP test: in-process SDK client over stdio lists tools and calls `atlas_graph`/`atlas_spec_relationships` (MCP-1, MCP-2, MCP-3) in `test/mcp/tools.test.ts`

### Implementation for User Story 1

- [X] T013 [US1] Implement `getGraph` + `specRelationships` (pure) in `src/core/query/queries.ts`
- [X] T014 [US1] Implement the CLI shell `src/cli/main.ts`: `node:util.parseArgs`, `--root`/`--project` + heuristic flags → `nodeScan` → `buildWorkspaceGraph` → `graph`/`spec` commands → JSON envelope on stdout; wires `dist/cli.js`
- [X] T015 [US1] Implement the MCP server `src/mcp/main.ts`: `@modelcontextprotocol/sdk` stdio server exposing `atlas_graph` + `atlas_spec_relationships` over the same query path; wires `dist/mcp.js`

**Checkpoint**: MVP — an agent (MCP) or a person/CI (CLI) can retrieve the graph and a spec's relationships, headless.

---

## Phase 4: User Story 2 - Status & orphan insight (Priority: P2)

**Goal**: Implementation-status/completeness summary and the set of orphaned specs, on both surfaces.

**Independent Test**: `status`/`orphans` (CLI) and `atlas_status_summary`/`atlas_orphans` (MCP)
against a mixed fixture return counts and the orphan list matching the model.

**Depends on**: US1 (query module + CLI/MCP shells).

### Tests for User Story 2

- [X] T016 [P] [US2] Core tests: `statusSummary` (Q-3) + `orphans` (Q-4) in `test/core/query.test.ts`
- [X] T017 [P] [US2] CLI + MCP tests for `status`/`orphans` and `atlas_status_summary`/`atlas_orphans` in `test/cli/status.test.ts` and `test/mcp/tools.test.ts`

### Implementation for User Story 2

- [X] T018 [US2] Implement `statusSummary` + `orphans` (pure) in `src/core/query/queries.ts`
- [X] T019 [US2] Add `status` + `orphans` CLI commands (`src/cli/main.ts`) and `atlas_status_summary` + `atlas_orphans` MCP tools (`src/mcp/main.ts`)

**Checkpoint**: US1 + US2 — the full read query set on both surfaces.

---

## Phase 5: User Story 3 - Deterministic CI check (Priority: P3)

**Goal**: An opt-in check (`no-orphans`) with a machine-detectable pass/fail — CLI exit code, MCP structured result.

**Independent Test**: `check --rule no-orphans` exits 1 on a repo with orphans and 0 on a
clean one; `atlas_check` returns `{ ok, violations }`; two runs are byte-identical.

**Depends on**: US1 (shells) + US2 (orphans query the check builds on).

### Tests for User Story 3

- [X] T020 [P] [US3] Core tests: `runCheck("no-orphans")` pass/fail + unknown-rule behavior (Q-5) in `test/core/query.test.ts`
- [X] T021 [P] [US3] CLI test: `check` exits 1 on orphans / 0 clean (CLI-4) and byte-identical output on repeat (CLI-6) in `test/cli/check.test.ts`
- [X] T022 [P] [US3] MCP test: `atlas_check` returns `{ ok, violations }` without exiting the server (MCP-4) in `test/mcp/tools.test.ts`

### Implementation for User Story 3

- [X] T023 [US3] Implement `runCheck` (rule `no-orphans`, extensible; unknown rule → documented non-throwing result) in `src/core/query/queries.ts`
- [X] T024 [US3] Add `check [--rule]` CLI command mapping `ok:false` → exit 1 (`src/cli/main.ts`) and the `atlas_check` MCP tool (`src/mcp/main.ts`)

**Checkpoint**: All three stories functional — query + insight + gate, on both surfaces.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T025 [P] Implement pure `formatText(envelope)` in `src/core/query/format.ts` and wire CLI `--format text` across all commands (JSON remains default; MCP stays JSON-only); test in `test/cli/format.test.ts` (CLI-5)
- [X] T026 [P] Determinism sweep: a test running each read command twice on `fixtures/graph/render-demo` asserting byte-identical stdout (CLI-6/SC-005) in `test/cli/determinism.test.ts`; add a `--project` scoping assertion on `fixtures/graph/two-projects` (CLI-8/SC-006)
- [X] T027 [P] Update `CHANGELOG.md` (CLI + MCP query surface) and `README.md` (usage + an MCP client config snippet)
- [X] T028 Run the full gate — typecheck, lint, format, `test:core`, `test:contracts`, `test:cli` (incl. the T030 offline test), `test:mcp`, `check:size` — and confirm the packaged `.vsix` is unchanged (bins excluded)
- [X] T029 [P] Validate `quickstart.md` smoke commands against `fixtures/graph/render-demo` and `fixtures/graph/two-projects` (SC-004 no writes / SC-007 check signal)
- [X] T030 [P] Offline / no-network verification for the new surfaces (FR-015 / SC-004): in `test/cli/offline.test.ts` — (a) **first-party** `dist/cli.js` must contain no network/telemetry sinks (`XMLHttpRequest`/`fetch(`/`WebSocket`/`sendBeacon`/telemetry) nor a remote URL; (b) assert `src/mcp/main.ts` constructs **only** the stdio transport (no HTTP/SSE transport import or wiring) — the correct offline check for the MCP surface, since the bundled SDK legitimately contains unused HTTP/SSE transport code (treated like the third-party cytoscape bundle, so `dist/mcp.js` is NOT blanket sink-scanned); (c) a spawned CLI run makes no network connection

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (P1)** → **Foundational (P2, blocks all stories)** → **US1** → US2 → US3 → **Polish**.
- **US2** depends on US1 (query module + CLI/MCP shells already exist).
- **US3** depends on US1 (shells) and US2 (`orphans`, which `no-orphans` builds on).

### Within Each Story

- Types + envelope + scan (Foundational) before any query.
- Pure query functions before the CLI/MCP wiring that calls them.
- `src/core/query/queries.ts` is edited by T013/T018/T023 (sequential); `src/cli/main.ts` by
  T014/T019/T024 (sequential); `src/mcp/main.ts` likewise — same-file chains.

---

## Parallel Opportunities

- **Setup**: T002/T003/T004 [P] after T001.
- **Foundational**: T007 + T009 [P]; T005→T006→T008 mostly sequential (shared query module).
- **US1**: all three tests T010/T011/T012 [P]; then core T013 → CLI T014 / MCP T015.
- **US2**: T016/T017 [P]; T018 (core) → T019 (surfaces).
- **US3**: T020/T021/T022 [P]; T023 (core) → T024 (surfaces).
- **Polish**: T025/T026/T027/T029/T030 [P]; T028 (gate) last.

### Parallel Example: User Story 1

```bash
Task: "T010 core getGraph/specRelationships tests"
Task: "T011 CLI graph/spec spawn test"
Task: "T012 MCP atlas_graph/atlas_spec_relationships client test"
# then implement T013 → T014 / T015
```

---

## Implementation Strategy

### MVP First (US1 only)

1. Setup → 2. Foundational → 3. US1 → **STOP & VALIDATE**: `node dist/cli.js graph` and the
   `atlas_graph` MCP tool return the model for `fixtures/graph/render-demo`, headless.

### Incremental Delivery

1. Foundational ready. 2. US1 → graph + spec on both surfaces (demo). 3. US2 → status +
   orphans. 4. US3 → the CI check + exit signal. 5. Polish → text mode, determinism, docs, gate.

---

## Notes

- [P] = different files, no dependency on an incomplete task.
- `core/` stays pure (query layer included); the sole new I/O is read-only `node:fs`
  (`src/platform/nodeScan.ts`). No workspace writes, no network, no telemetry (Principles III/VI).
- Reuse feature 002/003 fixtures (`render-demo`, `two-projects`, `cross-links`, `malformed`).
- The `.vsix` and its bundle-size budget (feature 003) are untouched — `dist/cli.js` /
  `dist/mcp.js` are excluded from the package.

### Test layout (as implemented)

Per-behavior test tasks were **consolidated** into four files (all plain Node); every
Q-*/CLI-*/MCP-* contract behavior is covered:

- `test/core/query.test.ts` — Q-1…Q-6 (getGraph, specRelationships, statusSummary, orphans,
  runCheck, envelope determinism). Covers T009, T010, T016, T020.
- `test/cli/cli.test.ts` — CLI-1…CLI-8 (graph, spec, status, orphans, check exit codes,
  `--format text`, determinism, `--project` scoping, no-writes). Covers T011, T017, T021,
  T025, T026.
- `test/cli/offline.test.ts` — T030 (first-party `dist/cli.js` sink-scan + MCP stdio-only).
- `test/mcp/tools.test.ts` — MCP-1…MCP-4 (tool listing + all five tools over stdio).
  Covers T012, T017, T022.
