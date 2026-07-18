import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ENCODING_NOTES,
  HELP_ENTRIES,
  hasActiveFilter,
  type HelpEntryId,
} from "../../src/webview/controls/help.js";
import { DEFAULT_GRAPH_OPTIONS } from "../../src/core/index.js";

test("HLP-2: HELP_ENTRIES lists exactly the five relationship types", () => {
  assert.deepEqual(HELP_ENTRIES.map((e) => e.id).sort(), [
    "bare-number",
    "link",
    "shared-entity",
    "slug",
    "spec-code",
  ]);
});

test("HLP-3: each entry has the right tier and a non-empty description", () => {
  const tierById: Record<HelpEntryId, string> = {
    link: "definitive",
    slug: "strong",
    "shared-entity": "medium",
    "bare-number": "risky",
    "spec-code": "layer",
  };
  for (const e of HELP_ENTRIES) {
    assert.equal(e.tier, tierById[e.id], `${e.id} tier`);
    assert.ok(e.description.trim().length > 0, `${e.id} has a description`);
    assert.ok(e.label.trim().length > 0, `${e.id} has a label`);
  }
});

test("HLP-4: defaultOn matches DEFAULT_GRAPH_OPTIONS (FR-008 consistency)", () => {
  const on = (id: HelpEntryId): boolean => HELP_ENTRIES.find((e) => e.id === id)!.defaultOn;
  assert.equal(on("link"), DEFAULT_GRAPH_OPTIONS.links); // true (locked)
  assert.equal(on("slug"), DEFAULT_GRAPH_OPTIONS.slugMentions);
  assert.equal(on("shared-entity"), DEFAULT_GRAPH_OPTIONS.sharedEntities);
  assert.equal(on("bare-number"), DEFAULT_GRAPH_OPTIONS.bareNumbers); // false
  assert.equal(on("spec-code"), DEFAULT_GRAPH_OPTIONS.specToCode); // false
});

test("HLP-5: ENCODING_NOTES cover node and edge encodings", () => {
  assert.ok(ENCODING_NOTES.some((n) => n.kind === "node"));
  assert.ok(ENCODING_NOTES.some((n) => n.kind === "edge"));
  // node: status, completion, warnings; edge: style, thickness, arrow
  const text = ENCODING_NOTES.map((n) => `${n.label} ${n.description}`.toLowerCase()).join(" ");
  for (const term of ["status", "task-completion", "warning", "tier", "weight", "arrow"]) {
    assert.match(text, new RegExp(term), `mentions ${term}`);
  }
});

test("H-4: hasActiveFilter truth table", () => {
  assert.equal(hasActiveFilter(true, true), false); // nothing to clear
  assert.equal(hasActiveFilter(false, true), true);
  assert.equal(hasActiveFilter(true, false), true);
  assert.equal(hasActiveFilter(false, false), true);
});
