# Phase 0 Research: Show Specs for File

All four lead clarifications were resolved before the spec was written (trigger surface,
result presentation, data source, match granularity). This document records the remaining
design decisions — the ones that shape *how* the resolved requirements are implemented — with
rationale and rejected alternatives. There are **no** `NEEDS CLARIFICATION` markers.

---

## R-1 — Where the lookup lives: one pure function over the built graph

**Decision**: Add `specsForFile(graph: WorkspaceGraph, path: string, scope?: QueryScope):
SpecsForFile` to `src/core/query/queries.ts`, alongside `specRelationships`, `getGraph`, etc.
It is pure, total, and deterministic — it reads `SpecNode.codeReferences` and returns matches.

**Rationale**: Feature 004 already established the pattern: pure query functions operate on an
*already-built* `WorkspaceGraph`, and `platform/runQuery` + `cli/main` + `mcp/main` fan the
same function out to CLI and MCP. Placing the lookup here means "command + CLI + MCP from one
function" (the user's stated goal, FR-008) falls out for free — the CLI/MCP wiring is a
one-line `case` each. It also keeps every principle satisfied (pure core, no I/O).

**Alternatives rejected**:
- *Compute in the extension over the in-memory graph only* — would not give CLI/MCP parity
  (FR-008) and would duplicate matching logic.
- *A new scan/index in `platform`* — unnecessary; the graph already carries `codeReferences`.

---

## R-2 — Data source: invert `SpecNode.codeReferences` only (no git)

**Decision**: A spec "references a file" iff the file appears in that spec's
`SpecNode.codeReferences` (feature 011). Feature 012's git-attributed change sets are **not**
consulted.

**Rationale**: This is the resolved clarification and the constitution's posture. `codeReferences`
are artifact-derived (parsed from `tasks.md`/spec prose by `extractCodeReferences`), already
normalized to workspace-root-relative, de-duplicated, and present whenever the on-by-default
`specToCode` option is set. Using them keeps the lookup deterministic (SC-004), offline, and
read-only, and lets the pure core answer without touching VCS. A git-informed *union* is a
clean future extension but is explicitly out of scope (Assumptions).

**Consequence — `specToCode` off**: When the user has disabled the Spec→Code layer,
`codeReferences` is absent and every lookup returns empty. The core returns an empty-but-valid
result; the **editor command** adds a helpful hint ("enable SpecKit Atlas: Spec→Code references
to see file relationships"). The CLI/MCP simply return the empty envelope (a headless caller can
pass `--spec-to-code` / `options.specToCode`).

---

## R-3 — Path normalization: one shared normalizer (kill drift)

**Decision**: Extract the existing private `normalizeCodePath` logic from
`src/core/graph/heuristics.ts` into a new tiny pure module `src/core/path.ts`
(`normalizeWorkspacePath(raw)`), and have **both** `heuristics.ts` (when building
`codeReferences`) and `queries.ts` (when normalizing the *incoming* query path) call it.

**Rationale**: Matching is only correct if the query path is normalized *identically* to how
the stored references were normalized (strip leading `./`/`../`, backslashes → `/`, trim). If
the two normalizers ever diverge, exact matches silently break. A single source of truth makes
"same inputs → identical results" (SC-004) structural rather than a convention. The extraction
is behavior-preserving for 011 (a pure refactor with existing fixtures as the guard).

**Alternatives rejected**:
- *Duplicate a normalizer inside `queries.ts`* — drift risk; the exact bug this feature must
  not have.
- *Export `normalizeCodePath` from the graph module* — couples the query layer to graph
  internals; a neutral `core/path.ts` is cleaner and both modules already sit in `core/`.

---

## R-4 — Match rule: exact-file first, folder fallback (resolved), with `matchKind`

**Decision**: Given a normalized query path `p` with containing directory `d` (the substring
before the last `/`, or `""` if none):
1. **Exact**: collect specs whose `codeReferences` contains `p`. Label `matchKind: "exact"`.
2. **Folder fallback** — applied **only if the exact set is empty** (FR-003): collect specs
   whose `codeReferences` contains any path starting with `d + "/"`. Label `matchKind: "folder"`.
   - If `d` is `""` (a root-level file with no folder), **no** folder fallback runs (guards
     against a bare filename matching the entire repo).

**Reconciling FR-003 and FR-004**: FR-003 makes folder a *fallback* (runs only when there is no
exact match), so within a single file query the result set is homogeneous — all `exact` or all
`folder`. FR-004 ("exact ahead of folder-level") is therefore satisfied trivially, and the
result ordering still lists `exact` before `folder` as an explicit, defensive invariant (it also
keeps the spec-level ordering honest if folder matching is ever broadened later).

**Rationale**: Matches the resolved clarification ("exact file, then folder fallback"). Exact
matches are the precise answer; the fallback recovers the common case where a spec references a
directory (e.g. `` `src/core/graph/` `` appears in prose) rather than the exact file. Labeling
by `matchKind` lets the UI and the JSON envelope distinguish precision (spec Edge Cases, SC-006).

**Alternatives rejected**:
- *Always merge exact + folder* — the third clarify option; rejected because it dilutes precise
  matches with directory-level noise on files that already have exact hits.
