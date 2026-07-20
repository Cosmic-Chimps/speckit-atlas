# Phase 0 Research: Modified-files list in the detail panel

All spec `[NEEDS CLARIFICATION]` markers were resolved during `/speckit-specify` (file source =
spec-artifact-derived; files clickable to open read-only). Remaining unknowns are internal design
decisions, resolved below against the current code.

## D1 — Source of the "modified files"

- **Decision**: Derive the list from the source-file references parsed out of the spec's own
  artifacts — the existing `code`-kind `Reference`s produced by `extractCodeReferences`, surfaced on
  `SpecNode.codeReferences`. No git, no version-control history.
- **Rationale**: Matches the resolved spec (FR-008). Keeps the feature fully offline, read-only, and
  deterministic (Principles III/VI). `parseFeature` already concatenates every scanned artifact
  (`spec.md`, `plan.md`, `tasks.md`, `data-model.md`, `research.md`, `quickstart.md`) into `allText`
  and runs `extractCodeReferences` over it, so `tasks.md` — the natural record of implementation
  files — is already in scope for extraction. `codeReferences` exists on the model but is currently
  rendered nowhere, so this is a surfacing task, not a new data pipeline.
- **Alternatives considered**: (a) Git-changed files — rejected: needs git I/O and a reliable
  commit→spec mapping, non-deterministic, and adds a new I/O surface. (b) A new dedicated scan of
  `tasks.md` — rejected: `parseFeature` already reads these files; a second reader would duplicate
  I/O and violate the single-scan design.

## D2 — Gating by the "Spec → code layer" toggle

- **Decision**: The Files list follows the existing `specToCode` option (the "Spec → code layer"
  checkbox under RELATIONSHIPS, **on by default**). When on, `SpecNode.codeReferences` is populated
  and the panel lists the files; when off, the node carries no code references and the panel shows
  the empty state. `specToCode`/`codeReferences` semantics are **left unchanged**.
- **Rationale**: Least-invasive and keeps features 002 (graph model) and 004 (query surface)
  byte-identical on existing repos — nothing else consumes `codeReferences`, but the option is
  exposed by the CLI (`--spec-to-code`), the MCP server, and the controls sidebar, and is asserted in
  `test/contracts/controls-help.test.ts`. Giving the previously-dormant attribute a visible surface
  is coherent: the "Spec → code layer" *is* the spec↔code linkage the list represents. Default-on
  means the list is visible out of the box.
- **Alternatives considered**: Ungating `codeReferences` (always populate) so the list ignores the
  toggle — rejected: makes the toggle a no-op and changes 002/004 output for the code attribute;
  more surface area for no user-visible benefit given default-on.
- **Consequence for the empty state**: The empty-state copy is neutral ("No source files
  referenced") so it reads sensibly whether a spec genuinely references nothing or the layer is
  toggled off.

## D3 — Broadening the code-reference extractor (the real gap)

- **Problem**: Today `CODE_LINK_RE = /\]\((?:\.\.\/)+([^)]+\.(?:ts|tsx|cs|py|go|js|jsx))\)/g` matches
  **only** markdown relative links, e.g. `](../../src/foo.ts)`. Real Spec Kit `tasks.md` files name
  files as inline code (`` `src/core/graph/heuristics.ts` ``) or in prose, not as relative links, so
  the current extractor yields an (almost) empty list — the feature would ship broken without this
  change.
- **Decision**: Broaden `extractCodeReferences` to also capture **backtick-wrapped workspace-relative
  paths** that end in a known source extension, in addition to the existing relative-link form.
  Recognized forms:
  1. Existing relative markdown links: `](…/path.ext)` (kept, unchanged behavior).
  2. Backtick-wrapped paths: `` `dir/.../name.ext` `` where the token contains a `/` and ends in a
     known extension.
  - Extension allow-list stays conservative (current set + widen only as fixtures justify):
    `ts, tsx, cs, py, go, js, jsx` (plus `mjs, cjs, json, md, css, html` as candidates — final set
    fixed in `contracts/extraction.md`). A candidate MUST contain a path separator and end in an
    allowed extension to qualify, avoiding matches on bare identifiers or prose.
- **Rationale**: This is the minimal broadening that captures how implementation files are actually
  recorded, while staying conservative to limit false positives. Because these references drive only
  a **panel list** (never graph edges — the `code` case in `buildProjectGraph` adds no edge), a rare
  false positive is low-stakes and self-evident to the user, unlike an inferred relationship.
- **Constitution**: This is a parsing-heuristic change, so per the Development Workflow gate it MUST
  add/update fixtures and assert the resulting `codeReferences`. The heuristic is documented in
  `contracts/extraction.md` (Principle II: risky heuristics documented).
- **Alternatives considered**: (a) Bare (un-quoted) path detection in prose — rejected for now: too
  noisy (matches paths inside sentences, versions, URLs); revisit only if fixtures show a real gap.
  (b) Parsing `tasks.md` task lines structurally — rejected: brittle across presets; the regex over
  `allText` is preset-agnostic and total.

## D4 — Ordering & de-duplication

- **Decision**: Sort ascending by **file name** (final path segment), case-insensitive, with a
  stable tiebreak on the full path; de-duplicate by full path so each file appears once. Implemented
  as a pure helper in `webview/map/elements.ts` when building `CyNodeData.files`.
- **Rationale**: FR-002/FR-003. Name-sort (not full-path sort) matches the user's "ordered by name".
  Case-insensitive with a full-path tiebreak guarantees determinism (SC-002). Pure and unit-testable
  in plain Node (Principle I).
- **Note**: `SpecNode.codeReferences` is already de-duplicated by `targetHint` in `toNode`; the
  webview mapper de-dupes again defensively and owns the display sort.

## D5 — Opening a listed file (read-only)

- **Decision**: Add a `PanelToHost` `openFile` message `{ type, path, projectId }`. The host resolves
  `path` **relative to the project root** and opens it with `showTextDocument(uri, { preview: true })`
  — the same read-only viewing path as `openSpec`. If `stat` fails (path missing/moved/outside root),
  show a warning and change nothing.
- **Rationale**: FR-006a + User Story 2, mirroring the proven `openSpec` handler (Principle III —
  read-only). Resolving strictly under the project root (reject `..` escape / absolute paths) keeps
  the surface safe and predictable.
- **Alternatives considered**: Reusing `openSpec` — rejected: it hard-codes `specs/<id>/spec.md`;
  arbitrary workspace-relative paths need their own resolver.

## D6 — Where the file list crosses the core→webview boundary

- **Decision**: Add `files: readonly string[]` to the pure `CyNodeData` (in `elements.ts`), populated
  from `SpecNode.codeReferences` at element-build time. `showDetail` reads `data.files`.
- **Rationale**: `elements.ts` is the existing pure seam that maps the core model to renderer data
  and already unit-tests in plain Node. Keeps `showDetail` free of parsing/sorting logic. No new
  message needed for the list itself — it rides the existing `render` payload the panel already
  receives.
