import { test } from "node:test";
import assert from "node:assert/strict";
import {
  candidateBranchName,
  chooseBasis,
  type AttributionFacts,
} from "../../src/extension/attribution.js";

function facts(over: Partial<AttributionFacts> = {}): AttributionFacts {
  return {
    setting: "auto",
    folderBranchExists: false,
    branchBaseRef: null,
    firstCommitParentRef: null,
    ...over,
  };
}

test("012: candidateBranchName = folder id, any numbering scheme; total", () => {
  assert.equal(candidateBranchName("012-file-change-diff"), "012-file-change-diff");
  assert.equal(candidateBranchName("20260719-143022-x"), "20260719-143022-x");
  assert.equal(candidateBranchName("  005-help  "), "005-help");
  assert.equal(candidateBranchName(""), "");
});

test("012: chooseBasis prefers the branch when present and its base resolves", () => {
  const b = chooseBasis(facts({ folderBranchExists: true, branchBaseRef: "abc123" }));
  assert.equal(b.kind, "branch");
  assert.equal(b.beforeRef, "abc123");
  assert.equal(b.reason, null);
});

test("012: chooseBasis falls back to range when the branch is gone", () => {
  const b = chooseBasis(facts({ folderBranchExists: false, firstCommitParentRef: "def456" }));
  assert.equal(b.kind, "range");
  assert.equal(b.beforeRef, "def456");
});

test("012: chooseBasis returns none (+reason) when nothing is resolvable", () => {
  const b = chooseBasis(facts());
  assert.equal(b.kind, "none");
  assert.equal(b.beforeRef, null);
  assert.ok(b.reason && b.reason.length > 0);
});

test("012: forced range ignores an existing branch", () => {
  const b = chooseBasis(
    facts({
      setting: "range",
      folderBranchExists: true,
      branchBaseRef: "x",
      firstCommitParentRef: "y",
    }),
  );
  assert.equal(b.kind, "range");
  assert.equal(b.beforeRef, "y");
});

test("012: forced branch with no resolvable base → none", () => {
  const b = chooseBasis(
    facts({ setting: "branch", folderBranchExists: true, branchBaseRef: null }),
  );
  assert.equal(b.kind, "none");
  assert.ok(b.reason?.includes("base"));
});

test("012: off disables attribution", () => {
  const b = chooseBasis(facts({ setting: "off", folderBranchExists: true, branchBaseRef: "abc" }));
  assert.equal(b.kind, "none");
  assert.equal(b.label, "disabled");
});

test("012: chooseBasis is deterministic", () => {
  const f = facts({ folderBranchExists: true, branchBaseRef: "abc" });
  assert.deepEqual(chooseBasis(f), chooseBasis(f));
});
