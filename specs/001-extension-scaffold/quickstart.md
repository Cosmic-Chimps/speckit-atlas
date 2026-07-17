# Quickstart & Validation: Extension Scaffold

Runnable steps that prove the scaffold works end-to-end and honors the constitution.
Implementation details (file bodies, full test suites) live in `tasks.md` and the
implementation phase — this is a run/validate guide.

## Prerequisites

- Node.js (LTS) and npm
- VS Code `^1.90.0` (the declared floor) or newer
- Repository cloned; run all commands from the repo root

## Setup

```bash
npm install
```

## Build

```bash
npm run build        # esbuild → dist/extension.js (+ media assets copied)
npm run typecheck    # tsc --noEmit, strict
npm run lint         # lint + format check
```

Expected: all three succeed with no errors (gates the CI merge check).

## Run the core tests (plain Node, no editor)

```bash
npm run test:core    # node:test over src/core
```

Validates the `core-api.md` contract (C-1 … C-8): detection verdicts, graceful
degradation on empty/partial input, and JSON-serializability of every output.
Expected: fast (< ~1 s), all green.

## Run the editor-integration tests

```bash
npm run test:integration   # @vscode/test-electron, downloads the pinned VS Code
```

Validates `extension-contributions.md` (E-1 … E-5) and `webview-protocol.md`
(W-1 … W-7) against fixture workspaces in `fixtures/`.

## Manual validation (maps to Success Criteria)

1. **Launch the Extension Development Host**: press `F5` (uses `.vscode/launch.json`).
2. **SC-003 — dormant when irrelevant**: in the dev host, open a plain folder with no
   `.specify/` and no `specs/`. Confirm no **SpecKit Atlas** activity-bar icon
   appears and no `SpecKit Atlas:` commands are in the Command Palette.
3. **SC-002 — activates on a Spec Kit workspace**: open a folder containing a
   `.specify/` directory (e.g. `fixtures/vanilla-speckit/`). Confirm the activity-bar
   icon appears, open the **Map** view, and see the welcome/empty state (no error, no
   blank panel).
4. **SC-005 — coexistence**: with speckit-companion also installed, repeat step 3 and
   confirm no duplicated/conflicting views or commands.
5. **SC-004 — offline & read-only**:
   - Disable networking (or watch with a proxy/monitor); repeat step 3 and confirm
     **zero** network requests.
   - Run `git status` (or watch the folder) before and after opening the Map view;
     confirm **no** workspace file is created, modified, moved, or deleted.
6. **SC-001 — startup cost**: with no qualifying workspace open, confirm the extension
   does not activate (Running Extensions view shows it inactive / not activated).

## Package (optional, validates SC-006)

```bash
npm run package      # @vscode/vsce package → *.vsix
```

Expected: a single `.vsix` is produced; a new contributor can reach this point from a
clean clone in under 15 minutes following these steps.

## Definition of done for this feature

- Core and integration suites green; typecheck/lint/format clean.
- Manual validation steps 2–6 pass.
- `.vsix` builds. No network calls, no workspace writes, no telemetry anywhere in the
  flow.
