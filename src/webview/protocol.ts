import type { EdgeTier, GraphOptions, WorkspaceGraph } from "../core/index.js";

/**
 * postMessage contracts between the extension host and the webviews.
 * Pure types only — shared by both sides. See specs/003-graph-rendering/data-model.md.
 */

// ── Shared layout primitives (feature 006) ───────────────────────────────────
/** A single node's saved 2-D placement. */
export interface NodePosition {
  readonly x: number;
  readonly y: number;
}
/** Saved pan/zoom for a map view. */
export interface Viewport {
  readonly pan: { readonly x: number; readonly y: number };
  readonly zoom: number;
}

// ── Map panel (feature 003; layout persistence in 006) ────────────────────────
export type HostToPanel =
  | {
      readonly type: "render";
      readonly graph: WorkspaceGraph;
      readonly options: GraphOptions;
      readonly activeProjectId: string | null;
      // feature 006 — omitted/null ⇒ feature-003 behavior (fresh `cose`).
      readonly savedPositions?: Record<string, NodePosition> | null;
      readonly savedViewport?: Viewport | null;
    }
  | { readonly type: "focus"; readonly nodeId: string }
  | {
      readonly type: "filter";
      readonly filterTier: readonly EdgeTier[] | null;
      readonly filterStatus: readonly string[] | null;
    }
  // feature 006 — discard seeded positions and run a fresh layout.
  | { readonly type: "relayout" };

export type PanelToHost =
  | { readonly type: "ready" }
  | {
      readonly type: "rendered";
      readonly nodeCount: number;
      readonly edgeCount: number;
      readonly ok: boolean;
    }
  | { readonly type: "openSpec"; readonly nodeId: string; readonly projectId: string }
  | { readonly type: "selectNode"; readonly nodeId: string | null }
  // feature 006 — the webview reports its settled/dragged arrangement for persistence.
  | {
      readonly type: "persistLayout";
      readonly projectId: string;
      readonly positions: Record<string, NodePosition>;
      readonly viewport: Viewport;
    };

// ── Controls sidebar (feature 003) ───────────────────────────────────────────
export interface ProjectRef {
  readonly id: string;
  readonly name: string;
}
export interface SpecRef {
  readonly id: string;
  readonly projectId: string;
  readonly title: string;
  readonly status: string | null;
}

export type HostToControls = {
  readonly type: "state";
  readonly options: GraphOptions;
  readonly projects: readonly ProjectRef[];
  readonly specs: readonly SpecRef[];
  readonly activeProjectId: string | null;
  // feature 006 — whether a saved arrangement exists for the active view (drives "Reset layout").
  readonly resetEnabled?: boolean;
};

export type ControlsToHost =
  | { readonly type: "ready" }
  | { readonly type: "setOption"; readonly key: keyof GraphOptions; readonly value: boolean }
  | { readonly type: "selectProject"; readonly projectId: string | null }
  | { readonly type: "focusSpec"; readonly nodeId: string }
  | {
      readonly type: "setFilter";
      readonly filterTier: readonly EdgeTier[] | null;
      readonly filterStatus: readonly string[] | null;
    }
  // feature 006 — clear the active view's saved layout and re-run the automatic layout.
  | { readonly type: "resetLayout" };
