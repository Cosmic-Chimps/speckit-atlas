# Research: Folder-Name Identity for Relationships

Feature 009. Resolves the technical choices behind the plan. No unresolved
`NEEDS CLARIFICATION` remain (the name-matching policy was settled in the spec).

## D0 — Where the real gap is (grounding)

`buildProjectGraph` already builds `idSet = new Set(features.map(f => f.id))` and gates
`link`/`slug` edges through `resolvable(target, idSet, self)` — i.e. **resolution is already
folder-name-based**; nodes already use `id = folder name`. The failure is entirely in
**extraction**: `heuristics.ts` `SLUG = "[0-9]{3}-[a-z0-9-]+"` only *produces* candidates
with a 3-digit prefix, so timestamp/unnumbered targets are never proposed. The fix is at the
extraction seam, not resolution.

## D1 — Links: broaden to per-segment candidates, resolve against siblings

**Decision**: `extractLinks` matches relative markdown links `](…)` and emits a **candidate
per path segment** (each folder-name-shaped component), not a single `NNN-slug` capture.
Resolution against `idSet` keeps only real siblings.

**Rationale**: A link target is a concrete path; the feature folder is whichever segment
names a real sibling (`../003-x/spec.md`, `../../specs/2026…-x/plan.md`,
`../unnumbered-name/…`). Emitting all segments and letting `resolvable` filter handles every
scheme and every nesting depth without guessing which segment is "the feature". Non-feature
segments (`specs`, `src`, a file name) simply aren't in `idSet`.

**Alternatives considered**:
- *Broaden the single capture to `[^/)]+/`* — captures the **first** segment after `../`,
  which for `../../specs/003-x/` is `specs`, not `003-x`. Rejected.
- *Add a timestamp alternative to the `NNN-slug` capture* — still misses unnumbered folders
  and deeper paths. Rejected.

## D2 — Slug-mentions: sibling-aware whole-word matcher

**Decision**: Replace the `NNN-slug` token regex with `matchSiblingMentions(text,
siblingIds, selfId): { id, count }[]` — for each real sibling id, count its **whole-word**
occurrences in the feature's text (boundaries: not preceded/followed by `[A-Za-z0-9-]`, so a
hyphenated name matches as a unit and never inside a longer name). Self is excluded. Run it
in `buildProjectGraph`, where `idSet` exists, and add `strong` `slug-mention` edges weighted
by count — exactly the resolved FR-004 policy (whole-word, any scheme, count-weighted).

**Rationale**: You cannot regex "any folder name" out of prose without matching every word;
matching the **known** sibling set is the only correct way to support unnumbered names. It
also subsumes the old behavior: for `NNN-slug` names the whole-word match reproduces the old
token counts (SC-003).

**Alternatives considered**:
- *Keep regex extraction, add timestamp alt* — doesn't cover unnumbered folders (fails
  FR-003/US2). Rejected.
- *Per-sibling `indexOf`/regex loop (O(features × siblings × text))* — too slow at scale.
  Rejected in favor of a single alternation scan (D5).

## D3 — Getting the text to the matcher: transient `mentionText`

**Decision**: `parseFeature` already concatenates the feature's files into `allText`; return
it as `FeatureFacts.mentionText`. `buildWorkspaceGraph` → `buildProjectGraph` then has both
the text and `idSet`. `mentionText` is transient (recomputed each build from the cached
`FeatureInput.files`), not persisted.

**Rationale**: Keeps the pure two-phase shape (parse → assemble) and centralizes matching
where the sibling set lives. No cache growth — the raw text already lives in the cached
`ProjectSnapshot.features` (FeatureInput); `mentionText` is derived at build time.

**Alternatives considered**:
- *Pass `FeatureInput[]` into `buildProjectGraph`* — leaks the raw input shape past the
  parse boundary. Rejected; a single derived string field is cleaner.

## D4 — `number` and the bare-number tier stay 3-digit

**Decision**: Leave `number` derivation at `^(\d{3})-` in `projectScan`/`nodeScan`
(number present only for sequential features, absent otherwise) and leave `NUMBER_RE`
(bare-number) at three digits.

**Rationale**: FR-005 wants `number` **absent** (not fabricated) for timestamp/unnumbered
features, and FR-006 scopes the risky bare-number tier to numbered features. A timestamp is
never written as a bare 3-digit reference, so nothing is lost. This also means these two
files need **no change** — the only real edit is the extraction/matching in `graph/`.

## D5 — Performance: one alternation scan per feature

**Decision**: Build a single regex per project from the sibling ids — escaped, sorted
**longest-first**, joined with `|`, wrapped in non-word/hyphen boundaries — and scan each
feature's text once, tallying matches by id. O(features × text), independent of sibling
count in the inner loop.

**Rationale**: Longest-first prevents `fleet-safety` matching inside `fleet-safety-audit`;
the boundary assertions mirror the old lookbehind/ahead. One scan per feature keeps the full
rebuild within the < 200 ms incremental budget on 200 specs (Principle IV). The regex is
built from validated, escaped folder names (no ReDoS surface).

## D6 — Zero regression on sequential repos (byte-identical)

**Decision**: The broadened link extractor still captures `003-x` for existing links, and
`matchSiblingMentions` reproduces the old `NNN-slug` token counts, so sequential fixtures
yield the identical edge set. Guarded by re-running the existing sequential fixtures/tests
and asserting unchanged edges (SC-003/FR-008).

**Rationale**: The change must be additive for the common case; existing tests
(`graph.test`, `graph.heuristics`, `elements`, integration render suites) are the guard.

## Summary of decisions

| ID | Decision |
|----|----------|
| D1 | `extractLinks` → per-path-segment candidates; resolve against `idSet` (all schemes/depths). |
| D2 | `matchSiblingMentions(text, siblingIds, self)` → whole-word, count-weighted slug edges. |
| D3 | Carry transient `FeatureFacts.mentionText`; match in `buildProjectGraph`. |
| D4 | `number` + bare-number stay 3-digit (FR-005/FR-006); `projectScan`/`nodeScan` unchanged. |
| D5 | One longest-first alternation scan per feature; O(features × text), < 200 ms budget. |
| D6 | Sequential repos → byte-identical edges; existing fixtures guard the regression. |
