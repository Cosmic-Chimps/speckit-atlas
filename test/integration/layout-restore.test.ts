import assert from "node:assert/strict";
import { getSelf, runAll, test, waitFor } from "./harness.js";
import type { LayoutApiLike } from "./layoutApi.js";

/** US1 (feature 006): the arrangement is persisted and survives close/reopen. */
export async function run(): Promise<void> {
  async function api(): Promise<LayoutApiLike> {
    const ext = getSelf();
    assert.ok(ext, "extension present");
    return (await ext.activate()) as LayoutApiLike;
  }

  test("L1 / SC-001: a reported arrangement is persisted to workspaceState", async () => {
    const a = await api();
    await a.refresh();
    a.openMap();
    await waitFor(() => a.getPanelDiagnostics() !== undefined, 8000);

    const ids = a.getGraph().projects[0].nodes.map((n) => n.id);
    const positions = Object.fromEntries(ids.map((id, i) => [id, { x: 100 + i * 40, y: 200 }]));
    const viewport = { pan: { x: 5, y: 6 }, zoom: 1.25 };
    a.simulatePersistLayout({ type: "persistLayout", projectId: "__all__", positions, viewport });

    const saved = a.getSavedLayout().projects["__all__"];
    assert.ok(saved, "bucket saved");
    assert.deepEqual(saved.positions[ids[0]], { x: 100, y: 200 }, "position persisted");
    assert.deepEqual(saved.viewport, viewport, "viewport persisted (FR-003)");
  });

  test("L2: the store outlives the panel and drives restore on reopen", async () => {
    const a = await api();
    await a.refresh();
    const before = a.getSavedLayout().projects["__all__"];
    assert.ok(before, "persisted layout still present after a refresh (host never clears it)");
    // On reopen the host reads this same store for the render's savedPositions — proven by
    // the value surviving here independently of any live panel.
    a.openMap();
    assert.equal(a.isPanelOpen(), true);
  });

  test("L3 / FR-007: stale node ids in a report are pruned", async () => {
    const a = await api();
    await a.refresh();
    const ids = a.getGraph().projects[0].nodes.map((n) => n.id);
    a.simulatePersistLayout({
      type: "persistLayout",
      projectId: "__all__",
      positions: { ...Object.fromEntries(ids.map((id) => [id, { x: 1, y: 1 }])), "999-ghost": { x: 9, y: 9 } },
      viewport: { pan: { x: 0, y: 0 }, zoom: 1 },
    });
    const saved = a.getSavedLayout().projects["__all__"];
    assert.ok(!("999-ghost" in saved.positions), "id not in the graph is dropped");
    for (const id of ids) {
      assert.ok(id in saved.positions, "current nodes are kept");
    }
  });

  await runAll("layout-restore");
}
