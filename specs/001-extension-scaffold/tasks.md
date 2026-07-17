---
description: "Task list for Extension Scaffold implementation"
---

# Tasks: Extension Scaffold

**Input**: Design documents from `/specs/001-extension-scaffold/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: INCLUDED. The project constitution mandates a passing CI test gate
(core suite on plain Node; integration under `@vscode/test-electron`), and the
contracts define assertable behaviors (C-*, E-*, W-*). Test tasks are therefore
first-class here, not optional.

**Organization**: Tasks are grouped by user story. US1 is the MVP scaffold; US2 and
US3 layer verification/hardening (dormancy, offline/read-only) on top of it.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 / US2 / US3 (Setup, Foundational, Polish carry no story label)
- All paths are repo-relative and match the structure in `plan.md`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project skeleton, build, and tooling per the constitution and plan.

- [X] T001 Create the source/test/fixture directory tree per plan.md: `src/core/detection/`, `src/core/model/`, `src/extension/`, `src/webview/`, `media/`, `test/core/`, `test/integration/`, `fixtures/`, `.vscode/`
- [X] T002 Initialize `package.json` (name `speckit-atlas`, placeholder publisher, `engines.vscode` `^1.90.0`, `main` `./dist/extension.js`, `capabilities.untrustedWorkspaces.supported` `true`, scripts `build`/`typecheck`/`lint`/`format`/`test:core`/`test:integration`/`package`) and add devDependencies (`@types/vscode`, `@types/node`, `typescript`, `esbuild`, `@vscode/vsce`, `@vscode/test-electron`, `eslint`, `prettier`)
- [X] T003 [P] Add `tsconfig.json` in `strict` mode covering `src/core`, `src/extension`, `src/webview`
- [X] T004 [P] Add `esbuild.js` bundling `src/extension` → `dist/extension.js` and `src/webview` → `media/webview.js`, copying `media/` assets
- [X] T005 [P] Add ESLint + Prettier config in repo root, including a boundary rule that forbids `vscode`/DOM imports inside `src/core/**` (enforces Principle I)
- [X] T006 [P] Add `.vscode/launch.json` and `.vscode/tasks.json` for the F5 Extension Development Host
- [X] T007 [P] Add CI workflow in `.github/workflows/ci.yml` running typecheck, lint, format check, `test:core`, and `test:integration` against `engines.vscode` floor and `stable`

**Checkpoint**: Repo builds an empty bundle; tooling and CI gate are in place.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The pure `core/` — model, detection, view-model — that every user story
depends on. Contains zero `vscode`/DOM imports (Principle I).

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T008 [P] Define core model types (`WorkspaceRoot`, `Warning`, `DetectionResult`, `MapViewState`, `MapViewModel`) in `src/core/model/types.ts` per data-model.md
- [X] T009 Implement detection heuristics `detectRoot` / `detectRoots` in `src/core/detection/detect.ts` (signals `has:.specify` and `has:specs/*/spec.md`; empty `entries` → `empty-workspace` warning; never throws — Principle II)
- [X] T010 Implement `buildMapViewModel` in `src/core/model/viewModel.ts` (`welcome` when 0 qualifying roots, `empty` when ≥1, `graph: null`, always fully populated, carries warnings)
- [X] T011 Create the pure core public barrel in `src/core/index.ts` exporting exactly the `contracts/core-api.md` surface
- [X] T012 [P] Core unit tests (`node:test`) asserting core-api contract C-1..C-8 in `test/core/detect.test.ts` and `test/core/viewModel.test.ts` (incl. JSON round-trip C-8)

**Checkpoint**: `npm run test:core` passes on plain Node; core is fully usable headless.

---

## Phase 3: User Story 1 - Install and activate in a Spec Kit workspace (Priority: P1) 🎯 MVP

**Goal**: An installable extension that activates lazily in a Spec Kit workspace and
opens a single `SpecKit Atlas` webview showing a welcome/empty state.

**Independent Test**: Install into a clean editor, open `fixtures/vanilla-speckit/`,
confirm activation and that the Map view opens to its welcome state with no error.

### Tests for User Story 1

- [X] T013 [P] [US1] Add fixture `fixtures/vanilla-speckit/` containing `.specify/memory/constitution.md` and `specs/001-x/spec.md` (a qualifying workspace)
- [X] T020 [P] [US1] Integration test (`@vscode/test-electron`) in `test/integration/activate.test.ts`: opening `vanilla-speckit` activates the extension, registers `speckitAtlas.mapView`, exposes exactly `speckitAtlas.openMap` and `speckitAtlas.refresh`, and the view resolves to the welcome state (E-1, E-2, W-1, W-2)
- [X] T036 [P] [US1] Add `fixtures/malformed-speckit/` (has `.specify/` but a broken `specs/` layout and garbage front-matter) and an integration test `test/integration/malformed.test.ts` asserting activation + refresh degrade to a safe state without throwing (FR-011, spec "malformed workspace" edge case)

### Implementation for User Story 1

- [X] T014 [P] [US1] Add `media/atlas-icon.svg` for the activity-bar view container
- [X] T015 [US1] Add `contributes` (viewsContainers.activitybar `speckitAtlas`; views webview `speckitAtlas.mapView`; commands `speckitAtlas.openMap`, `speckitAtlas.refresh`) and `activationEvents` (`workspaceContains:**/.specify/`, `workspaceContains:**/specs/*/spec.md`, `onView:speckitAtlas.mapView`) to `package.json` per contracts/extension-contributions.md
- [X] T016 [US1] Implement `workspaceProbe` in `src/extension/workspaceProbe.ts` (map workspace folders → probe relative entries → `WorkspaceRoot[]`); this is the ONLY place performing file-system I/O (keeps `core/` pure)
- [X] T017 [US1] Implement `MapViewProvider` (`WebviewViewProvider`) in `src/extension/mapViewProvider.ts`: build HTML with strict CSP + per-load nonce, `localResourceRoots` = `media/`, post `render`, handle `ready`/`refresh` (contracts/webview-protocol.md W-1..W-7)
- [X] T018 [P] [US1] Implement webview renderer in `src/webview/main.ts` (+ `media/webview.css`): post `ready`, render `welcome`/`empty` state and any warnings, post `refresh`; defensive on unknown `schemaVersion`
- [X] T019 [US1] Implement `activate()` / `deactivate()` in `src/extension/extension.ts`: probe → `core.detectRoots` → `core.buildMapViewModel`, register `MapViewProvider` and the two commands, dispose all registrations on deactivate (E-5)

**Checkpoint**: US1 is a fully functional, independently testable MVP — the extension
installs, activates on a Spec Kit workspace, and shows the welcome view.

---

## Phase 4: User Story 2 - Stay dormant and non-intrusive (Priority: P2)

**Goal**: The extension never activates or contributes UI outside Spec Kit
workspaces and coexists cleanly with speckit-companion.

**Independent Test**: Open non-Spec Kit folders (with speckit-companion also
installed); confirm no activation, no visible UI, and no conflicts.

**Depends on**: US1 (reuses the activation/manifest machinery).

### Tests for User Story 2

- [X] T021 [P] [US2] Add fixture `fixtures/plain-project/` (ordinary files; no `.specify/`, no `specs/*/spec.md`)
- [X] T023 [P] [US2] Integration test in `test/integration/dormant.test.ts`: opening `plain-project` does NOT activate the extension and no `speckitAtlas.*` command is available (E-3, SC-003)
- [X] T024 [P] [US2] Integration test in `test/integration/multiroot.test.ts`: a multi-root workspace (`vanilla-speckit` + `plain-project`) activates once, treats only the qualifying root as in scope, and does not fail on the other (edge case)
- [X] T025 [P] [US2] Test in `test/integration/coexistence.test.ts` asserting all contributed ids are namespaced `speckitAtlas.*` and none collide with known speckit-companion ids; no file associations are contributed (E-4, SC-005)

### Implementation for User Story 2

- [X] T022 [US2] Audit and, if needed, adjust `package.json` so no command/view surfaces without activation, all ids remain under `speckitAtlas.*`, and no file associations are declared (FR-009, FR-010)

**Checkpoint**: US1 and US2 both hold — the extension is live where relevant and
invisible everywhere else.

---

## Phase 5: User Story 3 - Trustworthy by construction: offline & read-only (Priority: P3)

**Goal**: From install through view rendering, zero network calls and zero workspace
file writes; strict CSP; no telemetry.

**Independent Test**: With networking disabled and the workspace under a file watcher,
install → open `vanilla-speckit` → open the Map view; observe zero network activity
and zero file changes.

**Depends on**: US1 (verifies/hardens its webview and activation path).

### Tests for User Story 3

- [X] T027 [P] [US3] Test in `test/integration/csp.test.ts`: the served webview HTML contains a CSP with `default-src 'none'`, a nonce, no `http:`/`https:` origin, and no inline `on*=` handler; zero external URLs (W-6, W-7)
- [X] T028 [P] [US3] Integration test in `test/integration/offline-readonly.test.ts`: opening `vanilla-speckit` and resolving the view makes zero network requests and creates/modifies/moves/deletes zero workspace files (SC-004, FR-006, FR-007)
- [X] T029 [P] [US3] Test in `test/integration/no-telemetry.test.ts` asserting no telemetry module/reporter or outbound sink exists in the bundle (FR-008)

### Implementation for User Story 3

- [X] T026 [US3] Confirm `capabilities.untrustedWorkspaces.supported` `true` in `package.json` and remove/guard against any write or network API reference across `src/extension/**` (FR-006, FR-007)

**Checkpoint**: All three stories hold; the read-only/offline/telemetry-free posture
is observable and asserted.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Packaging, docs, and final validation.

- [X] T030 [P] Add `README.md` with build/run/package instructions and a constitution summary
- [X] T031 [P] Add initial `CHANGELOG.md` entry (semver) per the constitution's versioning rule
- [X] T032 [P] Add `LICENSE` and `.vscodeignore` so the packaged `.vsix` stays minimal
- [X] T033 Run `quickstart.md` manual validation steps 2–6, confirm the extension does not activate with no qualifying workspace open (SC-001), and confirm `npm run package` produces a `.vsix` (SC-006)
- [X] T034 [P] Assert the core suite runs on plain Node within the sub-second budget and record the bundle size against a stated budget (constitution bundle-size guidance)
- [X] T035 [US1] Document that SC-001's < 50 ms startup budget is met **structurally**: activation is lazy via `workspaceContains` with no `*`/`onStartupFinished` event, so no extension code loads until a Spec Kit signal matches. The non-activation half is asserted by T023 (dormant); the added-cost half is guaranteed by the absence of any eager activation event rather than a runtime timer.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories.
- **US1 (Phase 3)**: Depends on Foundational. The MVP.
- **US2 (Phase 4)**: Depends on US1 (reuses activation/manifest machinery).
- **US3 (Phase 5)**: Depends on US1 (verifies/hardens its webview + activation).
- **Polish (Phase 6)**: Depends on all desired stories being complete.

### User Story Dependencies

- **US1 (P1)**: Foundational only — independently testable MVP.
- **US2 (P2)**: Builds on US1; independently testable via non-qualifying/multi-root fixtures.
- **US3 (P3)**: Builds on US1; independently testable via offline/read-only observation.

### Within Each Story

- Tests and fixtures can be authored in parallel with implementation, but must FAIL
  before the implementation lands and PASS after.
- Core (Phase 2) before any extension wiring.
- `workspaceProbe` and `MapViewProvider` before `activate()` wires them together (T019).

---

## Parallel Opportunities

- **Setup**: T003, T004, T005, T006, T007 run in parallel after T002.
- **Foundational**: T008 and T012 (test authoring) parallel; T009/T010/T011 sequential (same conceptual module, T011 depends on T009+T010).
- **US1**: T013, T014, T018, T020 are [P]; T015→T016→T017→T019 form the wiring chain.
- **US2**: T021, T023, T024, T025 all [P]; T022 is a small manifest audit.
- **US3**: T027, T028, T029 all [P]; T026 is a small manifest/guard task.
- **Polish**: T030, T031, T032, T034 are [P]; T033 runs last.

### Parallel Example: User Story 1

```bash
# After Foundational completes, launch US1 parallelizable tasks together:
Task: "T013 Add fixtures/vanilla-speckit/"
Task: "T014 Add media/atlas-icon.svg"
Task: "T018 Implement webview renderer in src/webview/main.ts"
Task: "T020 Integration test for activation + welcome state"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1: Setup → 2. Phase 2: Foundational (core) → 3. Phase 3: US1.
4. **STOP and VALIDATE**: install, open a Spec Kit workspace, confirm the welcome view.
5. This is a demoable scaffold on its own.

### Incremental Delivery

1. Setup + Foundational → core ready.
2. US1 → MVP (activates + welcome view) → demo.
3. US2 → proven dormant + coexistent → demo.
4. US3 → proven offline + read-only → demo.

---

## Notes

- [P] = different files, no dependency on an incomplete task.
- [Story] label maps each task to its user story for traceability.
- Every parsing/detection heuristic change must update a fixture and its assertion
  (constitution: fixture-driven parsing).
- Commit after each task or logical group; keep `core/` free of `vscode`/DOM imports.
