# Contract: Graph Model Core API

Added to `src/core/` (the pure domain core). **No `vscode`/DOM/Node imports.** All
functions are pure and total (never throw; bad input → warnings). Types are defined in
`data-model.md`.

## Functions

```ts
/** Parse ONE feature into node attributes + unresolved outbound references.
 *  Uses only the feature's provided file contents; never does I/O. Total. */
export function parseFeature(input: FeatureInput): FeatureFacts;

/** Assemble one project's graph from its parsed features, applying heuristic
 *  toggles/weights. Edges never cross the project. Total. */
export function buildProjectGraph(
  projectId: string,
  name: string,
  facts: readonly FeatureFacts[],
  options?: Partial<GraphOptions>,
): ProjectGraph;

/** Convenience: parse + assemble each project independently; returns the envelope
 *  payload (one sub-graph per project). Total. */
export function buildWorkspaceGraph(
  snapshots: readonly ProjectSnapshot[],
  options?: Partial<GraphOptions>,
): WorkspaceGraph;

/** Default options: links on (locked), slugMentions on, sharedEntities on,
 *  bareNumbers off, specToCode off. */
export const DEFAULT_GRAPH_OPTIONS: GraphOptions;
```

`buildMapViewModel` (from feature 001) is extended to accept an optional
`WorkspaceGraph` and place it on `MapViewModel.graph` (was always `null`).

## Behavioral contract (assertable in `test/core`, plain Node)

**Nodes**

- **G-1**: `parseFeature` returns one `FeatureFacts` with `title` from the H1, or the
  slug when no H1 is present.
- **G-2**: `completeness` reflects exactly the `artifacts` list; it is computed without
  reading any file content.
- **G-3**: `status` is the trimmed `**Status**:` value and survives trailing whitespace
  and parenthetical notes (`Implemented (authored retroactively)`); absent → `null`.
- **G-4**: `taskCompletion` = checked ÷ total checkboxes; no task list → `null`.

**Edges & scoping**

- **G-5**: A relative link from feature A's files into feature B's folder yields a
  `definitive` edge A→B with the link as evidence.
- **G-6**: A's text mentioning B's full slug yields a `strong` edge A→B whose `weight`
  equals the mention count.
- **G-7**: Two features referencing the same **code-pinned** entity yield a `medium`
  edge when `sharedEntities` is on; a shared bare name (no code pin) does **not**.
- **G-8**: A bare feature number yields an edge **only** when `bareNumbers` is enabled,
  always `tier: "risky"`; with defaults, zero such edges.
- **G-9**: Disabling a heuristic removes every edge supported only by it; edges
  supported solely by other heuristics stay byte-identical. (A pair supported by
  multiple heuristics re-tiers to the strongest remaining one rather than disappearing —
  see the collapse rule in `heuristics.md`.)
- **G-10**: No edge connects features in different projects, even when slugs/numbers/
  entity names coincide across projects.
- **G-11**: Self-references produce no edge; multiple signals for the same (source,
  target) collapse to one edge (strongest tier, merged `evidence`).
- **G-12**: An ambiguous/unresolvable reference produces a `Warning`, not an edge.

**Totality & serialization**

- **G-13**: Malformed/empty/oversized/odd input never throws; it yields a partial
  result plus `warnings`, and never an empty graph when valid features exist.
- **G-14**: Every returned object is JSON-serializable (round-trips unchanged) for the
  `postMessage` boundary and for CLI/MCP reuse later.
