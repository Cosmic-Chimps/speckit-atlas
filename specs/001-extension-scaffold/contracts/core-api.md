# Contract: Pure Core Public API

The surface exported by `src/core/index.ts`. **No `vscode`, DOM, webview, or Node-only
globals** may appear in these signatures (Principle I). Everything is synchronous and
pure — the caller supplies already-probed input; the core performs no I/O.

## Types

```ts
export interface WorkspaceRoot {
  readonly id: string;
  readonly name: string;
  readonly entries: readonly string[]; // relative paths the adapter probed
}

export interface Warning {
  readonly code: string;
  readonly message: string;
  readonly rootId?: string;
}

export interface DetectionResult {
  readonly rootId: string;
  readonly name: string; // display name echoed from WorkspaceRoot
  readonly qualifies: boolean;
  readonly signals: readonly string[];
  readonly warnings: readonly Warning[];
}

export type MapViewState = "welcome" | "empty" | "ready";

export interface MapViewModel {
  readonly schemaVersion: 1;
  readonly state: MapViewState;
  readonly qualifyingRoots: readonly string[];
  readonly warnings: readonly Warning[];
  readonly graph: null;
}
```

## Functions

```ts
/** Classify a single root. Never throws; failures become warnings. */
export function detectRoot(root: WorkspaceRoot): DetectionResult;

/** Classify many roots. Never throws. */
export function detectRoots(roots: readonly WorkspaceRoot[]): DetectionResult[];

/** Build the webview envelope from detection results. Never throws;
 *  always returns a fully-populated MapViewModel (never undefined/partial). */
export function buildMapViewModel(results: readonly DetectionResult[]): MapViewModel;
```

## Behavioral contract (assertable in `test/core`, plain Node)

- **C-1**: `detectRoot` on a root whose `entries` include `.specify/` returns
  `qualifies: true` with `signals` containing `"has:.specify"`, and echoes the root's
  `name` onto the result.
- **C-2**: `detectRoot` on a root whose `entries` include a `specs/*/spec.md`-shaped
  path (and no `.specify/`) returns `qualifies: true` with the specs signal.
- **C-3**: `detectRoot` on a root with unrelated `entries` returns `qualifies: false`
  and empty `signals`.
- **C-4**: `detectRoot` on an empty `entries` array returns `qualifies: false` and a
  `"empty-workspace"` warning — it does not throw (Principle II).
- **C-5**: `buildMapViewModel` with zero qualifying roots returns
  `state: "welcome"`, `qualifyingRoots: []`, `graph: null`.
- **C-6**: `buildMapViewModel` with ≥1 qualifying root returns `state: "empty"`
  (scaffold has no graph yet), `graph: null`, and lists the qualifying root names
  (from each `DetectionResult.name`).
- **C-7**: Any warning produced during detection is carried through into
  `MapViewModel.warnings`.
- **C-8**: Every returned object is JSON-serializable (round-trips through
  `JSON.parse(JSON.stringify(x))` unchanged) so it can cross the `postMessage`
  boundary.
