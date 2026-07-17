import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMapViewModel, type DetectionResult } from "../../src/core/index.js";

function result(over: Partial<DetectionResult> = {}): DetectionResult {
  return { rootId: "file:///w", name: "w", qualifies: false, signals: [], warnings: [], ...over };
}

test("C-5: zero qualifying roots ⇒ welcome state, empty roots, null graph", () => {
  const m = buildMapViewModel([result(), result()]);
  assert.equal(m.state, "welcome");
  assert.deepEqual(m.qualifyingRoots, []);
  assert.equal(m.graph, null);
  assert.equal(m.schemaVersion, 1);
});

test("C-6: ≥1 qualifying root ⇒ empty state (no graph yet), lists qualifying root names", () => {
  const m = buildMapViewModel([
    result({ rootId: "file:///a", name: "alpha", qualifies: true, signals: ["has:.specify"] }),
    result({ rootId: "file:///b", name: "beta" }),
  ]);
  assert.equal(m.state, "empty");
  assert.deepEqual(m.qualifyingRoots, ["alpha"]);
  assert.equal(m.graph, null);
});

test("C-7: warnings from detection are carried into the view model", () => {
  const m = buildMapViewModel([
    result({ warnings: [{ code: "empty-workspace", message: "none" }] }),
  ]);
  assert.equal(m.warnings.length, 1);
  assert.equal(m.warnings[0].code, "empty-workspace");
});

test("C-8: the view model is JSON-serializable (round-trips unchanged)", () => {
  const m = buildMapViewModel([
    result({ rootId: "file:///a", qualifies: true, signals: ["has:.specify"] }),
  ]);
  const round = JSON.parse(JSON.stringify(m));
  assert.deepEqual(round, m);
});

test("buildMapViewModel is total on malformed input", () => {
  const m = buildMapViewModel(undefined as unknown as DetectionResult[]);
  assert.equal(m.state, "welcome");
  assert.equal(m.graph, null);
});
