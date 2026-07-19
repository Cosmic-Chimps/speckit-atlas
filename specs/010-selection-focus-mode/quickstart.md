# Quickstart & Validation: Selection & Focus Mode

Validates the two user stories from [spec.md](./spec.md) against the contracts in
[contracts/protocol.md](./contracts/protocol.md). No new dependencies; build and test the
same way as the rest of the repo.

## Prerequisites

- Repo dependencies installed (`npm install`).
- Node available for the pure suite; VS Code test runner for integration
  (`@vscode/test-electron`), as used by the existing `test/integration/*` suites.

## Build & test commands

```bash
# Type-check + bundle (esbuild), same as CI
npm run build

# Pure unit suite (plain Node) — includes the new focus-set tests
npm test            # or the project's node:test task

# Integration suite (VS Code electron) — includes selection-focus panel tests
npm run test:integration
```

Expected: the new `test/contracts/focus-set.test.ts` and
`test/integration/selection-focus.test.ts` pass alongside the existing suites; no existing
suite regresses (notably `render`, `layout-*`, `controls-help`).

## Manual validation in the Extension Development Host

1. Launch the extension (F5) on a Spec Kit workspace with several related specs; run
   **SpecKit Atlas: Open Map**.

### US1 — single active selection (P1)

2. In the controls sidebar **SPECS** list, click three different specs in turn.
   - **Expected**: exactly one node carries the blue selection border at any moment; the
     previous highlight clears each time (SC-001). No trail of blue-bordered nodes.
3. Click a node directly on the map, then a different node.
   - **Expected**: selection follows the last click; sidebar and map selections are
     consistent (only one highlighted).
4. Click empty map space.
   - **Expected**: selection clears; no node highlighted.

### US2 — focus mode (P2)

5. Select a spec that has neighbors, then enable **Focus on selection** in the sidebar.
   - **Expected**: only the selected spec, its directly connected specs, and the edges
     among that set are shown; everything else is hidden (SC-002/SC-003, FR-005).
6. With focus on, click a different spec.
   - **Expected**: the focused view re-scopes to the new spec's neighborhood (US2-2).
7. Disable **Focus on selection**.
   - **Expected**: the full graph returns with the same layout positions as before (SC-003
     — layout undisturbed, `006-persist-map-layout` preserved).
8. Re-enable focus, then also change the tier/status filters.
   - **Expected**: both apply together — the neighborhood is shown, and within it the
     dimming filter is still reflected; neither control resets the other (SC-004, FR-008).
9. With focus on and a spec selected, edit that spec's folder away (or trigger a re-parse
   that removes it).
   - **Expected**: selection clears and the full graph is shown (US2 edge case); no stale
     highlight, no crash (Principle II).

## What "done" looks like

- SC-001..SC-005 from the spec are demonstrable via the steps above.
- New pure + integration tests green; existing suites unchanged.
- No `core/` file modified; no workspace file written; no network call (Principles I,
  III, VI verified by the existing `no-telemetry` / `offline-readonly` contract suites
  still passing).
