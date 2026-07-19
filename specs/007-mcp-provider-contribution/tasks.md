---
description: "Task list for feature 007 — In-Editor MCP Auto-Discovery"
---

# Tasks: In-Editor MCP Auto-Discovery

**Input**: Design documents from `/specs/007-mcp-provider-contribution/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/mcp-provider.md

**Tests**: Included — the constitution mandates fixture-driven, CI-gated tests (pure
helpers via `node:test`, editor behavior via `@vscode/test-electron`). Pure tests live
under `test/contracts/`; electron tests under `test/integration/`.

**Organization**: Grouped by user story (US1 P1 → US2 P2 → US3 P3) for independent
implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 / US2 / US3 (setup, foundational, polish have no story label)
- Exact file paths are included in each task.

## Path Conventions

Single VS Code extension project. All new code lands in `src/extension/` (shell) plus
manifest/packaging edits. `src/core/`, `src/platform/`, `src/mcp/main.ts`, and `src/cli/`
are **not** modified — parity with the standalone server is structural (same `dist/mcp.js`).

---

## Phase 1: Setup

**Purpose**: Baseline + raise the editor floor the whole feature depends on.

- [X] T001 Confirm baseline green: run `npm run build` and `npm test`; capture the current packaged size via `npx @vscode/vsce ls` (note whether `dist/mcp.js` is currently excluded) for the T017 budget check. No code changes.
- [X] T002 Raise the editor floor in `package.json`: set `engines.vscode` to `^1.101.0` and bump the `@types/vscode` devDependency to `^1.101`; run `npm install`; confirm `npm run compile:tests` still typechecks (the new `vscode.lm` MCP types resolve).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The pure, testable definition builder every user story depends on. No
`vscode`/`fs` imports — keeps the mapping unit-testable and the shell thin.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T003 Create the pure builder in `src/extension/mcpProvider.ts`: export `McpServerDescriptor` and `buildServerDefinitions({ folders, extensionPath, nodePath, version })` returning **one descriptor per workspace folder** — `command = nodePath`, `args = [<extensionPath>/dist/mcp.js, "--root", <folderPath>]`, `cwd = <folderPath>`, `env = { ELECTRON_RUN_AS_NODE: "1" }`, `version`, and a readable `label` (e.g. `SpecKit Atlas — <folderBasename>`). Return `[]` when `folders` is empty. No `vscode`/`fs`/process imports (per contracts/mcp-provider.md C-1…C-4).
- [X] T004 Unit-test the builder in `test/contracts/mcp-provider.test.ts` (`node:test`): one descriptor per folder; `args[0]` ends with `dist/mcp.js` and lives under `extensionPath`; `args` include `--root <folder>`; `cwd` = folder; `env.ELECTRON_RUN_AS_NODE === "1"`; `version` set; **zero folders → `[]`**.

**Checkpoint**: The mapping from workspace folders to server descriptors exists and is unit-tested.

---

## Phase 3: User Story 1 - Zero-config discovery on install (Priority: P1) 🎯 MVP

**Goal**: With only the extension installed and a Spec Kit workspace open, an in-editor
agent discovers and can call the `atlas_*` query tools — no npm install, no MCP config.

**Independent Test**: In the Extension Development Host on a Spec Kit workspace, the editor
lists a **SpecKit Atlas** MCP server with the five tools and the agent can call one — with
no package install and no configuration edit (SC-001, FR-009).

- [X] T005 [P] [US1] Declare the contribution in `package.json`: add `contributes.mcpServerDefinitionProviders: [{ "id": "speckitAtlas.mcp", "label": "SpecKit Atlas" }]`; do **not** add new `activationEvents` (keep lazy `workspaceContains`).
- [X] T006 [P] [US1] Ship the server binary: remove `dist/mcp.js` and `dist/mcp.js.map` from `.vscodeignore` so they package into the `.vsix` (keep `dist/cli.js` excluded).
- [X] T007 [US1] Register the provider in `src/extension/extension.ts`: build a `vscode.McpStdioServerDefinition[]` from `buildServerDefinitions({ folders: workspace folder fsPaths, extensionPath: context.extensionPath, nodePath: process.execPath, version: <extension version> })`, call `vscode.lm.registerMcpServerDefinitionProvider("speckitAtlas.mcp", { provideMcpServerDefinitions })`, and push the disposable to `context.subscriptions`.
- [X] T008 [US1] Add an `AtlasApi` test hook `getMcpServerDefinitions()` in `src/extension/extension.ts` returning the `McpServerDescriptor[]` for the current workspace (deterministic integration assertions without a live agent).
- [X] T009 [P] [US1] Integration test `test/integration/mcp-provider.test.ts` (`@vscode/test-electron`): activation registers the provider without throwing; `typeof vscode.lm.registerMcpServerDefinitionProvider === "function"` (API present at the floor); `getMcpServerDefinitions()` returns descriptors whose `args[0]` points at an **existing** `dist/mcp.js` under the extension path, include `--root`, and set `ELECTRON_RUN_AS_NODE`.

**Checkpoint**: MVP — installing the extension surfaces the tools with zero configuration.

---

## Phase 4: User Story 2 - Same tools, same answers + per-project scoping (Priority: P2)

**Goal**: In-editor results match the standalone surface, and multi-root workspaces are
scoped per project with no cross-project results.

**Independent Test**: On `fixtures/graph/two-projects`, one server per folder appears, each
scoped to its own project; a query's result equals the standalone CLI/MCP for the same
workspace (SC-002, SC-003, FR-003/FR-004).

- [X] T010 [US2] Wire `onDidChangeMcpServerDefinitions` in `src/extension/extension.ts` to `vscode.workspace.onDidChangeWorkspaceFolders` so adding/removing a folder updates the advertised server set (contract C-8).
- [X] T011 [P] [US2] Extend `test/integration/mcp-provider.test.ts` for multi-root (run under the two-projects fixture / a `mcp-provider-multiroot` suite): assert one descriptor per folder and that each descriptor's `--root` is its own folder (per-project scoping; no cross-project roots).
- [X] T012 [P] [US2] Confirm parity is structural: assert the descriptors launch the same `dist/mcp.js` used by the standalone bin (`package.json` `bin.speckit-atlas-mcp`), and keep `test/mcp/tools.test.ts` green (tool/envelope parity via `runQuery`). No server-logic changes.

**Checkpoint**: US1 + US2 — discovered tools are trustworthy (parity) and correctly scoped.

---

## Phase 5: User Story 3 - npm channel & graceful edges preserved (Priority: P3)

**Goal**: The standalone CLI/MCP still work for out-of-editor/CI use; no-workspace and
no-specs cases degrade cleanly; older editors are handled by the manifest floor.

**Independent Test**: `dist/cli.js`/`dist/mcp.js` run unchanged; an empty folder yields an
empty result; the manifest declares `^1.101.0` so incompatible editors can't install
(SC-005, FR-007/FR-008/FR-012).

- [X] T013 [US3] Verify the npm channel is intact: `.vscodeignore` still excludes `dist/cli.js` (npm-only); `node dist/cli.js graph --root .` and `node dist/mcp.js` still build and run exactly as before (no changes to `src/cli` or `src/mcp`).
- [X] T014 [P] [US3] Assert graceful edges in `test/contracts/mcp-provider.test.ts` / integration: zero folders → `buildServerDefinitions` returns `[]` (no rootless server); and a folder with no specs returns an empty envelope through the existing `runQuery` path (FR-008/SC-005).
- [X] T015 [US3] Add a `CHANGELOG.md` entry: the extension now auto-registers its MCP query server (in-editor agents discover the `atlas_*` tools on install); `engines.vscode` raised to `^1.101.0`; users on older editors keep the npm CLI/MCP.

**Checkpoint**: All three stories independently functional; nothing existing regressed.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T016 [P] Update `README.md` (feature list + a short "in-editor agents" note): installing the extension exposes the query tools to in-editor agents automatically; older editors use the npm channel. (`CLAUDE.md` already updated in planning.)
- [X] T017 Verify gates & budgets: `npm run lint`, strict typecheck, `npm run build`; `npx @vscode/vsce ls` **includes** `dist/mcp.js` and **excludes** `dist/cli.js`; packaged `.vsix` size is within the ≤ 2 MB budget (compare to the T001 baseline).
- [X] T018 Run `specs/007-mcp-provider-contribution/quickstart.md` manual validation (SC-001…SC-006) in the Extension Development Host; confirm read-only (`git status` clean) and offline operation (stdio, no network).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 then T002 (the floor bump precedes any code that uses the new types).
- **Foundational (Phase 2)**: after Setup — **BLOCKS all user stories**. T004 depends on T003.
- **User Stories (Phase 3–5)**: all depend on Foundational. US1 is the MVP; US2 builds on US1's registration; US3 is preservation/edges.
- **Polish (Phase 6)**: after the desired stories are complete.

### User Story Dependencies

- **US1 (P1)**: needs T002–T004. Delivers discovery (the headline capability).
- **US2 (P2)**: needs US1's registration (T007); adds change-signal + scoping/parity assertions. Independently testable.
- **US3 (P3)**: independent preservation checks + docs; can run alongside US2.

### Within Each User Story

- Tasks touching the same file run sequentially: **T007 and T008** both edit `extension.ts` (and T010 also edits it) → sequential; **T009, T011, T014** all touch `test/integration/mcp-provider.test.ts` → sequential unless split into per-suite files.
- `package.json` is edited by T002 (setup) and T005 (US1) → sequential.

### Parallel Opportunities

- Foundational: T003 then T004 (module before its test).
- US1: **T005 (package.json)** and **T006 (.vscodeignore)** are different files → [P]; T009 is its own new test file → [P].
- US2/US3 can proceed in parallel once US1's provider (T007) lands.
- Polish: **T016** [P] alongside T017/T018 prep.

---

## Parallel Example: User Story 1

```bash
# Different files, no shared deps:
Task: "Declare contributes.mcpServerDefinitionProviders in package.json"   # T005
Task: "Remove dist/mcp.js from .vscodeignore"                              # T006
# Then, after the provider is registered (T007/T008):
Task: "Integration test: provider registers; bundled dist/mcp.js present"  # T009
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 Setup (T001–T002) → 2. Phase 2 Foundational (T003–T004) → 3. Phase 3 US1 (T005–T009).
4. **STOP and VALIDATE**: in the Extension Dev Host, confirm the SpecKit Atlas MCP server
   and its tools appear with zero configuration and the agent can call one.
5. This alone delivers the headline capability and is shippable.

### Incremental Delivery

- Foundational → US1 (discovery, MVP) → US2 (parity + multi-root scoping) → US3 (npm
  channel + graceful edges + changelog). Each story adds value without breaking the prior.

---

## Notes

- [P] = different files, no incomplete dependencies.
- No `src/core`, `src/platform`, `src/mcp/main.ts`, or `src/cli` changes — the feature
  advertises the *existing* server, so tool parity is structural.
- No new runtime dependency; the engine-floor raise is the deliberate, spec-resolved cost.
- Verify read-only (no workspace writes) and offline (stdio only) at T018.
