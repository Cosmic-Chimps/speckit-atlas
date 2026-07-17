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
 * evolve safely. In this scaffold `graph` is always null.
 */
export interface MapViewModel {
  readonly schemaVersion: 1;
  readonly state: MapViewState;
  readonly qualifyingRoots: readonly string[];
  readonly warnings: readonly Warning[];
  readonly graph: null;
}
