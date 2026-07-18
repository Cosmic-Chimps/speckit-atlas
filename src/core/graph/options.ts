import type { GraphOptions } from "../model/types.js";

/**
 * Default heuristic toggles (calibrated from the aerosens spike):
 * - links: definitive, always on (cannot be disabled)
 * - slugMentions: strong, on
 * - sharedEntities: medium (code-pinned only), on
 * - bareNumbers: risky, OFF (empirically mostly false positives)
 * - specToCode: optional layer, OFF
 */
export const DEFAULT_GRAPH_OPTIONS: GraphOptions = {
  links: true,
  slugMentions: true,
  sharedEntities: true,
  bareNumbers: false,
  specToCode: false,
};

/** Merge partial options over the defaults; `links` is forced on. */
export function resolveOptions(partial?: Partial<GraphOptions>): GraphOptions {
  return { ...DEFAULT_GRAPH_OPTIONS, ...(partial ?? {}), links: true };
}
