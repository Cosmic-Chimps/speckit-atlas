/**
 * Core model types. These are plain, JSON-serializable shapes with NO imports from
 * the vscode API, the DOM, or Node-only globals (Principle I). Everything the core
 * needs is passed in; the core performs no I/O.
 */

/** A single opened folder, already probed by an adapter, handed to the core. */
export interface WorkspaceRoot {
  /** Stable identifier for the root (adapter supplies e.g. the folder URI string). */
  readonly id: string;
  /** Display name of the root. */
  readonly name: string;
  /** Relative paths the adapter probed (e.g. ".specify", "specs/001-x/spec.md"). */
  readonly entries: readonly string[];
}

/** A non-fatal degradation notice (Principle II — resilient parsing). */
export interface Warning {
  /** Stable machine code, e.g. "empty-workspace" or "probe-error". */
  readonly code: string;
  /** Human-readable message, safe to show in the welcome state. */
  readonly message: string;
  /** The root this warning pertains to, if any. */
  readonly rootId?: string;
  /** The feature this warning pertains to, if any. */
  readonly featureId?: string;
}

/** The core's verdict for one workspace root. */
export interface DetectionResult {
  readonly rootId: string;
  /** Display name of the root, echoed from WorkspaceRoot for user-facing surfaces. */
  readonly name: string;
  readonly qualifies: boolean;
  /** Which signals fired, for transparency/debuggability. */
  readonly signals: readonly string[];
  readonly warnings: readonly Warning[];
}

export type MapViewState = "welcome" | "empty" | "ready";

/**
 * The serialized envelope posted to the webview. Versioned so the renderer can
 * evolve safely. `graph` carries the workspace graph once built (feature 002); it is
 * `null` until a graph is available (e.g. the scaffold/welcome state).
 */
export interface MapViewModel {
  readonly schemaVersion: 1;
  readonly state: MapViewState;
  readonly qualifyingRoots: readonly string[];
  readonly warnings: readonly Warning[];
  readonly graph: WorkspaceGraph | null;
}

// ── Spec-relationship graph model (feature 002) ─────────────────────────────
// All shapes are plain and JSON-serializable; the core performs no I/O.

/** Which standard artifacts a feature folder contains (derived from the tree only). */
export interface ArtifactPresence {
  readonly spec: boolean;
  readonly plan: boolean;
  readonly tasks: boolean;
  readonly research: boolean;
  readonly dataModel: boolean;
  readonly quickstart: boolean;
  readonly contracts: boolean;
  readonly checklists: boolean;
}

/** One feature folder as gathered by the adapter's two-layer scan. Input to the core. */
export interface FeatureInput {
  /** Feature slug (folder name), unique within a project, e.g. "001-foo". */
  readonly id: string;
  /** Leading NNN if numbered, else null. */
  readonly number: string | null;
  /** Which standard artifacts exist — from the tree only, no contents read. */
  readonly artifacts: readonly string[];
  /** Contents of the files the adapter chose to read (e.g. "spec.md"). May be partial. */
  readonly files: Readonly<Record<string, string>>;
}

/** A Spec Kit project (one `.specify` root) and its features. Input to the core. */
export interface ProjectSnapshot {
  readonly projectId: string;
  readonly name: string;
  readonly features: readonly FeatureInput[];
}

/** Which heuristic family produced a raw, unresolved reference. */
export type ReferenceKind = "link" | "slug" | "entity" | "number" | "code";

/** A raw outbound signal extracted from one feature's content (unresolved). */
export interface Reference {
  readonly kind: ReferenceKind;
  /** Slug / feature-number / entity-key / code path as found. */
  readonly targetHint: string;
  readonly evidence: string;
  /** Occurrences (drives strong-edge weight). */
  readonly count: number;
}

/** Pure per-feature parse result; cached by the adapter for incremental rebuilds. */
export interface FeatureFacts {
  readonly id: string;
  readonly number: string | null;
  readonly title: string;
  readonly status: string | null;
  readonly taskCompletion: { readonly done: number; readonly total: number } | null;
  readonly completeness: ArtifactPresence;
  readonly references: readonly Reference[];
  readonly warnings: readonly Warning[];
  /**
   * Feature 009: the feature's concatenated scannable text, used by buildProjectGraph for
   * sibling-aware slug-mention matching (folder names of any numbering scheme). Transient —
   * recomputed each build from the feature's files, never persisted.
   */
  readonly mentionText: string;
}

/** A node in the graph — one specification/feature. */
export interface SpecNode {
  readonly id: string;
  readonly projectId: string;
  readonly title: string;
  readonly status: string | null;
  readonly taskCompletion: { readonly done: number; readonly total: number } | null;
  readonly completeness: ArtifactPresence;
  /** Source files/code types this spec references — present only when specToCode is on. */
  readonly codeReferences?: readonly string[];
  readonly warnings: readonly Warning[];
}

export type EdgeTier = "definitive" | "strong" | "medium" | "risky";

/** A directed relationship between two SpecNodes in the same project. */
export interface RelationEdge {
  readonly source: string;
  readonly target: string;
  readonly heuristic: string;
  readonly tier: EdgeTier;
  readonly weight: number;
  readonly evidence: readonly string[];
  /** True when the relationship is inherently undirected (e.g. shared entity). */
  readonly symmetric?: boolean;
}

/** One project's sub-graph. Edges never cross `projectId`. */
export interface ProjectGraph {
  readonly projectId: string;
  readonly name: string;
  readonly nodes: readonly SpecNode[];
  readonly edges: readonly RelationEdge[];
  readonly warnings: readonly Warning[];
}

/** The envelope payload: one independent sub-graph per project. */
export interface WorkspaceGraph {
  readonly projects: readonly ProjectGraph[];
}

/** Per-heuristic toggles. `links` is always on and cannot be disabled. */
export interface GraphOptions {
  readonly links: true;
  readonly slugMentions: boolean;
  readonly sharedEntities: boolean;
  readonly bareNumbers: boolean;
  readonly specToCode: boolean;
}
