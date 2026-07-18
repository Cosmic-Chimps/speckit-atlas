import type { NodePosition, Viewport } from "../webview/protocol.js";

/**
 * Pure model + resilient (de)serialization for the persisted map layout (feature 006).
 * No `vscode`/DOM imports, so it unit-tests in plain Node. The host's `layoutStore.ts`
 * wraps this over `context.workspaceState`; positions are never written to workspace files.
 *
 * See specs/006-persist-map-layout/data-model.md and contracts/layout-persistence.md.
 */

/** `workspaceState` key holding the whole persisted document. */
export const MAP_LAYOUT_KEY = "speckitAtlas.mapLayout";
/** Schema version — an unknown/absent version is treated as empty (resilience, FR-009). */
export const LAYOUT_SCHEMA_VERSION = 1;
/** Bucket used when the map shows all projects (activeProjectId === null). */
export const ALL_PROJECTS_BUCKET = "__all__";

export interface ProjectLayout {
  positions: Record<string, NodePosition>;
  viewport: Viewport | null;
}
export interface SavedMapLayout {
  version: number;
  projects: Record<string, ProjectLayout>;
}

export function emptyLayout(): SavedMapLayout {
  return { version: LAYOUT_SCHEMA_VERSION, projects: {} };
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}
function asPosition(v: unknown): NodePosition | null {
  if (!isRecord(v) || !isFiniteNumber(v.x) || !isFiniteNumber(v.y)) {
    return null;
  }
  return { x: v.x, y: v.y };
}
function asViewport(v: unknown): Viewport | null {
  if (!isRecord(v) || !isRecord(v.pan) || !isFiniteNumber(v.zoom) || v.zoom <= 0) {
    return null;
  }
  const pan = v.pan;
  if (!isFiniteNumber(pan.x) || !isFiniteNumber(pan.y)) {
    return null;
  }
  return { pan: { x: pan.x, y: pan.y }, zoom: v.zoom };
}

/**
 * Parse whatever is in storage into a valid SavedMapLayout. Any corruption, wrong
 * version, or type mismatch degrades to an empty layout — never throws (FR-009).
 */
export function parseStored(raw: unknown): SavedMapLayout {
  if (!isRecord(raw) || raw.version !== LAYOUT_SCHEMA_VERSION || !isRecord(raw.projects)) {
    return emptyLayout();
  }
  const projects: Record<string, ProjectLayout> = {};
  for (const [projectId, layout] of Object.entries(raw.projects)) {
    if (!isRecord(layout) || !isRecord(layout.positions)) {
      continue;
    }
    const positions: Record<string, NodePosition> = {};
    for (const [nodeId, pos] of Object.entries(layout.positions)) {
      const p = asPosition(pos);
      if (p) {
        positions[nodeId] = p;
      }
    }
    const viewport = asViewport(layout.viewport);
    if (Object.keys(positions).length > 0 || viewport) {
      projects[projectId] = { positions, viewport };
    }
  }
  return { version: LAYOUT_SCHEMA_VERSION, projects };
}

export function positionsForProject(
  store: SavedMapLayout,
  projectId: string,
): Record<string, NodePosition> | null {
  const p = store.projects[projectId]?.positions;
  return p && Object.keys(p).length > 0 ? p : null;
}

export function viewportForProject(store: SavedMapLayout, projectId: string): Viewport | null {
  return store.projects[projectId]?.viewport ?? null;
}

/**
 * Merge a reported arrangement into the store for one project bucket. Only nodes that
 * currently exist are kept (stale ids pruned, FR-007); non-finite positions are dropped;
 * empty buckets are removed. Returns a new store (pure).
 */
export function mergeReport(
  store: SavedMapLayout,
  projectId: string,
  positions: Record<string, NodePosition>,
  viewport: Viewport | null,
  currentNodeIds: Iterable<string>,
): SavedMapLayout {
  const keep = new Set(currentNodeIds);
  const merged: Record<string, NodePosition> = {};
  for (const [nodeId, pos] of Object.entries(positions)) {
    const p = asPosition(pos);
    if (p && keep.has(nodeId)) {
      merged[nodeId] = p;
    }
  }
  const cleanViewport = asViewport(viewport);
  const projects = { ...store.projects };
  if (Object.keys(merged).length === 0 && !cleanViewport) {
    delete projects[projectId];
  } else {
    projects[projectId] = { positions: merged, viewport: cleanViewport };
  }
  return { version: LAYOUT_SCHEMA_VERSION, projects };
}

/** Remove one project bucket (Reset layout). Returns a new store (pure). */
export function clearProject(store: SavedMapLayout, projectId: string): SavedMapLayout {
  if (!(projectId in store.projects)) {
    return store;
  }
  const projects = { ...store.projects };
  delete projects[projectId];
  return { version: LAYOUT_SCHEMA_VERSION, projects };
}

/** True when a saved arrangement exists for the bucket (drives the Reset button). */
export function resetEnabled(store: SavedMapLayout, projectId: string): boolean {
  return positionsForProject(store, projectId) !== null;
}
