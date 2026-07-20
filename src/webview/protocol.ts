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
  | { readonly type: "relayout" }
  // feature 010 — scope the map to the selected spec's one-hop neighborhood (on/off).
  | { readonly type: "focusMode"; readonly enabled: boolean };

export type PanelToHost =
  | { readonly type: "ready" }
  | {
      readonly type: "rendered";
      readonly nodeCount: number;
      readonly edgeCount: number;
      readonly ok: boolean;
    }
  | { readonly type: "openSpec"; readonly nodeId: string; readonly projectId: string }
  // feature 011 — open a source file listed in the detail panel, read-only, resolved under the project root.
  | { readonly type: "openFile"; readonly path: string; readonly projectId: string }
  // feature 012 — open one listed file's before/after diff in the editor's own diff view.
  | {
      readonly type: "openFileDiff";
      readonly path: string;
      readonly projectId: string;
      readonly nodeId: string;
    }
  // feature 012 — open the spec's full attributed changeset in the native multi-file diff editor.
  | { readonly type: "showChangeset"; readonly nodeId: string; readonly projectId: string }
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

export type HostToControls =
  | {
      readonly type: "state";
      readonly options: GraphOptions;
      readonly projects: readonly ProjectRef[];
      readonly specs: readonly SpecRef[];
      readonly activeProjectId: string | null;
      // feature 006 — whether a saved arrangement exists for the active view (drives "Reset layout").
      readonly resetEnabled?: boolean;
    }
  // feature 010 — the host echoes the current selection so the SPECS list can highlight it
  // (from either a list click or a map-node click) and show how many specs relate to it.
  | {
      readonly type: "selection";
      readonly nodeId: string | null;
      readonly relatedCount: number;
    }
  // feature 013 — the host echoes focus-mode state so the sidebar toggle stays in sync when
  // focus mode is changed programmatically (e.g. the "Reveal + focus on map" command action).
  | {
      readonly type: "focusMode";
      readonly enabled: boolean;
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
  | { readonly type: "resetLayout" }
  // feature 010 — toggle focus-on-selection (scope the map to the selection's neighborhood).
  | { readonly type: "setFocusMode"; readonly enabled: boolean };
