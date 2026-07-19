---
description: "Task list for feature 008 — MCP Setup for Any Agent Client"
---

# Tasks: MCP Setup for Any Agent Client

**Input**: Design documents from `/specs/008-mcp-client-setup/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/mcp-setup.md

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

Single VS Code extension project. New code lands in `src/extension/` (a pure formatter +
a thin command). `src/core/`, `src/platform/`, `src/mcp/`, and `src/cli/` are **not**
modified. The feature **writes no files** (Read-Only) — output goes to clipboard + an
untitled document.

---

## Phase 1: Setup

**Purpose**: Confirm a clean baseline before adding the command.

- [X] T001 Confirm baseline green: run `npm run build` and `npm test`. No code changes.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The pure formatter core every user story builds on. No `vscode`/`fs`/process
imports — keeps it unit-testable and the shell thin.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 Create the pure module `src/extension/mcpSetup.ts`: export `ClientId` (`"claude-code" | "cursor" | "claude-desktop" | "generic"`), `ClientTarget`, `ServerLaunchSpec`, the `CLIENTS` catalog (all four, with `label`/`format`/`hint`), `bundledLaunchSpec(extensionPath, nodePath, root)` (reusing `serverEntryPath` from `./mcpProvider.js` → `command=nodePath`, `args=[<dist/mcp.js>, "--root", root]`, `env={ELECTRON_RUN_AS_NODE:"1"}`, `kind:"bundled"`), `npmLaunchSpec(root)` (`command:"speckit-atlas-mcp"`, `args:["--root", root]`, `env:{}`, `kind:"npm"`), a `shellQuote(arg)` helper, and `formatRegistration({ client, launch, projectRoot, serverName })` implementing the **`claude-code` (shell)** form. No `vscode`/`fs`/process imports.
- [X] T003 Unit-test the shell form in `test/contracts/mcp-setup.test.ts` (`node:test`): `claude-code` → a `claude mcp add <serverName> -- …` string; `shellQuote` handles spaces and embedded quotes (runs verbatim, C-5); `--root <root>` present (C-6); bundled `args[0]` ends with `dist/mcp.js` (C-7).

**Checkpoint**: The formatter core + client catalog + quoting exist and are unit-tested.

---

## Phase 3: User Story 1 - Set up my agent from the extension (Priority: P1) 🎯 MVP

**Goal**: A command produces a correct, copy-ready registration for the current workspace
and hands it off (clipboard + shown) — writing nothing.

**Independent Test**: Run **SpecKit Atlas: Set up MCP for your agent** in a Spec Kit
workspace, pick a client, and confirm a correct registration is copied/shown with no path
hunting and no file written (SC-001, FR-009/FR-011).

- [X] T004 [P] [US1] Declare the command in `package.json`: `contributes.commands` entry `{ "command": "speckitAtlas.setupMcpClient", "title": "SpecKit Atlas: Set up MCP for your agent" }`.
- [X] T005 [US1] Register the command in `src/extension/extension.ts`: resolve workspace folders (QuickPick when multi-root — FR-008; an explanatory message when none — FR-007), QuickPick a client from `CLIENTS`, build the bundled `ServerLaunchSpec` (`context.extensionPath`, `process.execPath`, chosen folder), call `formatRegistration`, then `vscode.env.clipboard.writeText(snippet)` and surface it (info message + an **untitled** document with the snippet and apply-hint). Push the disposable to `context.subscriptions`. Writes no files (C-8).
- [X] T006 [US1] Add an `AtlasApi` test hook `generateMcpRegistration(client, folderPath?)` in `src/extension/extension.ts` returning the exact snippet the command would produce (deterministic, no QuickPick UI).
- [X] T007 [US1] Integration test `test/integration/mcp-setup.test.ts` (`@vscode/test-electron`): `vscode.commands.getCommands(true)` includes `speckitAtlas.setupMcpClient`; `generateMcpRegistration("claude-code")` returns a `claude mcp add` string containing `--root <folder>` and the bundled `dist/mcp.js`; assert **no** workspace file was created/modified (read-only).

**Checkpoint**: MVP — a user can generate and copy a working registration in seconds.

---

## Phase 4: User Story 2 - The right form for each client (Priority: P2)

**Goal**: Each supported client gets its own registration format, applied without editing.

**Independent Test**: For Cursor, Claude Desktop, and Other, the produced form matches that
client's documented config and applies without hand-editing (SC-002, FR-002).

- [X] T008 [US2] Extend `formatRegistration` in `src/extension/mcpSetup.ts` with the JSON/generic forms: **Cursor** → a `.cursor/mcp.json` block `{ "mcpServers": { "<serverName>": { "command", "args" } } }` (C-2); **Claude Desktop** → the same `mcpServers` block for `claude_desktop_config.json` (C-3); **generic** → the raw stdio `command`+`args` plus an equivalent JSON stdio block (C-4). Render JSON via `JSON.stringify`; include each client's `applyHint`.
- [X] T009 [US2] Extend `test/contracts/mcp-setup.test.ts`: `cursor`/`claude-desktop` outputs `JSON.parse` cleanly and expose `mcpServers[serverName].command/args` with `--root`; `generic` includes the stdio command+args; an unknown client id falls back to the generic form.

**Checkpoint**: US1 + US2 — every supported client gets a paste-ready, correct form.

---

## Phase 5: User Story 3 - Works with or without the npm package (Priority: P3)

**Goal**: The registration targets a present, launchable server regardless of whether the
npm package is installed.

**Independent Test**: With and without `speckit-atlas-mcp` installed, the generated config
references an existing, launchable server binary (SC-003, FR-003).

- [X] T010 [US3] In `src/extension/mcpSetup.ts`, make the output surface **both** targets: the **bundled** launch spec as the primary (guaranteed present — absolute `dist/mcp.js`) and the **npm** form (`speckit-atlas-mcp --root <folder>`) as a clearly-labeled alternative, so users who installed the package can use it. No runtime PATH probing (research D4).
- [X] T011 [US3] Unit-test in `test/contracts/mcp-setup.test.ts`: `bundledLaunchSpec` → `args[0]` under `extensionPath`, `env.ELECTRON_RUN_AS_NODE === "1"`; `npmLaunchSpec` → `command === "speckit-atlas-mcp"`, `args === ["--root", folder]`; the command output includes both the bundled and npm forms.

**Checkpoint**: All three stories independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T012 [P] Update `README.md` and `CHANGELOG.md`: new **Set up MCP for your agent** command generates a paste-ready registration for Claude Code / Cursor / Claude Desktop / generic; read-only (generates only, writes nothing); complements 007 (which covers VS Code's built-in agent).
- [ ] T013 (Optional) Add a **Connect an agent** affordance to the controls sidebar (`src/webview/controls/main.ts` + a `ControlsToHost` message handled in `extension.ts`) that invokes `speckitAtlas.setupMcpClient` — raises discoverability (research D7). Skip if it expands scope.
- [X] T014 Verify gates: `npm run lint`, strict typecheck, `npm run build`, `npm run check:size`; run `test:contracts` + `test:integration`; confirm **no** workspace-file writes from the command (read-only) and offline operation.
- [X] T015 Run `specs/008-mcp-client-setup/quickstart.md` manual validation (SC-001…SC-006) in the Extension Development Host; then repackage + reinstall the `.vsix` so the new command appears in the installed extension.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001.
- **Foundational (Phase 2)**: after Setup — **BLOCKS all user stories**. T003 depends on T002.
- **User Stories (Phase 3–5)**: all depend on Foundational. US1 is the MVP; US2 extends the formatter; US3 adds the npm alternative. US2 and US3 both edit `mcpSetup.ts` → run sequentially with each other.
- **Polish (Phase 6)**: after the desired stories.

### User Story Dependencies

- **US1 (P1)**: needs T002–T003 (formatter + shell form). Delivers the command end-to-end.
- **US2 (P2)**: extends `formatRegistration` (needs T002). Independently testable.
- **US3 (P3)**: extends `mcpSetup.ts` (needs T002). Independently testable.

### Within Each User Story

- Same-file tasks run sequentially: `mcpSetup.ts` is edited by **T002, T008, T010**;
  `extension.ts` by **T005, T006**; the pure test file by **T003, T009, T011**. Do these in
  order within their phases.

### Parallel Opportunities

- US1: **T004** (`package.json`) is independent of the `extension.ts` work → [P].
- Polish: **T012** (docs) → [P].
- With a second developer, US2 and US3 can be split, but both touch `mcpSetup.ts`, so
  coordinate edits (or land US2 then US3).

---

## Parallel Example: User Story 1

```bash
# Independent of the code wiring:
Task: "Declare speckitAtlas.setupMcpClient in package.json"   # T004
# Then the command handler + hook + test (extension.ts is shared → sequential):
#   T005 → T006 → T007
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 Setup (T001) → 2. Phase 2 Foundational (T002–T003) → 3. Phase 3 US1 (T004–T007).
4. **STOP and VALIDATE**: run the command, pick Claude Code, confirm the `claude mcp add`
   line is copied/shown and nothing is written.
5. Shippable — a user can connect their agent in seconds.

### Incremental Delivery

- Foundational → US1 (command + Claude Code, MVP) → US2 (Cursor / Claude Desktop / generic
  forms) → US3 (npm alternative). Each adds value without breaking the prior.

---

## Notes

- [P] = different files, no incomplete dependencies.
- The extension **writes nothing** — clipboard + untitled document only (Read-Only, C-8).
- No `src/core`/`platform`/`mcp`/`cli` changes; no new dependency; no engine bump.
- Reuses 007's `serverEntryPath` for the bundled launch target.
