import { test } from "node:test";
import assert from "node:assert/strict";
import { centroidFor, classifySeed } from "../../src/webview/map/layout.js";

test("classifySeed: all current nodes saved → preset", () => {
  const plan = classifySeed({ a: { x: 0, y: 0 }, b: { x: 1, y: 1 } }, ["a", "b"]);
  assert.equal(plan.mode, "preset");
  assert.deepEqual(plan.knownIds.sort(), ["a", "b"]);
  assert.deepEqual(plan.newIds, []);
});

test("classifySeed: some new → partial with the correct newIds (FR-006)", () => {
  const plan = classifySeed({ a: { x: 0, y: 0 } }, ["a", "b", "c"]);
  assert.equal(plan.mode, "partial");
  assert.deepEqual(plan.knownIds, ["a"]);
  assert.deepEqual(plan.newIds.sort(), ["b", "c"]);
});

test("classifySeed: nothing saved (or empty/absent) → none", () => {
  assert.equal(classifySeed({}, ["a", "b"]).mode, "none");
  assert.equal(classifySeed(null, ["a"]).mode, "none");
  assert.equal(classifySeed(undefined, ["a"]).mode, "none");
});

test("classifySeed: no current nodes → none", () => {
  assert.equal(classifySeed({ a: { x: 0, y: 0 } }, []).mode, "none");
});

test("centroidFor: averages neighbour positions; null when empty", () => {
  assert.deepEqual(
    centroidFor([
      { x: 0, y: 0 },
      { x: 4, y: 2 },
    ]),
    { x: 2, y: 1 },
  );
  assert.equal(centroidFor([]), null);
});
