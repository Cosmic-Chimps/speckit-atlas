# Feature Specification: See what changed to fulfill a spec (before/after diff)

**Feature Branch**: `012-file-change-diff`

**Created**: 2026-07-20

**Status**: Draft

**Input**: User description: "From the map's spec detail panel (the FILES list added in feature 011), let the user see the diff — before and after — of the files that were modified to fulfill a spec. Two tiers: (P1) a per-file 'Open changes' action that opens the editor's built-in diff for that file; (P2) a spec-attributed changeset showing everything that changed to fulfill the selected spec. Introduces version control as a new data source; attribution is heuristic and degrades gracefully. Read-only, offline, telemetry-free; complement rather than reinvent the editor's diff/Timeline."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Open a listed file's changes (Priority: P1)

A user has selected a spec on the map and sees its **Files** list (feature 011). Next to a file, they
trigger an "Open changes" action and the editor shows that file's before/after comparison in its own
diff view — so they can read what changed without leaving the map-centric workflow or hand-navigating
version-control history.

**Why this priority**: This is the smallest slice that delivers the core value ("show me what
changed") and it reuses the editor's existing, trusted diff view rather than building a new one. It is
independently useful even if the spec-wide changeset (US2) is never built.

**Independent Test**: With a spec selected and its Files list shown, invoke "Open changes" on a file
that has version-controlled changes and confirm the editor opens that file's before/after diff; invoke
it on a file with no recorded changes and confirm a clear "no changes to show" message with nothing
else disturbed.

**Acceptance Scenarios**:

1. **Given** a selected spec whose Files list contains a file with recorded changes, **When** the user
   invokes "Open changes" on that file, **Then** the editor opens that file's before/after comparison.
2. **Given** a file in the list that has no recorded changes, **When** the user invokes "Open changes",
   **Then** the user is told there are no changes to show and the map/panel are unchanged.
3. **Given** the workspace has no version-control history at all, **When** the user invokes "Open
   changes", **Then** the user is told changes are unavailable, with no error.

---

### User Story 2 - See everything that changed to fulfill a spec (Priority: P2)

From a selected spec, the user opens a single **spec changeset** view that lists every file changed to
fulfill that spec (with per-file added/removed indicators) and lets them open each file's before/after
comparison. This answers "what did building this spec actually touch?" as one attributed set, not
file-by-file guesswork.

**Why this priority**: Higher value but materially harder — it depends on *attribution* (deciding
which changes belong to which spec), which is heuristic and can be indeterminate. US1 ships value
without it.

**Independent Test**: Select a spec whose changes are attributable and confirm the changeset lists the
expected files with change indicators and opens each file's diff; select a spec whose history is gone
(e.g., merged and branch deleted) and confirm the view explains it couldn't determine the changeset,
offering the per-file fallback (US1).

**Acceptance Scenarios**:

1. **Given** a spec whose changes are attributable, **When** the user opens its changeset, **Then**
   the view lists the changed files with per-file change indicators, ordered by name.
2. **Given** a listed file in the changeset, **When** the user selects it, **Then** its before/after
   comparison opens.
3. **Given** a spec whose attribution cannot be determined, **When** the user opens its changeset,
   **Then** the view states it couldn't determine the changes (and why, briefly) and still allows
   per-file "Open changes" (US1) where possible.
4. **Given** attribution is ambiguous (more than one candidate basis), **When** the changeset is
   built, **Then** the basis actually used is indicated to the user so the result is interpretable.

---

### Edge Cases

- **No version control**: the workspace isn't under version control → both actions report
  unavailability, never an error.
- **File never changed / brand-new / deleted**: "Open changes" degrades to a clear message; a deleted
  file's comparison shows removal rather than failing.
- **History rewritten/squashed/merged, branch deleted**: US2 attribution returns "couldn't
  determine"; US1 per-file changes may still work against available history.
- **Renamed/moved files**: a file shown in the list may have been renamed in history; the feature
  should still show its changes or clearly say it can't, never silently show the wrong file.
- **Uncommitted local edits**: before/after should reflect a sensible, stated baseline (e.g., working
  tree vs. the attributed baseline) rather than an unexplained comparison.
- **Very large changeset (100s of files)**: US2 stays responsive and readable (scrolls; does not
  freeze the panel).
- **Binary/non-text files**: comparison degrades to the editor's standard handling; no crash.
- **Non-spec selection (edge selected)**: neither diff affordance appears.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Each file in a spec's Files list MUST offer an "Open changes" action that opens that
  file's before/after comparison in the editor's own diff view (reuse, not a bespoke renderer).
- **FR-002**: The feature MUST be read-only: viewing diffs or changesets MUST NOT create, modify,
  move, or delete any workspace file, and MUST NOT alter version-control state.
- **FR-003**: The feature MUST work fully offline using only local version-control data; it MUST make
  no network calls and MUST remain telemetry-free.
- **FR-004**: When a file has no recorded changes, or the workspace has no version-control history, the
  feature MUST degrade to a clear, non-error message and leave the map/panel unchanged.
- **FR-005**: The feature MUST provide a spec-level changeset view listing all files attributed to a
  selected spec, each with a per-file change indicator and each openable to its before/after
  comparison, ordered deterministically by file name.
- **FR-006**: The system MUST attribute changes to a spec using a documented, **toggleable** heuristic,
  and MUST degrade gracefully to "couldn't determine" (never a wrong or fabricated changeset) when the
  basis is unavailable. The default basis is a two-step fallback: (1) primary — the feature branch
  named after the spec's folder, compared against its base (leveraging feature 009's folder-name
  identity); (2) fallback — when that branch is absent (merged/deleted), the commit range from the
  first change that introduced the spec's folder to the current state; (3) when neither is available,
  report "couldn't determine" and offer the per-file action (US1) where possible.
