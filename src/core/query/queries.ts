import type { ProjectGraph, RelationEdge, SpecNode, WorkspaceGraph } from "../model/types.js";
import { sortEdges, sortNodes, sortProjectGraph, sortWorkspaceGraph } from "./envelope.js";
import type {
  CheckResult,
  Orphans,
  QueryScope,
  SpecRelationships,
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
