import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import type {
  CheckResult,
  Orphans,
  ProjectGraph,
  QueryResult,
  SpecRelationships,
  SpecsForFile,
  StatusSummary,
  WorkspaceGraph,
} from "../../src/core/index.js";

// out/test/cli → repo root is three levels up.
const repo = path.resolve(__dirname, "../../..");
const CLI = path.join(repo, "dist", "cli.js");
const demo = path.join(repo, "fixtures", "graph", "render-demo");
const malformed = path.join(repo, "fixtures", "graph", "malformed");
const twoProjects = path.join(repo, "fixtures", "graph", "two-projects");
const timestamp = path.join(repo, "fixtures", "graph", "timestamp-numbering");

interface RunOut {
  status: number;
  stdout: string;
}
function run(args: string[]): RunOut {
  try {
    const stdout = execFileSync("node", [CLI, ...args], { encoding: "utf8" });
    return { status: 0, stdout };
  } catch (err) {
    const e = err as { status?: number; stdout?: string };
    return { status: e.status ?? 1, stdout: e.stdout ?? "" };
  }
}
function json(args: string[]): { status: number; env: QueryResult } {
  const out = run(args);
  return { status: out.status, env: JSON.parse(out.stdout) as QueryResult };
}

test("CLI-1: graph → versioned envelope with the model's nodes/edges", () => {
  const { env } = json(["graph", "--root", demo]);
  assert.equal(env.schemaVersion, 1);
  assert.equal(env.kind, "graph");
  const wg = env.data as WorkspaceGraph;
  assert.equal(wg.projects[0].nodes.length, 3);
  assert.equal(wg.projects[0].edges.length, 2);
});

test("CLI-2: spec → relationships; unknown id found:false, exit 0", () => {
  const rel = json(["spec", "001-alpha", "--root", demo]).env.data as SpecRelationships;
  assert.equal(rel.found, true);
  assert.equal(rel.dependsOn.length, 2);
  const miss = json(["spec", "999-nope", "--root", demo]);
  assert.equal(miss.status, 0);
  assert.equal((miss.env.data as SpecRelationships).found, false);
});

test("CLI-9 / feature 009: timestamp-numbered specs are discovered and connected (real scan path)", () => {
  const wg = json(["graph", "--root", timestamp]).env.data as WorkspaceGraph;
  const proj = wg.projects[0];
  assert.equal(proj.nodes.length, 2, "both timestamp folders discovered as nodes");
  // number is null for timestamp folders (nodeScan derives only NNN-); identity is the folder name.
  assert.ok(
    proj.nodes.every((n) => /^\d{8}-\d{6}-/.test(n.id)),
    "node ids are the timestamp folder names",
  );
  // A definitive link + a strong slug-mention edge form despite the non-NNN scheme.
  assert.ok(
    proj.edges.some((e) => e.tier === "definitive"),
    "link edge across timestamp folders",
  );
  assert.ok(
    proj.edges.some((e) => e.heuristic === "slug-mention"),
    "slug-mention edge across timestamp folders",
  );
});

test("CLI-10 / feature 013: specs-for-file returns the reverse-lookup envelope (exact match)", () => {
  // render-demo/001-alpha references `src/core/graph/heuristics.ts` in its tasks.md.
  const { status, env } = json(["specs-for-file", "src/core/graph/heuristics.ts", "--root", demo]);
  assert.equal(status, 0);
  assert.equal(env.kind, "file");
  const d = env.data as SpecsForFile;
  assert.equal(d.path, "src/core/graph/heuristics.ts");
  assert.ok(
    d.matches.some((m) => m.specId === "001-alpha" && m.matchKind === "exact"),
    "001-alpha is an exact match",
  );
});

test("CLI-11 / feature 013: unreferenced file → exit 0 with empty matches; missing <path> → exit 2", () => {
  const none = json(["specs-for-file", "src/nope/missing.ts", "--root", demo]);
  assert.equal(none.status, 0);
  assert.deepEqual((none.env.data as SpecsForFile).matches, []);

  const usage = run(["specs-for-file", "--root", demo]); // no <path>
  assert.equal(usage.status, 2);
});

test("CLI-12 / feature 013: --format text renders the file lookup", () => {
  const out = run([
    "specs-for-file",
    "src/core/graph/heuristics.ts",
    "--root",
    demo,
    "--format",
    "text",
  ]);
  assert.match(out.stdout, /# specs for src\/core\/graph\/heuristics\.ts/);
  assert.match(out.stdout, /001-alpha/);
});

test("CLI-3: status + orphans envelopes", () => {
  const s = json(["status", "--root", demo]).env.data as StatusSummary;
  assert.equal(s.aggregate.specs, 3);
  const o = json(["orphans", "--root", demo]).env.data as Orphans;
  assert.deepEqual(o.orphans, []); // render-demo is fully connected
});

test("CLI-4: check exits 1 on orphans, 0 on a clean repo", () => {
  const bad = run(["check", "--rule", "no-orphans", "--root", malformed]);
  assert.equal(bad.status, 1);
  assert.ok((JSON.parse(bad.stdout).data as CheckResult).violations.length >= 1);
  const good = run(["check", "--rule", "no-orphans", "--root", demo]);
  assert.equal(good.status, 0);
});

test("CLI-5: --format text renders human output", () => {
  const out = run(["graph", "--root", demo, "--format", "text"]);
  assert.match(out.stdout, /# .*3 specs/);
});

test("CLI-6: deterministic — same command twice is byte-identical", () => {
  const a = run(["graph", "--root", demo]).stdout;
  const b = run(["graph", "--root", demo]).stdout;
  assert.equal(a, b);
});

test("CLI-7: no workspace writes during a query", () => {
  const before = snapshot(demo);
  run(["graph", "--root", demo]);
  run(["status", "--root", demo]);
  assert.deepEqual(snapshot(demo), before);
});

test("CLI-8: --project scopes to one project (multi-root), no cross edges", () => {
  const all = json(["graph", "--root", twoProjects]).env.data as WorkspaceGraph;
  assert.equal(all.projects.length, 2);
  const pid = all.projects[0].projectId;
  const one = json(["graph", "--root", twoProjects, "--project", pid]).env.data as ProjectGraph;
  assert.equal(one.projectId, pid); // a single ProjectGraph
  assert.equal(one.nodes.length, 1);
});

function snapshot(root: string): Record<string, number> {
  const out: Record<string, number> = {};
  const walk = (dir: string, prefix: string): void => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${e.name}` : e.name;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        walk(p, rel);
      } else {
        out[rel] = fs.statSync(p).size;
      }
    }
  };
  walk(root, "");
  return out;
}
