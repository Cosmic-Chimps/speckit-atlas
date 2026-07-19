import type { GraphOptions } from "../model/types.js";

/**
 * Default heuristic toggles — every tier is ON by default so a graph appears even when
 * specs cross-reference each other only by bare feature number:
 * - links: definitive, always on (cannot be disabled)
 * - slugMentions: strong, on
 * - sharedEntities: medium (code-pinned only), on
 * - bareNumbers: risky, on (may include coincidental matches — toggle off to hide)
 * - specToCode: optional spec→code layer, on
 */
export const DEFAULT_GRAPH_OPTIONS: GraphOptions = {
  links: true,
  slugMentions: true,
  sharedEntities: true,
  bareNumbers: true,
  specToCode: true,
};

/** Merge partial options over the defaults; `links` is forced on. */
export function resolveOptions(partial?: Partial<GraphOptions>): GraphOptions {
  return { ...DEFAULT_GRAPH_OPTIONS, ...(partial ?? {}), links: true };
}
