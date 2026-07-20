import { test } from "node:test";
import assert from "node:assert/strict";
import {
  graphEnvelope,
  type ArtifactPresence,
  type ProjectGraph,
  type SpecNode,
  type WorkspaceGraph,
} from "../../src/core/index.js";

/**
 * Feature 014 — graphEnvelope builds the versioned kind:"graph" envelope from an already-built
 * WorkspaceGraph (no scan), with warnings scoped to the returned data.
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
function node(id: string, projectId: string): SpecNode {
  return {
    id,
    projectId,
    title: id,
    status: null,
    taskCompletion: null,
    completeness: NO_ART,
    warnings: [],
  };
}
function proj(
  id: string,
  nodes: SpecNode[],
  warnings: { code: string; message: string }[] = [],
): ProjectGraph {
  return { projectId: id, name: id, nodes, edges: [], warnings };
}

const G: WorkspaceGraph = {
  projects: [
    proj("P1", [node("a", "P1"), node("b", "P1")], [{ code: "w1", message: "p1 warn" }]),
    proj("P2", [node("x", "P2")], [{ code: "w2", message: "p2 warn" }]),
  ],
};

test("GE-1: unscoped → whole workspace envelope, all warnings, versioned kind graph", () => {
  const env = graphEnvelope(G);
  assert.equal(env.schemaVersion, 1);
  assert.equal(env.kind, "graph");
  const data = env.data as WorkspaceGraph;
  assert.deepEqual(
    data.projects.map((p) => p.projectId),
    ["P1", "P2"],
  );
  assert.deepEqual(env.warnings.map((w) => w.code).sort(), ["w1", "w2"]);
});

test("GE-2: scoped → a single ProjectGraph in data + only that project's warnings", () => {
  const env = graphEnvelope(G, { projectId: "P1" });
  const data = env.data as ProjectGraph;
  assert.equal(data.projectId, "P1");
  assert.equal(Array.isArray((data as unknown as WorkspaceGraph).projects), false);
  assert.deepEqual(
    env.warnings.map((w) => w.code),
    ["w1"],
  );
});

test("GE-3: unknown project id → valid empty ProjectGraph, no warnings, no throw", () => {
  const env = graphEnvelope(G, { projectId: "nope" });
  const data = env.data as ProjectGraph;
  assert.equal(data.projectId, "nope");
  assert.deepEqual(data.nodes, []);
  assert.deepEqual(data.edges, []);
  assert.deepEqual(env.warnings, []);
});

test("GE-4: empty workspace → valid empty envelope", () => {
  const env = graphEnvelope({ projects: [] });
  assert.equal(env.kind, "graph");
  assert.deepEqual((env.data as WorkspaceGraph).projects, []);
  assert.deepEqual(env.warnings, []);
});

test("GE-5: deterministic — two calls deep-equal and JSON-string-equal", () => {
  const a = graphEnvelope(G);
  const b = graphEnvelope(G);
  assert.deepEqual(a, b);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});
