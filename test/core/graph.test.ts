import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildProjectGraph,
  buildWorkspaceGraph,
  parseFeature,
  type FeatureInput,
  type ProjectSnapshot,
} from "../../src/core/index.js";

function feat(id: string, over: Partial<FeatureInput> = {}): FeatureInput {
  return { id, number: id.slice(0, 3), artifacts: ["spec"], files: {}, ...over };
}

function graphOf(features: FeatureInput[], options = {}) {
  return buildProjectGraph("p1", "P1", features.map(parseFeature), options);
}

test("G-5: a relative cross-feature link yields a definitive edge", () => {
  const a = feat("001-a", { files: { "spec.md": "See ](../002-b/spec.md) for details." } });
  const b = feat("002-b");
  const g = graphOf([a, b]);
  const e = g.edges.find((x) => x.source === "001-a" && x.target === "002-b");
  assert.ok(e, "edge 001-a -> 002-b exists");
  assert.equal(e.tier, "definitive");
  assert.equal(e.heuristic, "link");
});

test("nodes: one per feature with id + title", () => {
  const g = graphOf([
    feat("001-a", { files: { "spec.md": "# Feature Specification: Alpha" } }),
    feat("002-b"),
  ]);
  assert.equal(g.nodes.length, 2);
  assert.equal(g.nodes.find((n) => n.id === "001-a")?.title, "Alpha");
  assert.equal(g.nodes.find((n) => n.id === "002-b")?.title, "002-b"); // fallback to slug
});

test("G-10: no edge crosses a project boundary (independent sub-graphs)", () => {
  // Two projects both contain 001-a linking 002-b and share entity Flight.
  const mk = (): FeatureInput[] => [
    feat("001-a", {
      files: {
        "spec.md": "](../002-b/spec.md)",
        "data-model.md": "### Flight (existing — db.types.ts:982)",
      },
    }),
    feat("002-b", { files: { "data-model.md": "### Flight (existing — db.types.ts:982)" } }),
  ];
  const snaps: ProjectSnapshot[] = [
    { projectId: "P1", name: "P1", features: mk() },
    { projectId: "P2", name: "P2", features: mk() },
  ];
  const wg = buildWorkspaceGraph(snaps);
  assert.equal(wg.projects.length, 2);
  for (const proj of wg.projects) {
    const ids = new Set(proj.nodes.map((n) => n.id));
    for (const e of proj.edges) {
      assert.ok(ids.has(e.source) && ids.has(e.target), "edge endpoints are in-project");
    }
  }
});

test("G-11: self-reference makes no edge; multiple signals collapse to one", () => {
  // A links to B AND mentions B's slug in prose -> exactly one edge, definitive.
  const a = feat("001-a", {
    files: { "spec.md": "](../002-b/spec.md) and again 002-b 002-b in prose. Also 001-a self." },
  });
  const g = graphOf([a, feat("002-b")]);
  const ab = g.edges.filter((e) => e.source === "001-a" && e.target === "002-b");
  assert.equal(ab.length, 1, "single collapsed edge");
  assert.equal(ab[0].tier, "definitive", "strongest tier wins");
  assert.ok(!g.edges.some((e) => e.source === e.target), "no self-edges");
});

test("G-13: totality — malformed/empty input never throws", () => {
  assert.doesNotThrow(() => parseFeature(undefined as unknown as FeatureInput));
  assert.doesNotThrow(() => buildProjectGraph("p", "P", undefined as never));
  const g = buildProjectGraph("p", "P", [
    parseFeature({ id: "x", number: null, artifacts: [], files: {} }),
  ]);
  assert.equal(g.nodes.length, 1);
});

test("G-14: the graph is JSON-serializable (round-trips unchanged)", () => {
  const g = graphOf([
    feat("001-a", { files: { "spec.md": "](../002-b/spec.md)" } }),
    feat("002-b"),
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(g)), g);
});

test("FR-021: builds from a vanilla repo — front-matter/depends_on metadata is ignored", () => {
  // A YAML-ish front-matter block declaring depends_on must NOT create edges; only the
  // inferred link signal should. (No proprietary metadata is required or honored.)
  const a = feat("001-a", {
    files: {
      "spec.md":
        "---\ndepends_on: [999-ghost]\nrelated: [998-ghost]\n---\n\nSee ](../002-b/spec.md).",
    },
  });
  const g = graphOf([a, feat("002-b")]);
  assert.ok(
    g.edges.some((e) => e.source === "001-a" && e.target === "002-b" && e.tier === "definitive"),
    "the inferred link edge is present",
  );
  assert.equal(
    g.edges.filter((e) => e.target === "999-ghost" || e.target === "998-ghost").length,
    0,
    "declared metadata targets are ignored (not real siblings, no edge)",
  );
});
