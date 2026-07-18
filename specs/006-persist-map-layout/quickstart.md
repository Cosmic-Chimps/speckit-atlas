# Quickstart / Validation: Persist Map Layout

Feature 006. Proves the arrangement survives close/reopen. Run from repo root.

## Prerequisites

- `npm install` done; build/watch working (`npm run build` or the esbuild watch task).
- A workspace with Spec Kit specs (e.g. the bundled `fixtures/graph/` corpus) so the map
  has nodes.

## Build & test

```bash
npm run build            # esbuild bundle (no new deps; budgets unchanged)
npm test                 # pure node:test — layout merge/prune + resetEnabled helpers
npm run test:integration # @vscode/test-electron — persist/restore/reset/restart
```

Expected: pure helper tests and the new integration suite pass; the existing
`test/contracts/no-telemetry.test.ts` and CSP contract tests remain green.

## Manual validation (matches spec Success Criteria)

1. **Restore on reopen (SC-001, US1)**
   - Run the extension (F5). Open the map (`SpecKit Atlas: Open Map`). Let it settle.
   - Note where 2–3 labelled nodes sit. Close the **SpecKit Atlas Map** tab.
   - Reopen the map. → Those nodes are in the **same** positions; no re-scramble.

2. **Manual placement kept (SC-005, US2)**
   - Drag two nodes to deliberate spots. Close and reopen the map.
   - → Both nodes are where you dragged them.

3. **New spec doesn't scramble (SC-003, US3)**
   - With a saved arrangement, add a new `specs/NNN-…/spec.md` to the workspace.
   - When the map updates / on reopen → existing nodes unmoved; the new node appears
     placed sensibly; a removed spec's node is gone.

4. **Per-project isolation (US3 #3)**
   - In a multi-root/multi-project workspace, arrange project A, switch to project B and
     arrange it, switch back to A → A's arrangement is intact.

5. **Survives editor restart (SC-004, FR-005)**
   - Arrange the map, fully close and reopen VS Code on the same workspace, open the map.
   - → Arrangement restored from `workspaceState`.

6. **Reset layout (FR-010)**
   - Click **Reset layout** in the controls sidebar. → The map re-runs the automatic
     layout; the new arrangement then persists on subsequent reopen.

7. **Resilience (SC-006, FR-009)**
   - Corrupt the stored value (dev: set `speckitAtlas.mapLayout` to a bad value via a
     scratch command, or clear it) → the map still renders via a fresh `cose`, no error.

8. **Read-only / offline (FR-011, FR-012)**
   - After all of the above, `git status` shows **no** new or modified workspace files
     from the extension. Confirm no network activity (offline run works).

## Reference

- Contract: [`contracts/layout-persistence.md`](./contracts/layout-persistence.md)
- Data model: [`data-model.md`](./data-model.md)
- Decisions: [`research.md`](./research.md)
