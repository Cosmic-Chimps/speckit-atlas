# Contract: Folder-Name Reference Extraction & Matching

Feature 009. Revises the feature-002 heuristics contract
(`specs/002-spec-graph-model/contracts/heuristics.md`). Pure `core/`, unit-tested in Node.

## Signatures

```ts
// heuristics.ts
extractLinks(text: string): Reference[]              // now emits a candidate per path segment
matchSiblingMentions(                                 // NEW — sibling-aware slug matching
  text: string,
  siblingIds: Iterable<string>,
  selfId: string,
): { id: string; count: number }[]
extractBareNumbers(text: string): Reference[]         // unchanged (3-digit)
extractEntities(dataModelText: string): Reference[]   // unchanged
extractCodeReferences(text: string): Reference[]      // unchanged
```

## Behavioral contract

- **H-1 (links, any scheme)**: `extractLinks` on a relative link `](…/X/…)` yields a `link`
  candidate for each path segment `X`; after resolution against the sibling set, a link into
  any real sibling folder — `NNN-slug`, `YYYYMMDD-HHMMSS-slug`, or unnumbered — produces a
  definitive edge (FR-002).
- **H-2 (non-feature segments)**: segments that are not real siblings (`specs`, `src`, a file
  name) resolve to nothing — no edge, no error.
- **H-3 (slug mentions, any scheme)**: `matchSiblingMentions` counts **whole-word**
  occurrences of each real sibling id in `text` (boundaries `[A-Za-z0-9-]` on both sides),
  excludes `selfId`, and returns per-id counts → strong, count-weighted edges (FR-003/FR-004).
- **H-4 (whole-word only)**: a sibling id is not matched inside a longer token — `fleet-safety`
  does not match within `fleet-safety-audit`; longest-first resolution picks the most specific
  sibling when names nest.
- **H-5 (arbitrary tokens)**: a token that is not a real sibling name produces no slug edge
  (FR-004) — no false positives beyond the agreed whole-word-of-a-real-sibling policy.
- **H-6 (number scope)**: `extractBareNumbers` stays 3-digit; timestamp/unnumbered features
  yield no bare-number candidate and never crash the heuristic (FR-006).
- **H-7 (regression)**: for `NNN-` inputs, `extractLinks` + `matchSiblingMentions` reproduce
  the exact edge set of the prior `NNN-slug` extractor (FR-008/SC-003).
- **H-8 (totality)**: every function is total — malformed/empty/huge input degrades to
  partial results or warnings, never a throw (FR-011).
- **H-9 (performance)**: matching uses a single longest-first alternation scan per feature
  (O(features × text)); no per-sibling re-scan (research D5).

## Non-goals (contract boundary)

- No change to the `Reference`/`RelationEdge`/`SpecNode` shapes, tiers, weights, or symmetry.
- No change to `entity`/`code` heuristics, nor to `number` derivation in `projectScan`/`nodeScan`.
- No shell, renderer, query, CLI/MCP, or protocol changes.
