# Phase 0 Research: Spec-Relationship Graph Model

The feature is design-heavy but technology-light (a pure parsing/model core). All
decisions below were calibrated against the real 27-feature aerosens corpus (the spike
recorded in the spec's Assumptions). No NEEDS CLARIFICATION items remain.

## Decision 1: Purity via per-feature parse + pure assemble (ports & adapters)

- **Decision**: The core exposes two pure functions:
  `parseFeature(input) → FeatureFacts` (per feature: node attributes + extracted
  references) and `buildProjectGraph(facts[], options) → ProjectGraph` (assembles
  nodes+edges within one project, applies heuristic toggles/weights). The adapter
  (extension/CLI/MCP) does all I/O and passes plain data in.
- **Rationale**: Keeps `core/` free of `vscode`/DOM/Node (Principle I) and directly
  enables incremental updates (SC-008): a single file change re-runs `parseFeature`
  for one feature and reuses the others' cached `FeatureFacts`, then re-assembles
  (a cheap in-memory set operation). Everything is testable in plain Node with
  in-memory inputs.
- **Alternatives considered**: an async `FileReader` port the core calls (rejected —
  makes the core async and harder to test, for no benefit since the adapter already
  knows what to read); one monolithic `build(snapshot)` (rejected — recomputes every
  feature on any change, losing the incremental property).

## Decision 2: Targeted regex parsing, no markdown library

- **Decision**: Parse the specific patterns we need with focused regexes: H1 title,
  `**Status**:` line, task checkboxes `- [x]/[ ]`, relative markdown links, full-slug
  mentions, and data-model entity headings with a code pin. No markdown/AST dependency.
- **Rationale**: The spike proved regex is sufficient for exactly these signals; a
  markdown AST library adds bundle weight (Principle IV size budget) and a runtime
  dependency for no gain, and must stay local/offline (Principle VI). "Prefer
  built-ins and small, focused libraries" (constitution).
- **Alternatives considered**: `remark`/`markdown-it` (rejected — heavy, unnecessary
  for line-oriented signals); a hand-written full parser (rejected — overkill).

## Decision 3: Edge model — directed, tiered, weighted, evidenced, toggleable

- **Decision**: Edges are directed (referrer → referenced), carry `heuristic`,
  `tier` (definitive | strong | medium | risky), `weight`, and `evidence`. Tiers map
  to the calibrated heuristics; each is toggleable; `definitive` is locked on.
- **Rationale**: Legibility + trust (US2). Weight lets consumers rank (SC-009). Matches
  spike precision findings.
- **Alternatives considered**: boolean/untyped edges (rejected — no provenance, can't
  toggle or rank); a single confidence float only (rejected — tier + weight is clearer
  for UI and toggling).

## Decision 4: Medium heuristic restricted to code-pinned entities

- **Decision**: The shared-data-model-entity edge fires only when the entity is pinned
  to a concrete code type/location (e.g. `### Flight (existing — db.types.ts:982)`),
  not on a bare shared heading word.
- **Rationale**: The spike's naive heading-first-word extraction produced garbage
  entities (`Type`, `Derived`, `Reused`, `Persisted`). Code-pinned entities are the
  reliable signal and dramatically raise precision.
- **Alternatives considered**: any PascalCase shared name (rejected — noisy);
  stopword-filtered names (rejected — brittle, still noisy). Code-pin is the clean rule.

## Decision 5: Bare feature numbers off by default (empirically justified)

- **Decision**: The bare-feature-number heuristic is off by default, opt-in, and
  low-confidence when enabled.
- **Rationale**: The spike produced 70 candidate edges, mostly false (performance
  numbers, `Constitution IV`, link text). This is the constitution's named
  false-relation example, now backed by data.

## Decision 6: Per-project scoping / namespacing

- **Decision**: Build one `ProjectGraph` per detected `.specify` root. Feature ids are
  namespaced by project; reference resolution (links, slugs, numbers, entities) is
  confined to the owning project. A multi-root workspace yields N independent
  sub-graphs.
- **Rationale**: FR-001/002; feature numbers/slugs and generic entity names collide
  across unrelated repos (spike). Also caps cost — no N² cross-repo comparison
  (Principle IV scale target).
- **Alternatives considered**: one global graph (rejected — false cross-project edges,
  quadratic blow-up).

## Decision 7: Two-layer scan (tree vs content) in the adapter

- **Decision**: The adapter builds each node's existence + completeness attribute from
  a directory listing (no file contents), then reads only the content files needed for
  title/status/tasks/edges. It caches per-file contents and per-feature `FeatureFacts`
  for incremental rebuilds.
- **Rationale**: SC-005 (tree-only nodes) and SC-008 (single-file incremental). The
  spike confirmed the tree alone yields nodes + completeness; contract filenames are a
  weak edge signal, so they stay node-level.

## Decision 8: Status & task-completion extraction rules

- **Decision**: Status = value after `**Status**:`, trimmed, raw preserved (tolerate
  trailing whitespace and parenthetical notes). Task completion = checked ÷ total
  checkbox items; a feature with no task list reports "no tasks" (not 0%).
- **Rationale**: Matches real corpus messiness (`Implemented (authored retroactively)`,
  `Draft  `); FR-007/008, SC-006.

## Decision 9: Reference resolution, ambiguity, self-reference

- **Decision**: Resolve a reference to a feature within the same project by exact slug
  (strong) or explicit relative path (definitive). Self-references produce no edge.
  Multiple signals for the same pair collapse into one edge (strongest tier, merged
  evidence). A reference that resolves to >1 feature is recorded as a warning, not a
  guessed edge.
- **Rationale**: Edge-case requirements FR-015/019; avoids false/ambiguous edges.

## Decision 10: Envelope integration (no rendering)

- **Decision**: `MapViewModel.graph` changes from `null` to a workspace graph
  (`{ projects: ProjectGraph[] }` or equivalent). The webview renderer is unchanged in
  this feature (still shows the welcome/empty state); rendering is feature 003.
- **Rationale**: Spec scope — model only, handed to the existing envelope.

## Open items carried to later features

- Rendering/layout of the graph (003).
- Agent-facing CLI/MCP exposure of the model (004).
- Status vocabulary normalization/classification (explicitly out of scope here).
