import assert from "node:assert/strict";
import { getSelf, runAll, test } from "./harness.js";
import type { LayoutApiLike } from "./layoutApi.js";

/** US3 (feature 006): per-project isolation, new/removed nodes, and Reset layout. */
export async function run(): Promise<void> {
  async function api(): Promise<LayoutApiLike> {
    const ext = getSelf();
    assert.ok(ext, "extension present");
    return (await ext.activate()) as LayoutApiLike;
  }

  test("L6 / FR-008: buckets are independent per view", async () => {
    const a = await api();
    await a.refresh();
    const proj = a.getGraph().projects[0];
    const ids = proj.nodes.map((n) => n.id);
    // A per-project bucket (real projectId) and the all-projects bucket must not clobber.
    a.simulatePersistLayout({
      type: "persistLayout",
      projectId: proj.projectId,
      positions: Object.fromEntries(ids.map((id) => [id, { x: 1, y: 1 }])),
      viewport: { pan: { x: 0, y: 0 }, zoom: 1 },
    });
    a.simulatePersistLayout({
      type: "persistLayout",
      projectId: "__all__",
      positions: Object.fromEntries(ids.map((id) => [id, { x: 9, y: 9 }])),
      viewport: { pan: { x: 0, y: 0 }, zoom: 1 },
    });
    const store = a.getSavedLayout();
    assert.deepEqual(store.projects[proj.projectId].positions[ids[0]], { x: 1, y: 1 });
    assert.deepEqual(store.projects["__all__"].positions[ids[0]], { x: 9, y: 9 });
  });

  test("L7 / FR-006: adding a node keeps existing saved positions", async () => {
    const a = await api();
    await a.refresh();
    const ids = a.getGraph().projects[0].nodes.map((n) => n.id);
    // First arrangement (existing nodes only).
    a.simulatePersistLayout({
      type: "persistLayout",
      projectId: "__all__",
      positions: Object.fromEntries(ids.map((id) => [id, { x: 10, y: 10 }])),
      viewport: { pan: { x: 0, y: 0 }, zoom: 1 },
    });
    // A later report includes a genuinely new node id alongside the (unchanged) existing ones.
    // (nodeIdsForBucket only keeps ids that are actually in the graph, so a fabricated new id
    // is pruned — existing positions must be exactly preserved.)
    a.simulatePersistLayout({
      type: "persistLayout",
      projectId: "__all__",
      positions: {
        ...Object.fromEntries(ids.map((id) => [id, { x: 10, y: 10 }])),
        "new-when-open": { x: 500, y: 500 },
      },
      viewport: { pan: { x: 0, y: 0 }, zoom: 1 },
    });
    const positions = a.getSavedLayout().projects["__all__"].positions;
    for (const id of ids) {
      assert.deepEqual(positions[id], { x: 10, y: 10 }, "existing node unmoved");
    }
  });

  test("L8 / FR-010: Reset layout clears the active bucket", async () => {
    const a = await api();
    await a.refresh();
    const ids = a.getGraph().projects[0].nodes.map((n) => n.id);
    a.simulatePersistLayout({
      type: "persistLayout",
      projectId: "__all__",
      positions: Object.fromEntries(ids.map((id) => [id, { x: 3, y: 3 }])),
      viewport: { pan: { x: 0, y: 0 }, zoom: 1 },
    });
    assert.ok(a.getSavedLayout().projects["__all__"], "layout present before reset");
    a.resetLayout(); // active project is null ⇒ clears the "__all__" bucket
    assert.ok(!a.getSavedLayout().projects["__all__"], "bucket cleared after reset");
  });

  await runAll("layout-evolve");
}
