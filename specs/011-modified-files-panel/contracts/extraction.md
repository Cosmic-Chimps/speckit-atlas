# Contract: Broadened code-reference extraction

**Module**: `src/core/graph/heuristics.ts` — `extractCodeReferences(text: string): Reference[]`
**Purity**: total, no I/O, no `vscode`/DOM. **Gate**: any change here MUST update fixtures.

## Purpose

Extract source-file paths a feature references, from the feature's concatenated artifact text
(`allText` in `parseFeature`), so the detail panel can list "files modified to fulfill the spec".
Output feeds `SpecNode.codeReferences` (via `toNode`) and never produces graph edges.

## Recognized forms

A candidate qualifies only if it contains a path separator (`/`) **and** ends in an allowed
extension. Two syntactic forms are recognized:

1. **Relative markdown link** (existing, unchanged):
   `](../path/to/name.ext)` — one or more leading `../` then a path ending in an allowed extension.
2. **Backtick-wrapped path** (new):
   `` `dir/sub/name.ext` `` — a single-backtick inline-code span whose content is a path (contains
   `/`) ending in an allowed extension. Leading `./` or `../` segments are accepted and preserved.

**Allowed extensions**: `ts, tsx, js, jsx, mjs, cjs, cs, py, go` (source code). This set is fixed by
fixtures; widen only with a fixture that justifies it. Non-code artifacts (`.md`, `.json`, `.css`,
`.html`) are **excluded** to keep the list to "code that fulfills the spec" and limit noise —
revisit only if a fixture demonstrates a real need.

## Output

`Reference[]` where each entry is `{ kind: "code", targetHint: <path>, evidence: <path>, count }`:

- `targetHint` — the captured path, verbatim as written (leading `./`/`../` preserved). Downstream
  display normalization (if any) is the webview's concern, not the extractor's.
- De-duplicated by `targetHint` within a single call; `count` = number of occurrences.
- Order of the returned array is not contractual (the webview owns display order, D4).

## Guarantees

- **Total**: never throws; empty/garbage input ⇒ `[]`.
- **Conservative**: a token without a `/` or without an allowed extension is never emitted (no bare
  identifiers, prose words, versions, or bare filenames).
- **Deterministic**: same input ⇒ same set of `targetHint`s with the same counts.

## Fixture obligations (Development Workflow gate)

Add/extend a feature fixture whose `tasks.md` (and/or `plan.md`) lists files in real-world forms and
assert the resulting `codeReferences`:

| Case | Input snippet | Expected in `codeReferences` |
|------|---------------|------------------------------|
| Backtick path in a task line | `` - [ ] T003 Update `src/core/graph/heuristics.ts` `` | `src/core/graph/heuristics.ts` |
| Relative link (existing form) | `[helper](../../src/webview/map/elements.ts)` | `src/webview/map/elements.ts` (or `../../…` per current behavior — assert actual) |
| Duplicate mentions | same path in two task lines | single entry, `count` ≥ 2 |
| Bare word, no slash | `` `heuristics` `` | **absent** |
| Non-code extension | `` `specs/011/plan.md` `` | **absent** |
| Prose path without backticks | `see src/foo.ts` | **absent** (not a recognized form) |

Also add a **regression fixture** confirming a feature that references no code yields
`codeReferences: []` (drives the panel empty state).
