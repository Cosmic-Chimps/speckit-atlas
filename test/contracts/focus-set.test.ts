import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAdjacency, computeFocusVisible } from "../../src/webview/map/focus.js";

// Sample graph:  a — b,  a — c,  b — c,  d isolated
const EDGES = [
  { source: "a", target: "b" },
  { source: "a", target: "c" },
  { source: "b", target: "c" },
];

test("buildAdjacency: undirected — each edge adds both directions", () => {
  const adj = buildAdjacency(EDGES);
  assert.deepEqual([...(adj.get("a") ?? [])].sort(), ["b", "c"]);
  assert.deepEqual([...(adj.get("b") ?? [])].sort(), ["a", "c"]);
  assert.deepEqual([...(adj.get("c") ?? [])].sort(), ["a", "b"]);
});

test("computeFocusVisible: null selection → showAll", () => {
  const r = computeFocusVisible(buildAdjacency(EDGES), null);
  assert.equal(r.showAll, true);
  assert.equal(r.nodes.size, 0);
});

test("computeFocusVisible: unknown selection → showAll (graceful, never throws)", () => {
  const r = computeFocusVisible(buildAdjacency(EDGES), "zzz");
  assert.equal(r.showAll, true);
});

test("computeFocusVisible: closed one-hop neighborhood incl. self (FR-005)", () => {
  const r = computeFocusVisible(buildAdjacency(EDGES), "a");
  assert.equal(r.showAll, false);
  assert.deepEqual([...r.nodes].sort(), ["a", "b", "c"]);
});

test("computeFocusVisible: neighbor as selection yields its own closed neighborhood", () => {
  const r = computeFocusVisible(buildAdjacency(EDGES), "b");
  assert.deepEqual([...r.nodes].sort(), ["a", "b", "c"]);
});

test("computeFocusVisible: isolated but real node → just itself (via knownNodeIds)", () => {
  const adj = buildAdjacency(EDGES); // "d" has no edges, so it is not an adjacency key
  const known = new Set(["a", "b", "c", "d"]);
  const r = computeFocusVisible(adj, "d", known);
  assert.equal(r.showAll, false);
  assert.deepEqual([...r.nodes], ["d"]);
});

test("computeFocusVisible: isolated node without knownNodeIds → showAll (falls back to adjacency membership)", () => {
  const r = computeFocusVisible(buildAdjacency(EDGES), "d");
  assert.equal(r.showAll, true);
});
