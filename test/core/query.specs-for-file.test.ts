import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatText,
  specsForFile,
  toEnvelope,
  type ArtifactPresence,
  type ProjectGraph,
  type SpecNode,
  type WorkspaceGraph,
} from "../../src/core/index.js";

/**
 * Feature 013 — reverse traceability (specsForFile). Uses in-memory graphs with explicit
 * codeReferences (the established query-test pattern), so cases are precise and deterministic.
 */

const NO_ART: ArtifactPresence = {
  spec: false,
  plan: false,
  tasks: false,
  research: false,
  dataModel: false,
  quickstart: false,
  contracts: false,
  checklists: false,
};
function node(id: string, projectId: string, codeReferences?: string[]): SpecNode {
  return {
    id,
    projectId,
    title: id,
    status: null,
    taskCompletion: null,
    completeness: NO_ART,
    warnings: [],
    ...(codeReferences ? { codeReferences } : {}),
  };
}
function proj(id: string, nodes: SpecNode[]): ProjectGraph {
  return { projectId: id, name: id, nodes, edges: [], warnings: [] };
}

// P1: a → src/core/graph/heuristics.ts; b → src/webview/protocol.ts (+ heuristics too); c → no code.
const G: WorkspaceGraph = {
  projects: [
    proj("P1", [
      node("a", "P1", ["src/core/graph/heuristics.ts"]),
      node("b", "P1", ["src/webview/protocol.ts", "src/core/graph/heuristics.ts"]),
      node("c", "P1"), // specToCode off / no code refs
    ]),
    proj("P2", [node("x", "P2", ["src/core/graph/heuristics.ts"])]),
  ],
};

test("SFF-1: exact match returns every spec referencing the file, ordered by project then id", () => {
  const r = specsForFile(G, "src/core/graph/heuristics.ts");
  assert.equal(r.path, "src/core/graph/heuristics.ts");
  assert.deepEqual(
    r.matches.map((m) => `${m.projectId}/${m.specId}:${m.matchKind}`),
    ["P1/a:exact", "P1/b:exact", "P2/x:exact"],
  );
});

test("SFF-2: path normalization — ./ , ../ , backslashes all match a stored ref", () => {
  for (const p of [
    "./src/webview/protocol.ts",
    "../../src/webview/protocol.ts",
    "src\\webview\\protocol.ts",
  ]) {
    const r = specsForFile(G, p);
    assert.deepEqual(
      r.matches.map((m) => m.specId),
      ["b"],
      `expected b for ${p}`,
    );
    assert.equal(r.path, "src/webview/protocol.ts");
  }
});

test("SFF-3: folder fallback fires only when there is NO exact match; labeled 'folder'", () => {
  // No spec references this exact file, but two reference a file under src/core/graph/.
  const r = specsForFile(G, "src/core/graph/newFile.ts");
  assert.deepEqual(
    r.matches.map((m) => `${m.specId}:${m.matchKind}`),
    ["a:folder", "b:folder", "x:folder"],
  );
  // When an exact match exists, the folder fallback does not run (homogeneous result set).
  const exact = specsForFile(G, "src/core/graph/heuristics.ts");
  assert.ok(exact.matches.every((m) => m.matchKind === "exact"));
});

test("SFF-4: root-level file (no folder) → no folder fallback → empty", () => {
  assert.deepEqual(specsForFile(G, "README.ts").matches, []);
  assert.deepEqual(specsForFile(G, "package.json").matches, []);
});

test("SFF-5: empty / whitespace path → empty result, no throw", () => {
  assert.deepEqual(specsForFile(G, "").matches, []);
  assert.deepEqual(specsForFile(G, "   ").matches, []);
  assert.equal(specsForFile(G, "").path, "");
});

test("SFF-6: scope.projectId isolates a project — same path does not conflate across projects", () => {
  const r = specsForFile(G, "src/core/graph/heuristics.ts", { projectId: "P2" });
  assert.deepEqual(
    r.matches.map((m) => `${m.projectId}/${m.specId}`),
    ["P2/x"],
  );
});

test("SFF-7: a node without codeReferences (specToCode off) contributes nothing", () => {
  // 'c' has no codeReferences; a folder query under a path it could never match stays empty for it.
  const r = specsForFile(G, "src/core/graph/heuristics.ts");
  assert.ok(!r.matches.some((m) => m.specId === "c"));
});

test("SFF-8: deterministic — two calls are deep-equal and JSON-stable", () => {
  const r1 = specsForFile(G, "src/core/graph/heuristics.ts");
  const r2 = specsForFile(G, "src/core/graph/heuristics.ts");
  assert.deepEqual(r1, r2);
  const e1 = toEnvelope("file", r1, []);
  const e2 = toEnvelope("file", r2, []);
  assert.equal(JSON.stringify(e1), JSON.stringify(e2));
  assert.equal(e1.schemaVersion, 1);
  assert.equal(e1.kind, "file");
});

test("SFF-9: formatText renders the 'file' kind (exact and folder)", () => {
  const exact = formatText(toEnvelope("file", specsForFile(G, "src/core/graph/heuristics.ts"), []));
  assert.match(exact, /# specs for src\/core\/graph\/heuristics\.ts \(3 exact\)/);
  assert.match(exact, /a {2}\[—\] {2}\(exact\)/);

  const folder = formatText(toEnvelope("file", specsForFile(G, "src/core/graph/newFile.ts"), []));
  assert.match(folder, /\(3 folder\)/);
  assert.match(folder, /\(folder\)/);

  const none = formatText(toEnvelope("file", specsForFile(G, "README.ts"), []));
  assert.match(none, /# specs for README\.ts \(0\)/);
});
