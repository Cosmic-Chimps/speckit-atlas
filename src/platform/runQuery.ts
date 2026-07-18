import {
  buildWorkspaceGraph,
  getGraph,
  orphans,
  runCheck,
  specRelationships,
  statusSummary,
  toEnvelope,
  type GraphOptions,
  type QueryKind,
  type QueryResult,
  type Warning,
} from "../core/index.js";
import { scanRoot } from "./nodeScan.js";

/** Everything a surface (CLI or MCP) needs to answer one query. */
export interface RunQueryInput {
  readonly root: string;
  readonly kind: QueryKind;
  readonly specId?: string;
  readonly rule?: string;
  readonly projectId?: string | null;
  readonly options?: Partial<GraphOptions>;
}

/**
 * Shared adapter path used by BOTH the CLI and the MCP server, so the two surfaces return
 * identical envelopes (CLI/MCP equivalence). Read-only: scans via node:fs, builds via the
 * pure core, queries, and wraps in the versioned envelope. Never throws.
 */
export function runQuery(input: RunQueryInput): QueryResult {
  const snapshots = scanRoot(input.root);
  const graph = buildWorkspaceGraph(snapshots, input.options);
  const scope = { projectId: input.projectId ?? null };
  const warnings: Warning[] = graph.projects.flatMap((p) => [...p.warnings]);

  switch (input.kind) {
    case "graph":
      return toEnvelope("graph", getGraph(graph, scope), warnings);
    case "spec":
      return toEnvelope("spec", specRelationships(graph, input.specId ?? "", scope), warnings);
    case "status":
      return toEnvelope("status", statusSummary(graph, scope), warnings);
    case "orphans":
      return toEnvelope("orphans", orphans(graph, scope), warnings);
    case "check":
      return toEnvelope("check", runCheck(graph, input.rule ?? "no-orphans", scope), warnings);
    default:
      return toEnvelope("graph", getGraph(graph, scope), warnings);
  }
}
