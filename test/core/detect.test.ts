import { test } from "node:test";
import assert from "node:assert/strict";
import {
  detectRoot,
  detectRoots,
  SIGNAL_DOT_SPECIFY,
  SIGNAL_SPECS_SPEC,
  type WorkspaceRoot,
} from "../../src/core/index.js";

function root(entries: string[], overrides: Partial<WorkspaceRoot> = {}): WorkspaceRoot {
  return { id: "file:///w", name: "w", entries, ...overrides };
}

test("C-1: .specify present ⇒ qualifies with the .specify signal", () => {
  const r = detectRoot(root([".specify", "README.md"], { name: "alpha" }));
  assert.equal(r.qualifies, true);
  assert.ok(r.signals.includes(SIGNAL_DOT_SPECIFY));
  assert.equal(r.name, "alpha", "the root's display name is echoed onto the result");
});

test("C-1b: nested .specify entry also fires the signal", () => {
  const r = detectRoot(root([".specify/memory/constitution.md"]));
  assert.equal(r.qualifies, true);
  assert.ok(r.signals.includes(SIGNAL_DOT_SPECIFY));
});

test("C-2: specs/*/spec.md present (no .specify) ⇒ qualifies with the specs signal", () => {
  const r = detectRoot(root(["specs/001-x/spec.md", "src/index.ts"]));
  assert.equal(r.qualifies, true);
  assert.ok(r.signals.includes(SIGNAL_SPECS_SPEC));
  assert.ok(!r.signals.includes(SIGNAL_DOT_SPECIFY));
});

test("C-2b: deeper or non-spec.md specs paths do NOT fire the specs signal", () => {
  const r = detectRoot(root(["specs/001-x/contracts/api.md", "specs/spec.md"]));
  assert.ok(!r.signals.includes(SIGNAL_SPECS_SPEC));
  assert.equal(r.qualifies, false);
});

test("C-3: unrelated entries ⇒ does not qualify, no signals", () => {
  const r = detectRoot(root(["src/index.ts", "package.json", "docs/spec.md"]));
  assert.equal(r.qualifies, false);
  assert.deepEqual(r.signals, []);
});

test("C-4: empty entries ⇒ non-qualifying with an empty-workspace warning, no throw", () => {
  const r = detectRoot(root([]));
  assert.equal(r.qualifies, false);
  assert.ok(r.warnings.some((w) => w.code === "empty-workspace"));
});

test("windows-style backslash paths are normalized", () => {
  const r = detectRoot(root(["specs\\001-x\\spec.md"]));
  assert.equal(r.qualifies, true);
  assert.ok(r.signals.includes(SIGNAL_SPECS_SPEC));
});

test("detectRoots maps every root and never throws on odd input", () => {
  // deliberately malformed input to prove totality (Principle II)
  const bad = [undefined, { id: 5 }, root([".specify"])] as unknown as WorkspaceRoot[];
  const results = detectRoots(bad);
  assert.equal(results.length, 3);
  assert.equal(results[2].qualifies, true);
});
