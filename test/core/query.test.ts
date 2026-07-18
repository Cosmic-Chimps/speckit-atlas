import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getGraph,
  orphans,
  runCheck,
  specRelationships,
  statusSummary,
  toEnvelope,
  type ProjectGraph,
  type RelationEdge,
  type SpecNode,
  type WorkspaceGraph,
} from "../../src/core/index.js";
import type { ArtifactPresence } from "../../src/core/index.js";

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
function node(id: string, projectId: string, over: Partial<SpecNode> = {}): SpecNode {
  return {
    id,
    projectId,
    title: id,
    status: null,
    taskCompletion: null,
    completeness: NO_ART,
    warnings: [],
    ...over,
  };
}
function edge(source: string, target: string, over: Partial<RelationEdge> = {}): RelationEdge {
  return {
    source,
    target,
    heuristic: "link",
    tier: "definitive",
    weight: 1,
    evidence: [],
    ...over,
  };
}
function proj(id: string, nodes: SpecNode[], edges: RelationEdge[]): ProjectGraph {
  return { projectId: id, name: id, nodes, edges, warnings: [] };
}

// P1: a→b link, plus isolated c.  P2: single node x.
const G: WorkspaceGraph = {
  projects: [
    proj(
      "P1",
      [
        node("a", "P1", { status: "Draft", taskCompletion: { done: 1, total: 2 } }),
        node("b", "P1"),
        node("c", "P1"),
      ],
      [edge("a", "b")],
    ),
    proj("P2", [node("x", "P2", { status: "Implemented" })], []),
  ],
};

test("Q-1: getGraph scopes to a project or returns all; no cross-project edges", () => {
  const all = getGraph(G) as WorkspaceGraph;
  assert.equal(all.projects.length, 2);
  const p1 = getGraph(G, { projectId: "P1" }) as ProjectGraph;
  assert.equal(p1.projectId, "P1");
  assert.equal(p1.nodes.length, 3);
  for (const e of p1.edges) {
    const ids = new Set(p1.nodes.map((n) => n.id));
    assert.ok(ids.has(e.source) && ids.has(e.target));
  }
});

test("Q-2: specRelationships — directions + unknown id found:false", () => {
  const a = specRelationships(G, "a");
  assert.equal(a.found, true);
  assert.equal(a.dependsOn.length, 1);
  assert.equal(a.dependsOn[0].target, "b");
  assert.equal(a.dependedOnBy.length, 0);
  const b = specRelationships(G, "b");
  assert.equal(b.dependedOnBy.length, 1);
  const miss = specRelationships(G, "nope");
  assert.equal(miss.found, false);
  assert.equal(miss.spec, null);
});

test("Q-3: statusSummary per-spec + aggregate", () => {
  const s = statusSummary(G);
  assert.equal(s.aggregate.specs, 4);
  assert.equal(s.aggregate.tasksDone, 1);
  assert.equal(s.aggregate.tasksTotal, 2);
  assert.equal(s.aggregate.byStatus["Draft"], 1);
  assert.equal(s.aggregate.byStatus["Implemented"], 1);
});

test("Q-4: orphans = specs with no incident edge, sorted", () => {
  assert.deepEqual(orphans(G).orphans, ["c", "x"]);
  assert.deepEqual(orphans(G, { projectId: "P1" }).orphans, ["c"]);
});

test("Q-5: runCheck no-orphans; unknown rule fails open", () => {
  const r = runCheck(G, "no-orphans");
  assert.equal(r.ok, false);
  assert.deepEqual(r.violations, ["c", "x"]);
  const clean = runCheck(
    { projects: [proj("P", [node("a", "P"), node("b", "P")], [edge("a", "b")])] },
    "no-orphans",
  );
  assert.equal(clean.ok, true);
  assert.equal(runCheck(G, "bogus-rule").ok, true); // fails open, documented
});

test("Q-6: envelope is versioned, deterministic, JSON round-trips", () => {
  const e1 = toEnvelope("orphans", orphans(G), []);
  assert.equal(e1.schemaVersion, 1);
  assert.equal(e1.kind, "orphans");
  const e2 = toEnvelope("orphans", orphans(G), []);
  assert.equal(JSON.stringify(e1), JSON.stringify(e2)); // deterministic
  assert.deepEqual(JSON.parse(JSON.stringify(e1)), e1);
});