- **FR-007**: When a changeset is produced, the system MUST indicate which attribution basis was used
  (and, when indeterminate, briefly why), so the result is interpretable.
- **FR-008**: The before/after comparison MUST use a clearly defined baseline and state it to the user.
  The definition is: **"before"** = the spec's starting point (per the FR-006 attribution basis) and
  **"after"** = the current state (latest committed state / working tree), so the diff shows the
  cumulative change the spec has produced to date.
- **FR-009**: Both affordances MUST appear only for a selected spec (never for an edge/relationship
  selection) and MUST reflect the currently selected spec.
- **FR-010**: The feature MUST NOT be a precondition for the rest of the extension: with version
  control absent or attribution indeterminate, the map, Files list (011), and all other panels MUST
  continue to function.
- **FR-011**: The feature MUST tolerate malformed/partial version-control state without throwing,
  crashing the view, or blocking other panel content (resilient degradation).

### Key Entities *(include if feature involves data)*

- **File change**: the before/after state of one file attributed to a spec. Attributes: display path,
  change kind (added/modified/removed/renamed), and a reference the editor can open as a comparison.
- **Spec changeset**: the set of file changes attributed to one selected spec, plus the attribution
  basis used and a determinacy status (determined / couldn't-determine + reason).
- **Attribution basis**: the documented rule used to decide which changes belong to a spec (e.g.
  spec-named branch, commit range, or merge commit) — toggleable, with a graceful "unavailable" state.
- **Selected spec**: the specification currently shown in the detail panel; owns the changeset and the
  per-file "Open changes" affordances alongside its 011 Files list.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From a selected spec, a user can open any listed file's before/after comparison in the
  editor without manually navigating version-control history.
- **SC-002**: For a spec with attributable history, the user can see, in one place, the complete set of
  files that changed to fulfill it, and open each one's comparison.
- **SC-003**: Every failure mode — no version control, no changes, indeterminate attribution, malformed
  history — results in a clear message and zero crashes across the full spec set (100% graceful).
- **SC-004**: The user can always tell what a shown diff means: the before/after baseline and (for a
  changeset) the attribution basis are stated on screen.
- **SC-005**: Enabling, using, or failing this feature never writes to the workspace or changes
  version-control state (0 mutations), and never makes a network call (0 requests).
- **SC-006**: With version control absent or attribution indeterminate, all pre-existing surfaces (map,
  Files list, other panels) remain fully usable.

## Assumptions

- This feature builds directly on feature 011's Files list; the per-file "Open changes" action attaches
  to those same entries.
- Version control is present in typical target workspaces, but its absence is a supported, gracefully
  handled state — full value on the common case, no hard dependency for the rest of the extension.
- The feature **complements** the editor's existing diff/Timeline rather than reinventing a diff
  renderer: it decides *what* to compare and asks the editor to display it.
- "Fulfill a spec" changes are those attributable to the spec via the chosen basis (FR-006); this is
  distinct from 011's artifact-derived file list, which needs no version control.
- Introducing version control as a data source is an intentional, scoped expansion for this feature
  only; it stays read-only and offline, consistent with the project's privacy posture.
- Change ordering in the changeset is a deterministic ascending sort by file name, consistent with the
  011 Files list.
