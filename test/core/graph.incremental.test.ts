import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildProjectGraph,
  parseFeature,
  type FeatureFacts,
  type FeatureInput,
} from "../../src/core/index.js";

function feat(id: string, over: Partial<FeatureInput> = {}): FeatureInput {
  return { id, number: id.slice(0, 3), artifacts: ["spec"], files: {}, ...over };
}

/**
 * SC-008: a single-file change only needs the affected feature re-parsed. This proves
 * the property at the core level — re-parsing ONE feature and reusing the others'
 * cached FeatureFacts yields a byte-identical graph to a full rebuild. (The adapter
 * then only needs to re-read one file on change.)
 */
test("incremental: re-parsing one changed feature equals a full rebuild", () => {
  const inputs: FeatureInput[] = [
    feat("001-a", { files: { "spec.md": "mentions 002-b" } }),
    feat("002-b", { files: { "spec.md": "# Feature Specification: Beta\n**Status**: Draft" } }),
    feat("003-c", { files: { "spec.md": "](../001-a/spec.md)" } }),
  ];

  // Initial parse of all features (the adapter would cache these).
  const cache = new Map<string, FeatureFacts>(inputs.map((i) => [i.id, parseFeature(i)]));

  // A single file changes: 002-b gets a new status. Only re-parse 002-b.
  const changed = feat("002-b", {
    files: { "spec.md": "# Feature Specification: Beta\n**Status**: Implemented" },
  });
  cache.set("002-b", parseFeature(changed));
  const incremental = buildProjectGraph("p", "P", [...cache.values()]);

  // Full rebuild from scratch with the same changed input.
  const fullInputs = inputs.map((i) => (i.id === "002-b" ? changed : i));
  const full = buildProjectGraph("p", "P", fullInputs.map(parseFeature));

  assert.deepEqual(incremental, full, "per-feature recompute reproduces the full graph");
  assert.equal(incremental.nodes.find((n) => n.id === "002-b")?.status, "Implemented");
});
