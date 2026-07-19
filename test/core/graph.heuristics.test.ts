import { test } from "node:test";
import assert from "node:assert/strict";
import { buildProjectGraph, parseFeature, type FeatureInput } from "../../src/core/index.js";

function feat(id: string, over: Partial<FeatureInput> = {}): FeatureInput {
  return { id, number: id.slice(0, 3), artifacts: ["spec"], files: {}, ...over };
}
function graphOf(features: FeatureInput[], options = {}) {
  return buildProjectGraph("p1", "P1", features.map(parseFeature), options);
}

test("G-6: slug mentions yield a strong edge weighted by mention count", () => {
  const a = feat("001-a", { files: { "spec.md": "relates to 002-b, 002-b, and 002-b again." } });
  const g = graphOf([a, feat("002-b")]);
  const e = g.edges.find((x) => x.source === "001-a" && x.target === "002-b");
  assert.ok(e);
  assert.equal(e.tier, "strong");
  assert.equal(e.heuristic, "slug-mention");
  assert.equal(e.weight, 3);
});

test("G-7: shared code-pinned entity connects; a bare shared name does not", () => {
  const dmPinned = "### Flight (existing — db.types.ts:982)";
  const dmBare = "### Report\nsome prose";
  const g = graphOf([
    feat("001-a", { files: { "data-model.md": `${dmPinned}\n${dmBare}` } }),
    feat("002-b", { files: { "data-model.md": `${dmPinned}\n${dmBare}` } }),
  ]);
  const shared = g.edges.filter((e) => e.heuristic === "shared-entity");
  assert.equal(shared.length, 1, "exactly one shared-entity edge (Flight), not Report");
  assert.equal(shared[0].tier, "medium");
  assert.equal(shared[0].symmetric, true);
  assert.ok(shared[0].evidence.some((ev) => ev.includes("Flight")));
});

test("G-8: bare feature numbers produce a risky edge by default, gone when disabled", () => {
  const a = feat("001-a", { files: { "spec.md": "see 002 for the rationale" } });
  const b = feat("002-b");
  const on = graphOf([a, b]); // bareNumbers is on by default
  const e = on.edges.find((x) => x.heuristic === "bare-number");
  assert.ok(e, "risky edge present by default");
  assert.equal(e.tier, "risky");
  assert.equal(e.target, "002-b");

  const off = graphOf([a, b], { bareNumbers: false });
  assert.equal(off.edges.filter((x) => x.heuristic === "bare-number").length, 0);
});

test("G-9: toggling one heuristic off removes exactly its edges (disjoint pairs)", () => {
  // 001-a → 002-b connected ONLY by a slug mention; 003-c ↔ 004-d ONLY by a shared entity.
  const pinned = "### Flight (existing — db.types.ts:982)";
  const features = [
    feat("001-a", { files: { "spec.md": "mentions 002-b in prose" } }),
    feat("002-b"),
    feat("003-c", { files: { "data-model.md": pinned } }),
    feat("004-d", { files: { "data-model.md": pinned } }),
  ];
  const all = graphOf(features);
  const noSlug = graphOf(features, { slugMentions: false });

  // The slug edge exists with slug on, gone with slug off…
  assert.ok(all.edges.some((e) => e.heuristic === "slug-mention"));
  assert.equal(noSlug.edges.filter((e) => e.heuristic === "slug-mention").length, 0);
  // …and every non-slug edge is byte-identical across the two builds.
  const nonSlug = (es: typeof all.edges) => es.filter((e) => e.heuristic !== "slug-mention");
  assert.deepEqual(nonSlug(noSlug.edges), nonSlug(all.edges));
  assert.ok(nonSlug(all.edges).some((e) => e.heuristic === "shared-entity"));
});

test("G-12: a duplicated feature number is ambiguous → warning, no bare-number edge", () => {
  const a = feat("001-a", { number: "002", files: { "spec.md": "see 003" } });
  const b = feat("002-b", { number: "003" });
  const c = feat("003-c", { number: "003" }); // duplicate number 003
  const g = graphOf([a, b, c], { bareNumbers: true });
  assert.ok(g.warnings.some((w) => w.code === "ambiguous-number"));
  assert.equal(g.edges.filter((e) => e.target === "002-b" || e.target === "003-c").length, 0);
});

test("FR-014: disabling the dominant heuristic re-tiers a multi-supported edge, not deletes it", () => {
  // 001-a → 002-b supported by BOTH a slug mention (strong) and a shared entity (medium).
  const pinned = "### Flight (existing — db.types.ts:982)";
  const features = [
    feat("001-a", { files: { "spec.md": "relates to 002-b", "data-model.md": pinned } }),
    feat("002-b", { files: { "data-model.md": pinned } }),
  ];
  const all = graphOf(features);
  const collapsed = all.edges.find((e) => e.source === "001-a" && e.target === "002-b");
  assert.equal(collapsed?.tier, "strong", "collapses to the strongest supporter");

  const noSlug = graphOf(features, { slugMentions: false });
  const reTiered = noSlug.edges.find((e) => e.source === "001-a" && e.target === "002-b");
  assert.ok(reTiered, "edge survives — still supported by shared-entity");
  assert.equal(reTiered.tier, "medium", "re-tiers to the strongest remaining supporter");
});
