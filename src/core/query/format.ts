import type { ProjectGraph, WorkspaceGraph } from "../model/types.js";
import type {
  CheckResult,
  Orphans,
  QueryResult,
  SpecRelationships,
  SpecsForFile,
  StatusSummary,
} from "./types.js";

/**
 * Pure human-readable rendering of a QueryResult (CLI `--format text`). No I/O; JSON remains
 * the canonical contract. Deterministic (operates on already-sorted data).
 */
export function formatText(result: QueryResult): string {
  const lines: string[] = [];
  switch (result.kind) {
    case "graph": {
      const projects = isWorkspace(result.data)
        ? result.data.projects
        : [result.data as ProjectGraph];
      for (const p of projects) {
        lines.push(`# ${p.name} (${p.nodes.length} specs, ${p.edges.length} edges)`);
        for (const n of p.nodes) {
          lines.push(`  ${n.id}  [${n.status ?? "—"}]`);
        }
        for (const e of p.edges) {
          const arrow = e.symmetric ? "—" : "→";
          lines.push(
            `  ${e.source} ${arrow} ${e.target}  (${e.heuristic}, ${e.tier}, w${e.weight})`,
          );
        }
      }
      break;
    }
    case "spec": {
      const d = result.data as SpecRelationships;
      if (!d.found) {
        lines.push("spec not found");
        break;
      }
      lines.push(`# ${d.spec?.id}  [${d.spec?.status ?? "—"}]`);
      lines.push(`depends on (${d.dependsOn.length}):`);
      for (const e of d.dependsOn) {
        lines.push(`  → ${e.target}  (${e.heuristic}, ${e.tier})`);
      }
      lines.push(`depended on by (${d.dependedOnBy.length}):`);
      for (const e of d.dependedOnBy) {
        lines.push(`  ← ${e.source}  (${e.heuristic}, ${e.tier})`);
      }
      break;
    }
    case "status": {
      const d = result.data as StatusSummary;
      lines.push(
        `# ${d.aggregate.specs} specs — tasks ${d.aggregate.tasksDone}/${d.aggregate.tasksTotal}`,
      );
      for (const [status, count] of Object.entries(d.aggregate.byStatus)) {
        lines.push(`  ${status}: ${count}`);
      }
      for (const r of d.perSpec) {
        const tasks = r.total ? `${r.done}/${r.total}` : "—";
        lines.push(`  ${r.id}  [${r.status ?? "—"}]  ${tasks}`);
      }
      break;
    }
    case "orphans": {
      const d = result.data as Orphans;
      lines.push(`# ${d.orphans.length} orphaned spec(s)`);
      for (const id of d.orphans) {
        lines.push(`  ${id}`);
      }
      break;
    }
    case "file": {
      const d = result.data as SpecsForFile;
      const kindLabel = d.matches.length === 0 ? "" : ` ${d.matches[0].matchKind}`;
      lines.push(`# specs for ${d.path} (${d.matches.length}${kindLabel})`);
      for (const m of d.matches) {
        lines.push(`  ${m.specId}  [${m.status ?? "—"}]  (${m.matchKind})`);
      }
      break;
    }
    case "check": {
      const d = result.data as CheckResult;
      lines.push(`check "${d.rule}": ${d.ok ? "PASS" : "FAIL"}`);
      for (const v of d.violations) {
        lines.push(`  violation: ${v}`);
      }
      break;
    }
  }
  for (const w of result.warnings) {
    lines.push(`! warning [${w.code}]${w.featureId ? ` (${w.featureId})` : ""}: ${w.message}`);
  }
  return lines.join("\n");
}

function isWorkspace(data: unknown): data is WorkspaceGraph {
  return (
    typeof data === "object" && data !== null && Array.isArray((data as WorkspaceGraph).projects)
  );
}
