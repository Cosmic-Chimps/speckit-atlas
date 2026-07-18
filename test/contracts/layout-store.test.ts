import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ALL_PROJECTS_BUCKET,
  LAYOUT_SCHEMA_VERSION,
  clearProject,
  emptyLayout,
  mergeReport,
  parseStored,
  positionsForProject,
  resetEnabled,
  viewportForProject,
} from "../../src/extension/layoutModel.js";

const VP = { pan: { x: 10, y: 20 }, zoom: 1.5 };

test("parseStored: resilient to corrupt / absent / version-mismatched input (FR-009)", () => {
  for (const bad of [undefined, null, 42, "x", {}, { version: 99, projects: {} }, { version: 1 }]) {
    const s = parseStored(bad);
    assert.equal(s.version, LAYOUT_SCHEMA_VERSION);
    assert.deepEqual(s.projects, {});
  }
});

test("parseStored: drops non-finite positions and invalid viewports", () => {
  const s = parseStored({
    version: 1,
    projects: {
      P: {
        positions: { a: { x: 1, y: 2 }, b: { x: NaN, y: 0 }, c: { x: 3 } },
        viewport: { pan: { x: 0, y: 0 }, zoom: 0 }, // zoom must be > 0
      },
    },
  });
  assert.deepEqual(Object.keys(s.projects.P.positions), ["a"]);
  assert.equal(s.projects.P.viewport, null);
});

test("mergeReport: prunes stale ids and keeps only current nodes (FR-007)", () => {
  const merged = mergeReport(
    emptyLayout(),
    "P",
    { a: { x: 1, y: 1 }, b: { x: 2, y: 2 }, gone: { x: 9, y: 9 } },
    VP,
    ["a", "b"], // 'gone' no longer exists
  );
  assert.deepEqual(Object.keys(merged.projects.P.positions).sort(), ["a", "b"]);
  assert.deepEqual(merged.projects.P.viewport, VP);
});

test("mergeReport: empty result removes the bucket", () => {
  const start = mergeReport(emptyLayout(), "P", { a: { x: 1, y: 1 } }, VP, ["a"]);
  const emptied = mergeReport(start, "P", {}, null, []);
  assert.ok(!("P" in emptied.projects), "bucket with no positions and no viewport is dropped");
});

test("buckets are independent per project (FR-008)", () => {
  let s = mergeReport(emptyLayout(), "P1", { a: { x: 1, y: 1 } }, VP, ["a"]);
  s = mergeReport(s, "P2", { a: { x: 5, y: 5 } }, VP, ["a"]);
  assert.deepEqual(positionsForProject(s, "P1"), { a: { x: 1, y: 1 } });
  assert.deepEqual(positionsForProject(s, "P2"), { a: { x: 5, y: 5 } });
  s = mergeReport(s, ALL_PROJECTS_BUCKET, { a: { x: 9, y: 9 } }, VP, ["a"]);
  assert.deepEqual(positionsForProject(s, "P1"), { a: { x: 1, y: 1 } }, "P1 untouched by __all__");
});

test("clearProject + resetEnabled", () => {
  const s = mergeReport(emptyLayout(), "P", { a: { x: 1, y: 1 } }, VP, ["a"]);
  assert.equal(resetEnabled(s, "P"), true);
  assert.equal(resetEnabled(s, "OTHER"), false);
  const cleared = clearProject(s, "P");
  assert.equal(resetEnabled(cleared, "P"), false);
  assert.equal(viewportForProject(cleared, "P"), null);
  assert.equal(clearProject(cleared, "P"), cleared, "clearing an absent bucket is a no-op");
});

test("round-trips through JSON (workspaceState serialization)", () => {
  const s = mergeReport(emptyLayout(), "P", { a: { x: 1, y: 2 } }, VP, ["a"]);
  assert.deepEqual(parseStored(JSON.parse(JSON.stringify(s))), s);
});
