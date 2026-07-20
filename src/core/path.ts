/**
 * Pure path helpers shared across the core. No imports from vscode/DOM/Node (Principle I).
 */

/**
 * Normalize a captured or queried path to workspace-root-relative form: backslashes → "/",
 * trimmed, and leading "./"/"../" segments stripped. Single source of truth shared by the
 * feature-011 code-reference extraction (`src/core/graph/heuristics.ts`) and the feature-013
 * reverse lookup (`src/core/query/queries.ts`), so both sides of a comparison normalize
 * identically — matching cannot silently break from divergent normalization (SC-004).
 */
export function normalizeWorkspacePath(raw: string): string {
  return (raw ?? "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^(?:\.\.?\/)+/, "");
}
