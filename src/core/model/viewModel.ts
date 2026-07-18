import type { DetectionResult, MapViewModel, Warning, WorkspaceGraph } from "./types.js";

/**
 * Build the webview envelope from detection results and an optional workspace graph.
 * Pure and total: it always returns a fully-populated MapViewModel and never throws
 * (FR-011). `graph` is `null` until a graph is supplied (feature 002); the renderer
 * (feature 003) will consume it. State stays welcome/empty here — the graph does not
 * change the scaffold's welcome/empty presentation.
 */
export function buildMapViewModel(
  results: readonly DetectionResult[],
  graph?: WorkspaceGraph | null,
): MapViewModel {
  const list = Array.isArray(results) ? results : [];

  const qualifying = list.filter((r) => r?.qualifies === true);
  const qualifyingRoots = qualifying
    .map((r) => r.name)
    .filter((name): name is string => typeof name === "string" && name.length > 0);

  const warnings: Warning[] = list.flatMap((r) =>
    Array.isArray(r?.warnings) ? [...r.warnings] : [],
  );

  return {
    schemaVersion: 1,
    state: qualifying.length > 0 ? "empty" : "welcome",
    qualifyingRoots,
    warnings,
    graph: graph ?? null,
  };
}
