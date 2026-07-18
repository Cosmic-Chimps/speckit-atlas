import type { NodePosition } from "../protocol.js";

/**
 * Pure decision helpers for seeding the map from a saved layout (feature 006). No
 * `cytoscape`/DOM imports, so this unit-tests in plain Node. The renderer (map/main.ts)
 * turns these decisions into Cytoscape `preset`/`cose` calls.
 *
 * See specs/006-persist-map-layout/research.md (D3) and contracts/layout-persistence.md.
 */

export type SeedMode = "preset" | "partial" | "none";

export interface SeedPlan {
  /** `preset`: all nodes have a saved position; `partial`: some new; `none`: nothing to seed. */
  readonly mode: SeedMode;
  /** Node ids that have a saved position (to place directly). */
  readonly knownIds: string[];
  /** Node ids with no saved position (to lay out without moving the known ones). */
  readonly newIds: string[];
}

/**
 * Classify how to seed the current node set from `savedPositions`.
 * - every current node saved → "preset"
 * - some saved, some new → "partial"
 * - none saved (or no saved data) → "none"
 */
export function classifySeed(
  savedPositions: Record<string, NodePosition> | null | undefined,
  currentNodeIds: Iterable<string>,
): SeedPlan {
  const ids = [...currentNodeIds];
  const saved = savedPositions ?? {};
  const knownIds: string[] = [];
  const newIds: string[] = [];
  for (const id of ids) {
    if (Object.prototype.hasOwnProperty.call(saved, id)) {
      knownIds.push(id);
    } else {
      newIds.push(id);
    }
  }
  let mode: SeedMode;
  if (knownIds.length === 0) {
    mode = "none";
  } else if (newIds.length === 0) {
    mode = "preset";
  } else {
    mode = "partial";
  }
  return { mode, knownIds, newIds };
}

/**
 * Average of the given positions (neighbour placement for a new node). Returns null when
 * there are no positions to average — the caller then falls back to a graph-level default.
 */
export function centroidFor(positions: readonly NodePosition[]): NodePosition | null {
  if (positions.length === 0) {
    return null;
  }
  let x = 0;
  let y = 0;
  for (const p of positions) {
    x += p.x;
    y += p.y;
  }
  return { x: x / positions.length, y: y / positions.length };
}
