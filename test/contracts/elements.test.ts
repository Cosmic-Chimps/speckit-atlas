import { test } from "node:test";
import assert from "node:assert/strict";
import {
  edgeStyleFor,
  nodeStyleFor,
  sortFilesByName,
  statusClass,
  toCytoscapeElements,
  type CyEdgeData,
  type CyNodeData,
} from "../../src/webview/map/elements.js";
import type {
  ArtifactPresence,
  ProjectGraph,
  RelationEdge,
  SpecNode,
  WorkspaceGraph,
} from "../../src/core/index.js";

const ALL_ARTIFACTS: ArtifactPresence = {
  spec: true,
  plan: true,
  tasks: true,
  research: true,
  dataModel: true,
  quickstart: true,
  contracts: true,
  checklists: true,
};
const NO_ARTIFACTS: ArtifactPresence = {
  spec: false,
  plan: false,
  tasks: false,
  research: false,
  dataModel: false,
  quickstart: false,
  contracts: false,
  checklists: false,
};

function node(id: string, over: Partial<SpecNode> = {}): SpecNode {
  return {
    id,
    projectId: "P",
    title: id,
    status: null,
    taskCompletion: null,
    completeness: NO_ARTIFACTS,
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
function project(projectId: string, nodes: SpecNode[], edges: RelationEdge[]): ProjectGraph {
  return { projectId, name: projectId, nodes, edges, warnings: [] };
}

test("R-25: one element per node + edge; isolated nodes included; JSON round-trips", () => {
  const g: WorkspaceGraph = {
    projects: [project("P", [node("a"), node("b"), node("c")], [edge("a", "b")])],
  };
  const els = toCytoscapeElements(g, null);
  const nodes = els.filter((e) => e.group === "nodes");
  const edges = els.filter((e) => e.group === "edges");
  assert.equal(nodes.length, 3, "isolated node c included");
  assert.equal(edges.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(els)), els);
});

test("R-25: no cross-project edges; activeProjectId scopes to one project", () => {
  // Both projects reuse node id "x". P1 additionally carries a buggy edge x→y where y is
  // NOT in P1 (only exists conceptually elsewhere) — it must be dropped, never linking projects.
  const g: WorkspaceGraph = {
    projects: [
      project("P1", [{ ...node("x"), projectId: "P1" }], [edge("x", "y")]),
      project("P2", [{ ...node("x"), projectId: "P2" }], []),
    ],
  };
  const all = toCytoscapeElements(g, null);
  assert.equal(
    all.filter((e) => e.group === "edges").length,
    0,
    "edge to a non-member node dropped",
  );
  for (const el of all.filter((e) => e.group === "edges")) {
    const d = el.data as CyEdgeData;
    // every edge's endpoints belong to the SAME project (both present in one project's node set)
    const p1 = g.projects[0].nodes.map((n) => n.id);
    const p2 = g.projects[1].nodes.map((n) => n.id);
    const within = (ids: string[]) => ids.includes(d.source) && ids.includes(d.target);
    assert.ok(within(p1) || within(p2), "edge stays within one project");
  }
  const scoped = toCytoscapeElements(g, "P2");
  assert.equal(scoped.filter((e) => e.group === "nodes").length, 1);
  assert.equal((scoped[0].data as CyNodeData).projectId, "P2");
});

test("R-23: nodeStyleFor is deterministic from status/completion/warnings", () => {
  assert.equal(statusClass("Implemented (authored retroactively)"), "status-implemented");
  assert.equal(statusClass("Draft  "), "status-draft");
  assert.equal(statusClass(null), "status-unknown");

  const s = nodeStyleFor(
    node("a", {
      status: "Draft",
      taskCompletion: { done: 3, total: 4 },
      warnings: [{ code: "x", message: "m" }],
    }),
  );
  assert.equal(s.statusClass, "status-draft");
  assert.equal(s.completion, 0.75);
  assert.equal(s.warn, true);

  assert.equal(nodeStyleFor(node("b")).completion, 0, "no task list → 0 completion");
});

test("R-24: edgeStyleFor maps tier→line, weight→width, symmetric→arrow", () => {
  assert.equal(edgeStyleFor(edge("a", "b", { tier: "definitive" })).lineStyle, "solid");
  assert.equal(edgeStyleFor(edge("a", "b", { tier: "medium" })).lineStyle, "dashed");
  assert.equal(edgeStyleFor(edge("a", "b", { tier: "risky" })).lineStyle, "dotted");

  assert.equal(edgeStyleFor(edge("a", "b", { weight: 1 })).width, 1);
  assert.ok(edgeStyleFor(edge("a", "b", { weight: 5 })).width > 1);
  assert.ok(edgeStyleFor(edge("a", "b", { weight: 999 })).width <= 6, "width is capped");

  assert.equal(edgeStyleFor(edge("a", "b", { symmetric: true })).targetArrow, "none");
  assert.equal(edgeStyleFor(edge("a", "b")).targetArrow, "triangle");
});

test("011: sortFilesByName de-dupes and orders by basename (case-insensitive, full-path tiebreak)", () => {
  const out = sortFilesByName([
    "src/z/App.ts",
    "src/a/app.ts",
    "src/core/Beta.ts",
    "src/z/App.ts", // duplicate
    "src/core/alpha.ts",
  ]);
  // Ordered by basename: alpha.ts, app.ts, App.ts, Beta.ts — App.ts/app.ts share a basename → full-path tiebreak.
  assert.deepEqual(out, ["src/core/alpha.ts", "src/a/app.ts", "src/z/App.ts", "src/core/Beta.ts"]);
});

test("011: sortFilesByName is total and deterministic (SC-002)", () => {
  assert.deepEqual(sortFilesByName([]), []);
  assert.deepEqual(sortFilesByName(["only.ts"]), ["only.ts"]);
  const input = ["src/b.ts", "src/a.ts", "src/b.ts"];
  assert.deepEqual(sortFilesByName(input), sortFilesByName(input), "identical output on repeat");
});

test("011: CyNodeData.files is populated from codeReferences, sorted & de-duped; [] when absent", () => {
  const withFiles = toCytoscapeElements(
    {
      projects: [
        project("P", [node("a", { codeReferences: ["src/b.ts", "src/a.ts", "src/b.ts"] })], []),
      ],
    },
    null,
  );
  assert.deepEqual((withFiles[0].data as CyNodeData).files, ["src/a.ts", "src/b.ts"]);

  const noFiles = toCytoscapeElements({ projects: [project("P", [node("a")], [])] }, null);
  assert.deepEqual((noFiles[0].data as CyNodeData).files, []);
});

test("completeness fraction reflects present artifacts", () => {
  const full = toCytoscapeElements(
    { projects: [project("P", [node("a", { completeness: ALL_ARTIFACTS })], [])] },
    null,
  );
  assert.equal((full[0].data as CyNodeData).completeness, 1);
});
