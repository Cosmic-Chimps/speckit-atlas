import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeWorkspacePath } from "../../src/core/index.js";

/**
 * Feature 013 — the shared path normalizer (src/core/path.ts). It is the single source of
 * truth used by BOTH feature-011 code-reference extraction and the feature-013 reverse lookup,
 * so a query path and a stored codeReference normalize identically.
 */

test("PATH-1: equivalent spellings normalize to the same root-relative path", () => {
  const want = "src/a.ts";
  assert.equal(normalizeWorkspacePath("src/a.ts"), want);
  assert.equal(normalizeWorkspacePath("./src/a.ts"), want);
  assert.equal(normalizeWorkspacePath("../src/a.ts"), want);
  assert.equal(normalizeWorkspacePath("../../src/a.ts"), want);
  assert.equal(normalizeWorkspacePath("src\\a.ts"), want); // backslashes → "/"
  assert.equal(normalizeWorkspacePath("  ./src/a.ts  "), want); // trimmed
});

test("PATH-2: empty / whitespace / nullish → empty string (no throw)", () => {
  assert.equal(normalizeWorkspacePath(""), "");
  assert.equal(normalizeWorkspacePath("   "), "");
  // Defensive: tolerate a nullish input without throwing.
  assert.equal(normalizeWorkspacePath(undefined as unknown as string), "");
});

test("PATH-3: idempotent — normalizing an already-normal path is a no-op", () => {
  const n = normalizeWorkspacePath("src/core/graph/heuristics.ts");
  assert.equal(normalizeWorkspacePath(n), n);
});
