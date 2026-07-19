import { test } from "node:test";
import assert from "node:assert/strict";
import { buildProjectGraph, parseFeature, type FeatureInput } from "../../src/core/index.js";

// Mirrors the real number derivation (projectScan/nodeScan `^(\d{3})-`): a numeric `number`
// only for sequential folders, null for timestamp/unnumbered. Identity is always the folder id.
function feat(id: string, spec: string): FeatureInput {
  return { id, number: id.match(/^(\d{3})-/)?.[1] ?? null, artifacts: ["spec"], files: { "spec.md": spec } };
}
function graphOf(features: FeatureInput[], options = {}) {
  return buildProjectGraph("p", "P", features.map(parseFeature), options);
}
const edge = (g: ReturnType<typeof graphOf>, s: string, t: string) =>
  g.edges.find((e) => e.source === s && e.target === t);

// ── US1: timestamp scheme ────────────────────────────────────────────────────
test("ID-1 / SC-001: timestamp features form link + slug-mention edges", () => {
  const alpha = "20260101-090000-alpha";
  const beta = "20260102-100000-beta";
  const g = graphOf([
    feat(alpha, `# A\nsee ](../${beta}/spec.md). also names ${beta}.`),
    feat(beta, `# B\ncontinues ${alpha}; see ${alpha} for context.`),
  ]);
  const ab = edge(g, alpha, beta);
  assert.ok(ab, "alpha → beta edge exists");
  assert.equal(ab.tier, "definitive", "link wins over the co-occurring mention");

  const ba = edge(g, beta, alpha);
  assert.ok(ba, "beta → alpha edge exists");
  assert.equal(ba.heuristic, "slug-mention");
  assert.equal(ba.tier, "strong");
  assert.equal(ba.weight, 2, "alpha named twice → weight 2");
});

// ── US2: mixed + unnumbered schemes ──────────────────────────────────────────
test("ID-2 / SC-002: mixed schemes connect; unnumbered folders participate", () => {
  const x = "003-sequential-x";
  const y = "20260301-120000-timestamp-y";
  const z = "unnumbered-preset-z";
  const g = graphOf([
    feat(x, `# X\nlink ](../${y}/spec.md). relates to ${z} by name.`),
    feat(y, `# Y\nbuilds on ${x}.`),
    feat(z, `# Z\nextends ](../${x}/spec.md).`),
  ]);
  assert.equal(edge(g, x, y)?.tier, "definitive", "sequential → timestamp link");
  assert.equal(edge(g, y, x)?.heuristic, "slug-mention", "timestamp → sequential by name (cross-scheme)");
  assert.ok(edge(g, x, z), "unnumbered folder is a valid mention target");
  assert.equal(edge(g, z, x)?.tier, "definitive", "unnumbered folder is a valid link source");
});

// ── US3: no regression + precision ───────────────────────────────────────────
test("ID-3 / SC-003: sequential slug-mention behavior unchanged (count-weighted)", () => {
  const g = graphOf([feat("001-a", "# A\nRelates to 002-b, 002-b and 002-b."), feat("002-b", "# B")]);
  const e = edge(g, "001-a", "002-b");
  assert.ok(e);
  assert.equal(e.heuristic, "slug-mention");
  assert.equal(e.tier, "strong");
  assert.equal(e.weight, 3, "three mentions → weight 3 (matches the legacy extractor)");
});

test("ID-4 / SC-004: only real siblings match; whole-word (no substring)", () => {
  const g = graphOf([
    feat("001-a", "# A\nMentions 002-b. Not a real 999-ghost. The author used auth."),
    feat("002-b", "# B"),
    feat("auth", "# Auth"),
  ]);
  assert.ok(edge(g, "001-a", "002-b"), "real sibling 002-b matched");
  assert.ok(!g.edges.some((e) => e.target === "999-ghost"), "a non-sibling token never forms an edge");
  const a = edge(g, "001-a", "auth");
  assert.ok(a, "common-word sibling matched as a whole word");
  assert.equal(a.weight, 1, "'auth' is NOT counted inside 'author' (whole-word only)");
});

test("ID-5 / SC-005: timestamp/unnumbered never fabricate a bare number; no crash", () => {
  const ts = "20260101-090000-x";
  const g = graphOf([feat(ts, "# X\nprose with 123 and 456 in it"), feat("y", "# Y")], {
    bareNumbers: true,
  });
  assert.ok(
    !g.edges.some((e) => e.heuristic === "bare-number"),
    "no bare-number edge — timestamp/unnumbered features have no numeric identity",
  );
  assert.equal(g.nodes.length, 2, "both features still discovered as nodes");
});