- *Ancestor walk (multiple folder levels)* — out of scope (Assumptions: "one level of the
  containing directory").

---

## R-5 — Result scope: match within project, extension resolves the right root

**Decision**: `specsForFile` matches `path` against `codeReferences` within the projects
selected by `scope` (same `QueryScope.projectId` mechanism as every other query). Results carry
`projectId` per match (FR-006). The **editor command** determines which workspace folder /
project the active (or right-clicked) file belongs to, computes the file's path *relative to
that project root*, and calls `specsForFile` scoped to that `projectId`.

**Rationale**: `codeReferences` are stored relative to their project root (the same root
`openFile` joins against, `vscode.Uri.parse(projectId)`). A root-relative path like
`src/foo.ts` is ambiguous across projects, so the command resolves the file to its owning
project and scopes accordingly — no cross-project conflation (FR-006). The **CLI/MCP** already
take `--root`/`root` (their single scan root) plus optional `--project`, so their `path` is
naturally root-relative and needs no extra resolution.

**Edge**: a file outside any workspace folder / outside the scan root → no project owns it →
empty result (spec Edge Case), surfaced as "no related specs".

---

## R-6 — "Reveal + focus on map" reuses 010; keep the sidebar toggle in sync

**Decision**: The quick-pick "Reveal + focus on map" action performs, in the host:
`panel.reveal()` → `panel.focus(nodeId)` → `pushSelection(nodeId)` (exactly the existing
`focusSpec` control path, which reveals the panel, selects the single node, and echoes the
selection to the SPECS list), **and** enables focus mode via `panel.setFocusMode(true)` so the
view is scoped to the spec + its one-hop neighbors (FR-012, feature 010). To avoid the sidebar
focus-mode checkbox going stale, add a minimal `HostToControls` echo `{ type: "focusMode",
enabled }` that the controls webview reflects; the host tracks `focusMode` state and includes it
so map-node clicks and this command stay consistent.

**Rationale**: FR-012 asks for spec + neighbors scoping, which is precisely feature 010's focus
mode. Reusing the established `focusSpec` + `setFocusMode` paths means no new map behavior and no
new webview map code — the feature stays "webview-thin". The one small protocol addition (a
host→controls `focusMode` echo) is the honest cost of not letting the toggle drift; it is
optional if a simpler "reveal + select only" MVP is preferred, in which case FR-012's scoping is
delivered whenever the user already has focus mode on. **Chosen**: include the echo so FR-012 is
met unconditionally.

**Alternatives rejected**:
- *Reveal + select only (no focus mode)* — would not scope the view unless the user had already
  toggled focus mode; under-delivers FR-012.
- *Force focus mode via `panel.setFocusMode(true)` without echoing* — desyncs the sidebar
  checkbox; a latent UX bug.

---

## R-7 — Envelope shape: new `QueryKind "file"`, `SpecsForFile` data

**Decision**: Introduce `QueryKind "file"` and a `SpecsForFile` payload
`{ path: string; matches: readonly RelatedSpec[] }`, where `RelatedSpec =
{ specId, projectId, title, status, matchKind }`. Extend the `QueryResult["data"]` union,
`toEnvelope` needs no change (kind-agnostic), and `formatText` gains a `"file"` case.

**Rationale**: Mirrors the existing `SpecRelationships`/`StatusSummary` style — a small,
JSON-serializable, deterministically ordered payload wrapped in the same versioned envelope
(FR-015). `RelatedSpec` is a flat projection (id/project/title/status/matchKind) rather than the
full `SpecNode` — enough to render the quick pick and to be useful to an agent, without
re-emitting `codeReferences`/`completeness` noise. Ordering: `matchKind` (exact before folder),
then `projectId`, then `specId` — fully deterministic (SC-004, FR-007).

**Alternatives rejected**:
- *Return full `SpecNode` per match* — heavier JSON; the query already exposes full nodes via
  `getGraph`/`specRelationships` when needed.
- *Reuse `QueryKind "spec"`* — different question, different shape; conflating them would break
  `formatText` and the envelope's `kind` contract.

---

## R-8 — Command surfaces & activation

**Decision**: Register `speckitAtlas.showSpecsForFile` and contribute it to four menus:
`commandPalette` (always), `editor/context` (`when: resourceScheme == file`), `explorer/context`,
and `editor/title`. The handler accepts an optional `uri` (passed by the context menus); when
absent (palette) it uses `vscode.window.activeTextEditor?.document.uri`. No `activationEvents`
change is required — VS Code auto-activates on `onCommand`. Existing `workspaceContains`
activation already builds the graph on load; if the command runs before the first build it
triggers activation and the graph is ready.

**Rationale**: The resolved clarification asked for all four trigger surfaces. Passing the menu
`uri` lets the explorer entry work on files that are not open (spec Edge Cases). `when` clauses
keep the menu items scoped to files. No engine bump (menus + `onCommand` are long-stable APIs);
`^1.101.0` stays.

---

## Summary of decisions

| # | Decision |
|---|----------|
| R-1 | One pure `specsForFile(graph, path, scope?)` in `core/query`; CLI/MCP via existing `runQuery` fan-out. |
| R-2 | Data source = inverted `SpecNode.codeReferences` only; **no git**. `specToCode` off → empty + hint. |
| R-3 | Shared `src/core/path.ts` normalizer used by both 011's extraction and the query — single source of truth. |
| R-4 | Exact-file first; folder fallback **only when no exact match**; guard empty dir; `matchKind` label. |
| R-5 | Match within scoped project; the editor command resolves file → owning project + root-relative path. |
| R-6 | "Reveal + focus" = reveal + select + focus-mode (010), with a small host→controls `focusMode` echo. |
| R-7 | New `QueryKind "file"` + `SpecsForFile`/`RelatedSpec`; deterministic ordering (matchKind, project, id). |
| R-8 | Command in palette + editor/context + explorer/context + editor/title; optional `uri` arg; no engine bump. |
