import assert from "node:assert/strict";
import { getSelf, runAll, test, waitFor } from "./harness.js";
import type { WorkspaceGraph } from "../../src/core/index.js";
import type { ControlsToHost } from "../../src/webview/protocol.js";

interface AtlasApiLike {
  refresh(): Promise<unknown>;
  openMap(): void;
  getPanelDiagnostics(): { nodeCount: number; edgeCount: number; ok: boolean } | undefined;
  getGraph(): WorkspaceGraph;
  applyControlMessage(msg: ControlsToHost): void;
}

async function api(): Promise<AtlasApiLike> {
  const ext = getSelf();
  assert.ok(ext, "extension present");
  return (await ext.activate()) as AtlasApiLike;
}

/** Opened on fixtures/graph/two-projects/atlas.code-workspace (proj-a + proj-b). */
export async function run(): Promise<void> {
  test("R-16 / SC-007: one sub-graph per project; no cross-project edges", async () => {
    const a = await api();
    await a.refresh();
    const g = a.getGraph();
    assert.equal(g.projects.length, 2, "two independent sub-graphs");
    for (const p of g.projects) {
      const ids = new Set(p.nodes.map((n) => n.id));
      for (const e of p.edges) {
        assert.ok(ids.has(e.source) && ids.has(e.target), "edge stays within its project");
      }
    }
    // Both projects reuse the id "001-x" but must not be linked to each other.
    const totalNodes = g.projects.reduce((s, p) => s + p.nodes.length, 0);
    assert.equal(totalNodes, 2);
  });

  test("project selector scopes the map to one sub-graph", async () => {
    const a = await api();
    await a.refresh();
    a.openMap();
    const pid = a.getGraph().projects[0].projectId;
    a.applyControlMessage({ type: "selectProject", projectId: pid });
    await waitFor(() => a.getPanelDiagnostics()?.nodeCount === 1, 8000);
    assert.equal(a.getPanelDiagnostics()?.nodeCount, 1, "only the selected project's nodes");
  });

  await runAll("render-multiroot");
}
