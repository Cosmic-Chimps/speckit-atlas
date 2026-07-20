import assert from "node:assert/strict";
import { getSelf, runAll, test } from "./harness.js";
import type { WorkspaceGraph } from "../../src/core/index.js";

/**
 * Feature 012 — before/after diff. The integration harness launches with `--disable-extensions`,
 * which also disables the built-in Git extension, so these tests exercise the **read-only,
 * no-throw degradation contract** (FR-002/004/010/011; SC-003/005/006): with git unavailable, the
 * diff handlers must resolve cleanly, open nothing, and never crash the host — and the map + graph
 * keep working. Deterministic diff-content behavior (branch/range/multi-diff) is validated manually
 * against a git-backed workspace (quickstart §3), which the harness cannot provide.
 */
interface AtlasApiLike {
  refresh(): Promise<unknown>;
  getGraph(): WorkspaceGraph;
  openFileDiff(nodeId: string, path: string, projectId: string): Promise<void>;
  showChangeset(nodeId: string, projectId: string): Promise<void>;
}

async function api(): Promise<AtlasApiLike> {
  const ext = getSelf();
  assert.ok(ext, "extension present");
  return (await ext.activate()) as AtlasApiLike;
}

export async function run(): Promise<void> {
  test("012: openFileDiff degrades safely when git is unavailable (no throw, no crash)", async () => {
    const a = await api();
    await a.refresh();
    const proj = a.getGraph().projects[0];
    await assert.doesNotReject(() =>
      a.openFileDiff("001-alpha", "src/core/graph/heuristics.ts", proj.projectId),
    );
    // Bogus path/spec must also be safe.
    await assert.doesNotReject(() =>
      a.openFileDiff("999-nope", "does/not/exist.ts", proj.projectId),
    );
    // Extension still functional afterwards.
    assert.ok(a.getGraph().projects.length >= 1, "graph still available after diff attempt");
  });

  test("012: showChangeset degrades safely when git is unavailable (no throw, no crash)", async () => {
    const a = await api();
    await a.refresh();
    const proj = a.getGraph().projects[0];
    await assert.doesNotReject(() => a.showChangeset("001-alpha", proj.projectId));
    await assert.doesNotReject(() => a.showChangeset("999-nope", proj.projectId));
    // A subsequent refresh still succeeds (host not wedged).
    await assert.doesNotReject(() => a.refresh());
  });

  await runAll("git-changes");
}
