import type {
  ProjectGraph,
  RelationEdge,
  SpecNode,
  WorkspaceGraph,
  Warning,
} from "../model/types.js";
import type { QueryKind, QueryResult } from "./types.js";

/**
 * Deterministic ordering helpers + the result envelope. Sorting makes output byte-identical
 * for identical inputs (FR-011 / SC-005) so it can be diffed and asserted in CI.
 */

export function sortNodes(nodes: readonly SpecNode[]): SpecNode[] {
  return [...nodes].sort((a, b) => a.id.localeCompare(b.id));
}

export function sortEdges(edges: readonly RelationEdge[]): RelationEdge[] {
  return [...edges].sort(
    (a, b) =>
      a.source.localeCompare(b.source) ||
      a.target.localeCompare(b.target) ||
      a.heuristic.localeCompare(b.heuristic),
  );
}

/** Return a project graph with nodes/edges in deterministic order. */
export function sortProjectGraph(p: ProjectGraph): ProjectGraph {
  return { ...p, nodes: sortNodes(p.nodes), edges: sortEdges(p.edges) };
}

/** Return a workspace graph with projects (and their nodes/edges) in deterministic order. */
export function sortWorkspaceGraph(g: WorkspaceGraph): WorkspaceGraph {
  const projects = [...g.projects]
    .map(sortProjectGraph)
    .sort((a, b) => a.projectId.localeCompare(b.projectId));
  return { projects };
}

/** Build the versioned envelope. No timestamps / run metadata → deterministic. */
export function toEnvelope(
  kind: QueryKind,
  data: QueryResult["data"],
  warnings: readonly Warning[],
): QueryResult {
  return { schemaVersion: 1, kind, data, warnings: [...warnings] };
}
