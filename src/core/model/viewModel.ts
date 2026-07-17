import type { DetectionResult, MapViewModel, Warning } from "./types.js";

/**
 * Build the webview envelope from detection results. Pure and total: it always
 * returns a fully-populated MapViewModel and never throws (FR-011). `graph` is
 * always null in this scaffold — the field name is locked in the contract now to
 * avoid a breaking rename when the graph feature lands.
 */
export function buildMapViewModel(results: readonly DetectionResult[]): MapViewModel {
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
    graph: null,
  };
}
