# Feature Specification: Show Specs for File

**Feature Branch**: `013-show-specs-for-file`

**Created**: 2026-07-20

**Status**: Completed

**Input**: User description: "Add \"SpecKit Atlas: Show Specs for File\" — the inverse of feature 011. Given the active source file, show which spec(s) reference/relate to it (code→spec reverse traceability, like GitLens \"Show File History\" but for specs). Implement the lookup as a pure specsForFile(path) in the 004 query layer (src/core/query/) so it's exposed as a command + CLI + MCP tool from one function. Reuse 011's SpecNode.codeReferences inverted (artifact-derived, offline, deterministic — no git). Extension surfaces a command (palette + editor context menu on files) → quick pick of related specs → open the spec / reveal+focus on the map (010). Read-only, offline, telemetry-free."

## User Scenarios & Testing *(mandatory)*

Feature 011 answers "which files fulfill this spec?" This feature answers the inverse:
"which specs relate to this file?" — reverse traceability from any source file back to the
spec(s) that declare it, the way a version-control tool surfaces a file's history but for
specifications instead of commits.

### User Story 1 - Discover the specs behind a file (Priority: P1)

A developer is looking at a source file and wants to understand which specification(s) it
belongs to. They invoke "Show Specs for File" and get a list of every spec whose declared
artifacts reference that file. From that list they can jump straight to a spec's `spec.md`.

**Why this priority**: This is the core inverse-of-011 capability and the minimum that
delivers value. Without it, there is no reverse lookup at all. Everything else (map reveal,
CLI, MCP) enriches this one interaction.

**Independent Test**: Open a source file that appears in a spec's `codeReferences`, invoke
the command, confirm the related spec(s) are listed, select one, and confirm its `spec.md`
opens. Fully testable with a fixture repo, no other stories required.

**Acceptance Scenarios**:

1. **Given** a file referenced by exactly one spec, **When** the user invokes Show Specs for
   File, **Then** that spec is presented and selecting it opens the spec's `spec.md`.
2. **Given** a file referenced by several specs, **When** the user invokes the command,
   **Then** all referencing specs are listed in a stable, predictable order for selection.
3. **Given** a file referenced by no spec, **When** the user invokes the command, **Then** a
   clear "no related specs" message is shown and nothing else happens.
4. **Given** a single matching spec, **When** the user invokes the command, **Then** the
   result may resolve directly to that spec without forcing an extra selection step.

---

### User Story 2 - Reveal and focus the file's specs on the map (Priority: P2)

From the same result list, the developer chooses to see a related spec in context on the
relationship map. The map opens (or comes to focus), the chosen spec is selected, and focus
mode (feature 010) scopes the map to that spec and its neighbors.

**Why this priority**: Connects reverse lookup to the existing visual map, turning a flat
list into spatial understanding of how the file's spec relates to others. Valuable but
depends on P1 producing the candidate list first.

**Independent Test**: With the map feature present, invoke Show Specs for File, choose
"Reveal on map" for a result, and confirm the map focuses that spec via the existing
selection/focus behavior.

**Acceptance Scenarios**:

1. **Given** a result list, **When** the user chooses "Reveal + focus on map" for a spec,
   **Then** the map is shown, that spec becomes the single active selection, and focus mode
   scopes the view to it and its one-hop neighbors.
2. **Given** the map is already open, **When** the user reveals a spec from the result list,
   **Then** the existing map view updates in place (no duplicate map) to focus that spec.

---

### User Story 3 - Reverse lookup from the command line and AI agents (Priority: P3)

A tooling author or in-editor AI agent asks "which specs relate to this file?" outside the
editor UI — via the `speckit-atlas` CLI or the local MCP server — and receives the same
answer the editor would give, as a deterministic machine-readable result.

**Why this priority**: Extends the single lookup function to the headless surfaces so
automation and agents get parity with the UI. Depends on the pure lookup (shared with P1)
but is not required for the editor experience to ship.

**Independent Test**: Run the CLI reverse-lookup for a known file path against a fixture repo
and confirm the returned specs match the editor result; invoke the equivalent MCP tool and
confirm identical data.

**Acceptance Scenarios**:

1. **Given** a workspace and a file path, **When** the CLI reverse lookup runs, **Then** it
   emits the related specs in the standard versioned result envelope, deterministically
   ordered.
2. **Given** the same inputs, **When** the MCP tool is invoked, **Then** it returns the same
   specs as the CLI and the editor.
3. **Given** a file path referenced by no spec, **When** the headless lookup runs, **Then**
   it returns an empty-but-valid result (no error, no crash).

---

### Edge Cases

- **File not referenced by any spec** → empty result with a clear, non-error "no related
  specs" outcome on every surface.
- **File referenced only at the folder level** (a spec references the containing directory,
  not the exact file) → the file still resolves via folder fallback, and results indicate the
  match was by folder rather than exact file.
- **Both exact and folder matches exist** → exact-file matches take precedence and are
  distinguished from folder-level matches in the result.
- **Same file referenced by specs in different projects/spec-sets** → results stay scoped so
  a file's specs are not mixed across unrelated projects; project is identifiable per result.
- **Invoked with no active file / a non-file editor** → a clear message that no file is
  available, no crash.
- **Invoked on a file outside the workspace** → treated as having no related specs (paths are
  matched relative to the workspace root).
- **Path shape differences** (absolute vs relative, separators, casing, `./` prefixes) →
  normalized before matching so equivalent paths match regardless of how they are expressed.
- **Malformed or missing spec artifacts** → degrade to partial results plus warnings; the
  lookup never throws or crashes the host.
