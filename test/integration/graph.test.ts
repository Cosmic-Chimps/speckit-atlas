import assert from "node:assert/strict";
import { getSelf, runAll, test } from "./harness.js";
import type { MapViewModel } from "../../src/core/index.js";

/** Local shape of the API returned by activate() (avoids loading a 2nd extension copy). */
interface AtlasApiLike {
  refresh(): Promise<MapViewModel>;
  getLastModel(): MapViewModel | undefined;
}

/**
 * US1 wiring: opening a Spec Kit workspace populates `MapViewModel.graph` (no longer
 * null) with the expected per-project nodes and definitive edges. Opened on
 * fixtures/graph/cross-links.
 */
export async function run(): Promise<void> {
  test("MapViewModel.graph is populated with nodes and a definitive edge", async () => {
    const ext = getSelf();
    assert.ok(ext, "extension present");
    const api = (await ext.activate()) as AtlasApiLike;
    const model = await api.refresh();

    assert.ok(model.graph, "graph is not null");
    assert.equal(model.graph.projects.length, 1, "one project sub-graph");
    const proj = model.graph.projects[0];
    assert.deepEqual(
      proj.nodes.map((n) => n.id).sort(),
      ["001-alpha", "002-beta"],
      "one node per feature",
    );
    const edge = proj.edges.find((e) => e.source === "001-alpha" && e.target === "002-beta");
    assert.ok(edge, "definitive edge 001-alpha -> 002-beta");
    assert.equal(edge.tier, "definitive");
  });

  test("node attributes are populated (title, status, task completion)", async () => {
    const ext = getSelf();
    assert.ok(ext);
    const api = (await ext.activate()) as AtlasApiLike;
    const model = await api.refresh();
    const proj = model.graph?.projects[0];
    const alpha = proj?.nodes.find((n) => n.id === "001-alpha");
    assert.equal(alpha?.title, "Alpha");
    assert.deepEqual(alpha?.taskCompletion, { done: 1, total: 2 });
    const beta = proj?.nodes.find((n) => n.id === "002-beta");
    assert.equal(beta?.status, "Implemented (authored retroactively)");
  });

  await runAll("graph");
}
