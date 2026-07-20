import type {
  ProjectGraph,
  RelationEdge,
  SpecNode,
  Warning,
  WorkspaceGraph,
} from "../model/types.js";
import { normalizeWorkspacePath } from "../path.js";
import {
  sortEdges,
  sortNodes,
  sortProjectGraph,
  sortWorkspaceGraph,
  toEnvelope,
} from "./envelope.js";
import type {
  CheckResult,
  Orphans,
  QueryResult,
  QueryScope,
  RelatedSpec,
  SpecRelationships,
  SpecsForFile,
  StatusSummary,
} from "./types.js";

/**
 * Pure query functions over a built WorkspaceGraph (feature 002). Total (never throw);
 * `scope.projectId` filters to one project and never crosses project boundaries. All
 * outputs are deterministically ordered.
 */

function scopedProjects(graph: WorkspaceGraph, scope?: QueryScope): ProjectGraph[] {
  const projects = graph?.projects ?? [];
  const id = scope?.projectId ?? null;
  return id ? projects.filter((p) => p.projectId === id) : [...projects];
}

/** kind "graph": one project (when scoped) or the whole workspace, deterministically ordered. */
export function getGraph(graph: WorkspaceGraph, scope?: QueryScope): WorkspaceGraph | ProjectGraph {
  const id = scope?.projectId ?? null;
  if (id) {
    const p = (graph?.projects ?? []).find((x) => x.projectId === id);
    return p
      ? sortProjectGraph(p)
      : { projectId: id, name: id, nodes: [], edges: [], warnings: [] };
  }
  return sortWorkspaceGraph(graph ?? { projects: [] });
}

/**
 * Feature 014 — build the versioned `kind:"graph"` envelope from an already-built WorkspaceGraph
 * (no scan): compose getGraph + toEnvelope, deriving warnings from the scoped result so they
 * describe exactly the data returned. Pure, total, deterministic — the JSON the "View Graph JSON"
 * command opens, and the same shape the CLI `graph` / MCP `atlas_graph` surfaces emit.
 */
export function graphEnvelope(graph: WorkspaceGraph, scope?: QueryScope): QueryResult {
  const data = getGraph(graph, scope);
  const warnings: readonly Warning[] =
    "projects" in data ? data.projects.flatMap((p) => [...p.warnings]) : data.warnings;
  return toEnvelope("graph", data, warnings);
}

export function specRelationships(
  graph: WorkspaceGraph,
  specId: string,
  scope?: QueryScope,
): SpecRelationships {
  const projects = scopedProjects(graph, scope);
  let spec: SpecNode | null = null;
  const dependsOn: RelationEdge[] = [];
  const dependedOnBy: RelationEdge[] = [];
  for (const p of projects) {
    const node = p.nodes.find((n) => n.id === specId);
    if (!node) {
      continue;
    }
    spec = node;
    for (const e of p.edges) {
      if (e.source === specId) {
        dependsOn.push(e);
      }
      if (e.target === specId) {
        dependedOnBy.push(e);
      }
    }
  }
  return {
    spec,
    found: spec !== null,
    dependsOn: sortEdges(dependsOn),
    dependedOnBy: sortEdges(dependedOnBy),
  };
}

/**
 * Feature 013 — reverse traceability: which spec(s) reference `path`. Inverts each
 * `SpecNode.codeReferences` (feature 011, artifact-derived; present only when `specToCode` is
 * on). Match rule: exact workspace-root-relative path first; if — and only if — there is no
 * exact match, fall back to specs referencing the file's containing folder. Pure, total,
 * deterministic. Never consults git/fs/network (data source = 011 references only).
 */
export function specsForFile(
  graph: WorkspaceGraph,
  path: string,
  scope?: QueryScope,
): SpecsForFile {
  const p = normalizeWorkspacePath(path);
  if (p === "") {
    return { path: "", matches: [] };
  }
  const dir = p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "";
  const folderPrefix = dir === "" ? null : dir + "/";

  const exact: RelatedSpec[] = [];
  const folder: RelatedSpec[] = [];
  for (const proj of scopedProjects(graph, scope)) {
    for (const n of proj.nodes) {
      const refs = n.codeReferences ?? [];
      if (refs.includes(p)) {
        exact.push(toRelated(n, "exact"));
      } else if (folderPrefix && refs.some((r) => r.startsWith(folderPrefix))) {
        folder.push(toRelated(n, "folder"));
      }
    }
  }
  // Folder matches are a fallback only when no exact match exists anywhere in scope (FR-003).
  const matches = (exact.length > 0 ? exact : folder).sort(compareRelated);
  return { path: p, matches };
}

function toRelated(n: SpecNode, matchKind: RelatedSpec["matchKind"]): RelatedSpec {
  return { specId: n.id, projectId: n.projectId, title: n.title, status: n.status, matchKind };
}

const MATCH_RANK: Record<RelatedSpec["matchKind"], number> = { exact: 0, folder: 1 };

function compareRelated(a: RelatedSpec, b: RelatedSpec): number {
  return (
    MATCH_RANK[a.matchKind] - MATCH_RANK[b.matchKind] ||
    a.projectId.localeCompare(b.projectId) ||
    a.specId.localeCompare(b.specId)
  );
}

export function statusSummary(graph: WorkspaceGraph, scope?: QueryScope): StatusSummary {
  const nodes = sortNodes(scopedProjects(graph, scope).flatMap((p) => p.nodes));
  const byStatus: Record<string, number> = {};
  let tasksDone = 0;
  let tasksTotal = 0;
  const perSpec = nodes.map((n) => {
    const key = n.status ?? "(none)";
    byStatus[key] = (byStatus[key] ?? 0) + 1;
    if (n.taskCompletion) {
      tasksDone += n.taskCompletion.done;
      tasksTotal += n.taskCompletion.total;
    }
    return {
      id: n.id,
      projectId: n.projectId,
      status: n.status,
      done: n.taskCompletion?.done ?? null,
      total: n.taskCompletion?.total ?? null,
    };
  });
  return { perSpec, aggregate: { specs: nodes.length, byStatus, tasksDone, tasksTotal } };
}

export function orphans(graph: WorkspaceGraph, scope?: QueryScope): Orphans {
  const ids: string[] = [];
  for (const p of scopedProjects(graph, scope)) {
    const incident = new Set<string>();
    for (const e of p.edges) {
      incident.add(e.source);
      incident.add(e.target);
    }
    for (const n of p.nodes) {
      if (!incident.has(n.id)) {
        ids.push(n.id);
      }
    }
  }
  return { orphans: [...ids].sort((a, b) => a.localeCompare(b)) };
}

/** Supported rules. Unknown rule → ok:true (fails open) — documented, non-throwing (Q-5). */
export function runCheck(graph: WorkspaceGraph, rule: string, scope?: QueryScope): CheckResult {
  if (rule === "no-orphans") {
    const violations = orphans(graph, scope).orphans;
    return { rule, ok: violations.length === 0, violations };
  }
  return { rule, ok: true, violations: [] };
}

export const KNOWN_CHECK_RULES = ["no-orphans"] as const;