- **File referenced by a spec that has no map node yet** → it still appears in the list;
  "reveal on map" degrades gracefully if the spec cannot be shown.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a single reverse-lookup capability that, given a file
  path and a workspace, returns the specification(s) that reference that file.
- **FR-002**: The lookup MUST derive relationships solely by inverting each spec's declared
  code references (the artifact-derived references introduced in feature 011). It MUST NOT
  consult version control, the network, or any external service.
- **FR-003**: The lookup MUST match a file by exact workspace-root-relative path first, and,
  when no exact match exists, MUST fall back to specs that reference the file's containing
  folder. Results MUST indicate whether each match was exact or folder-level.
- **FR-004**: When both exact-file and folder-level matches exist for a file, exact matches
  MUST be presented ahead of folder-level matches.
- **FR-005**: The lookup MUST normalize file paths (separators, `./` prefixes,
  absolute-vs-relative, and equivalent path spellings) to the same workspace-root-relative
  form on both sides of the comparison before matching.
- **FR-006**: Results MUST be scoped so that specs from unrelated projects/spec-sets are not
  conflated, and each result MUST identify which project it belongs to.
- **FR-007**: Results MUST be deterministically ordered so the same inputs always produce the
  same output ordering across all surfaces.
- **FR-008**: The same lookup MUST back three surfaces from one implementation: an editor
  command, the command-line surface, and the local agent (MCP) surface, all returning
  equivalent data for equivalent inputs.
- **FR-009**: The editor command MUST be invocable from the command palette, the open-editor
  context menu, the file-explorer context menu, and the editor title menu, acting on the
  relevant file in each case.
- **FR-010**: In the editor, results MUST be presented as a selectable list (quick pick) in
  which each related spec offers an "Open spec" action and a "Reveal + focus on map" action.
- **FR-011**: Choosing "Open spec" MUST open that spec's `spec.md` for viewing without
  modifying it.
- **FR-012**: Choosing "Reveal + focus on map" MUST show the map, make the chosen spec the
  single active selection, and scope the view to that spec and its neighbors using the
  existing focus behavior (feature 010); if the map is already open it MUST update in place.
- **FR-013**: When exactly one spec matches, the editor surface MAY resolve to that spec
  directly rather than forcing the user through a single-item list.
- **FR-014**: When no spec references the file, every surface MUST return/show an
  empty-but-valid "no related specs" result rather than an error.
- **FR-015**: The headless surfaces MUST return the result in the project's standard
  versioned, machine-readable result envelope, consistent with the other query surfaces.
- **FR-016**: The entire feature MUST be read-only — it MUST NOT create, modify, move, or
  delete any workspace file — and MUST remain offline and free of any telemetry.
- **FR-017**: Malformed, partial, or missing spec inputs MUST degrade to partial results with
  per-item warnings; the lookup MUST never throw or crash the host.
- **FR-018**: When invoked with no available file (no active editor, or a non-file target),
  the editor surface MUST show a clear message and take no further action.

### Key Entities *(include if data involved)*

- **File query**: the workspace-relative file path being looked up, plus the match rule
  (exact-then-folder) applied to it.
- **Related-spec result**: a spec that references the file, carrying its identifier, project,
  human-readable name, the location of its `spec.md`, and whether the match was exact-file or
  folder-level.
- **Reverse-lookup result set**: the deterministically ordered collection of related-spec
  results for one file query, plus any warnings, wrapped in the standard versioned envelope on
  headless surfaces.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For any file referenced by one or more specs in a workspace, the user can list
  those specs in no more than two interactions (invoke, then read the list).
- **SC-002**: From the result list, opening the related spec or revealing it on the map takes
  a single additional interaction.
- **SC-003**: The editor command, CLI, and agent (MCP) surfaces return identical sets of
  related specs for the same file and workspace in 100% of cases.
- **SC-004**: Running the reverse lookup twice on unchanged inputs yields byte-identical
  ordered results (fully deterministic).
- **SC-005**: A file referenced by no spec produces a clear "no related specs" outcome on all
  surfaces with zero errors or crashes.
- **SC-006**: A file referenced only at folder level is still surfaced, and its results are
  distinguishable from exact-file matches.
- **SC-007**: The feature performs no file writes and makes no network requests under any
  invocation (verifiable by observation).
- **SC-008**: Malformed or partial spec inputs never crash the host; the lookup returns a
  result plus warnings in 100% of such cases.

## Assumptions

- **Reuses feature 011 references**: the per-spec code references captured by feature 011 are
  the sole basis for reverse lookup; git-attributed changes (feature 012) are intentionally
  excluded to keep the lookup deterministic, offline, and constitution-compliant. A future
  feature could add a git-informed union.
- **Reuses feature 010 focus behavior**: "reveal + focus on map" relies on the existing
  selection + focus-mode capability rather than introducing new map behavior.
- **Reuses the 004 query envelope**: headless results use the same versioned envelope and
  determinism guarantees as the existing query surfaces.
- **Single-match shortcut is acceptable UX**: when only one spec matches, resolving directly
  to it (rather than showing a one-item list) is the preferred editor behavior.
- **Folder fallback is one level of the containing directory**, applied only when no exact
  match exists; deeper ancestor matching is out of scope for this feature.
- **Project scoping mirrors existing behavior**: a file's specs are grouped by the same
  project scoping the rest of the graph uses; cross-project conflation is out of scope.
- **Read-only viewing**: opening a spec or revealing it on the map never modifies workspace
  files, consistent with the constitution's read-only principle.
