/**
 * Feature 010 — pure neighborhood computation for focus mode.
 *
 * No `vscode`/DOM/Cytoscape imports (Principle I): the map webview builds an undirected
 * adjacency from the current edges and asks this module which nodes should stay visible
 * when focus mode is on. The webview then shows those nodes plus the edges induced among
 * them and hides everything else.
 */

/** An undirected neighbor map: node id → the ids it shares an edge with (either direction). */
export type Adjacency = ReadonlyMap<string, ReadonlySet<string>>;

/** Minimal edge shape needed to build adjacency (source/target node ids). */
export interface EdgeEndpoints {
  readonly source: string;
  readonly target: string;
}

/** The focus decision: which nodes are visible, or `showAll` to restore the full graph. */
export interface FocusVisible {
  /** Ids of the nodes to keep visible (the closed one-hop neighborhood). Empty when showAll. */
  readonly nodes: ReadonlySet<string>;
  /** When true the caller shows the entire graph (no selection, or selection absent). */
  readonly showAll: boolean;
}

/**
 * Build an undirected adjacency map from edge endpoints. Direction is ignored for
 * neighborhood membership (spec assumption): each edge contributes both directions.
 */
export function buildAdjacency(edges: Iterable<EdgeEndpoints>): Adjacency {
  const adj = new Map<string, Set<string>>();
  const link = (a: string, b: string): void => {
    let set = adj.get(a);
    if (!set) {
      set = new Set<string>();
      adj.set(a, set);
    }
    set.add(b);
  };
  for (const e of edges) {
    link(e.source, e.target);
    link(e.target, e.source);
  }
  return adj;
}

/**
 * Decide the visible node set for focus mode.
 *
 * - `selectedId` null or not present in `adjacency` → `showAll: true` (graceful; never
 *   throws — Principle II). "Not present" includes an isolated node with no edges, which
 *   would not appear as an adjacency key; callers pass the full node-id set via
 *   `knownNodeIds` so an isolated but real selection still focuses on just itself.
 * - Otherwise → the closed one-hop neighborhood: the selected id plus its direct neighbors.
 *   The caller adds the induced edges (edges between two visible nodes) so neighbor↔neighbor
 *   relationships are shown, not just spokes to the selected node.
 */
export function computeFocusVisible(
  adjacency: Adjacency,
  selectedId: string | null,
  knownNodeIds?: ReadonlySet<string>,
): FocusVisible {
  if (selectedId === null) {
    return { nodes: new Set(), showAll: true };
  }
  const isKnown = knownNodeIds ? knownNodeIds.has(selectedId) : adjacency.has(selectedId);
  if (!isKnown) {
    return { nodes: new Set(), showAll: true };
  }
  const visible = new Set<string>([selectedId]);
  for (const neighbor of adjacency.get(selectedId) ?? []) {
    visible.add(neighbor);
  }
  return { nodes: visible, showAll: false };
}
