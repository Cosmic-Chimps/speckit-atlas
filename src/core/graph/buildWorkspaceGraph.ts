import type { GraphOptions, ProjectSnapshot, WorkspaceGraph } from "../model/types.js";
import { parseFeature } from "./parseFeature.js";
import { buildProjectGraph } from "./buildProjectGraph.js";

/**
 * Parse + assemble each project independently and return the envelope payload
 * (one sub-graph per project). Pure and total: never throws. Per-project scoping is
 * intrinsic — each ProjectSnapshot becomes its own ProjectGraph, so no edge can cross
 * a project boundary.
 */
export function buildWorkspaceGraph(
  snapshots: readonly ProjectSnapshot[],
  options?: Partial<GraphOptions>,
): WorkspaceGraph {
  const list = Array.isArray(snapshots) ? snapshots : [];
  const projects = list
    .filter((s): s is ProjectSnapshot => !!s)
    .map((s) => {
      const facts = (s.features ?? []).map((f) => parseFeature(f));
      return buildProjectGraph(s.projectId, s.name, facts, options);
    });
  return { projects };
}
