# Phase 0 Research: See what changed to fulfill a spec

Both spec `[NEEDS CLARIFICATION]` markers were resolved during `/speckit-specify` (attribution basis;
before/after baseline). Remaining unknowns are the git-access mechanism and its capability at the engine
floor — the load-bearing risk. Decisions below resolve them.

## D1 — Git access mechanism (the spike) ⭐

- **Decision**: Read git through the **built-in VS Code Git extension API** —
  `vscode.extensions.getExtension<GitExtension>("vscode.git")?.exports.getAPI(1)` — as the sole primary
  mechanism. No new runtime dependency, no `child_process`, offline, read-only. Vendor the API's
  `git.d.ts` (types only). Rendering is delegated to built-in commands `vscode.diff` (single file) and
  `vscode.changes` (native multi-file diff).
- **Rationale**: Principle V (complement, don't reinvent) + VI (offline) + III (read-only). The Git
  extension is always present in VS Code, exposes repositories, refs, and diff data, and — critically —
  its virtual `git:` document URIs let `vscode.diff` render a historical version against the working tree
  with zero custom rendering.
- **Capability spike (MUST run first in implementation)** — verify at `engines.vscode ^1.101.0` that the
  API provides, per `Repository`:
  - `getMergeBase(ref1, ref2)` — to find a folder-named branch's base (the "before" for the branch basis).
  - `log({ path, maxEntries, reverse })` or equivalent — to find the **first** commit that introduced
    `specs/<id>/` (the "before" for the commit-range fallback).
  - `diffBetween(ref1, ref2)` / `diffWith(ref)` — to list changed files (and per-file change kind) in a range.
  - a way to obtain an **openable** `git:` URI for `(path, ref)` so `vscode.diff(before, after, title)`
    renders — via the API's URI helper (e.g. `toGitUri`) or `Repository.show(ref, path)` + a read-only
    virtual document if no URI helper exists.
- **Fallback (documented, still read-only/offline)**: if a specific *ref-resolution* query is missing
  from the API (e.g. path-filtered first-commit), shell a **narrow, read-only** `git` invocation for that
  query only (`git merge-base`, `git log --diff-filter --reverse -- <path>`, `git diff --name-status`).
  Never a write subcommand. Diff *rendering* always stays in the editor. This confines any process I/O to
  ref math inside `gitChanges.ts`.
- **Alternatives considered**: (a) a git library such as `simple-git`/`isomorphic-git` — rejected: new
  dependency + bundle size for what the built-in API already provides. (b) Always shell out to `git` —
  rejected as primary: process spawning, platform quoting, and PATH concerns for data the API exposes.

## D2 — Attribution basis (resolved in spec FR-006; mechanics here)

- **Decision**: Two-step, per the clarified spec. **Primary**: the feature branch named after the spec's
  folder id (feature 009 identity) — resolve `base = getMergeBase(folderBranch, defaultBranch)`; range =
  `base..folderBranch` (or `base..HEAD` when that branch is the current one). **Fallback** (branch
  absent — merged/deleted): `before = parent of the first commit that introduced specs/<id>/`, `after =
  HEAD`. **Neither** → `couldn't-determine`.
- **Default branch resolution**: prefer the repo's configured default (`origin/HEAD` target) else common
  names (`main`, `master`) that exist; if indeterminate, fall back to the commit-range basis. Documented,
  never guessed silently.
- **Rationale**: precise while the branch lives; survives merge via the range; honest when history is
  gone. The folder→branch mapping reuses 009 and handles any numbering scheme.
- **Toggle (FR-006)**: a setting `speckitAtlas.diff.attribution` = `auto` (default: branch→range),
  `branch`, `range`, or `off` (disables US2 changeset; US1 per-file still works where a diff exists).
- **Alternatives considered**: merge-commit-only (rejected as default — often undetectable after
  squash/rebase); range-only (kept as the fallback/an explicit option, not the default — noisier).

## D3 — Before/after baseline (resolved in spec FR-008; mechanics here)

- **Decision**: `before` = the basis's starting ref (branch base, or parent-of-first-commit); `after` =
  current state — **working tree** for a file that exists on disk (so in-progress edits show), else
  `HEAD`. US1 single-file diff = `vscode.diff(gitUri(file@before), fileUri, title)`. The title states the
  basis + baseline (FR-004/007) e.g. `heuristics.ts (since 012 branch base)`.
- **Rationale**: matches the clarified "cumulative change the spec produced to date"; using the working
  tree as "after" is the most useful and matches how the editor's own diffs read.
- **Edge handling**: added file → left side empty; deleted file → right side empty (show removal);
  renamed → follow rename if the API/`--follow` supports it, else show best-effort and label it.

## D4 — US2 rendering: native multi-file diff, not a custom changeset panel

- **Decision**: US2 opens the editor's **native multi-file diff** via
  `vscode.commands.executeCommand("vscode.changes", title, resources)` where each resource is
  `[uri, beforeUri, afterUri]` for every file in the attributed range. The attribution basis is stated in
  the `title` and echoed via an info message (FR-007). No custom changeset list is rendered in the panel.
- **Rationale**: Principle V — the native multi-diff editor already lists files with per-file change
  indicators and opens each comparison (satisfies FR-005) and scales to hundreds of files (edge case).
  Building a webview changeset renderer would duplicate it.
- **Consequence**: US2's file set is the git-attributed changed set (may differ from 011's
  artifact-derived Files list — expected; 011 = referenced, 012 = actually changed). The detail panel
  only needs a single **"See all changes"** affordance, not a list.
- **Alternatives considered**: a custom changeset section in the detail panel — rejected (reinvents the
  multi-diff editor; more webview surface, worse scaling).

## D5 — Where the logic lives (purity)

- **Decision**: A pure, `vscode`-free `src/extension/attribution.ts` owns the decisions that need no I/O:
  `candidateBranchName(folderId)`, `chooseBasis({ folderBranchExists, defaultBranchKnown, firstCommitFound })
  → { kind: "branch" | "range" | "none"; ... }`, and the human-readable basis label. The I/O adapter
  `gitChanges.ts` gathers the availability facts and executes the resolved plan.
- **Rationale**: Principle I — the branching decisions are the testable core of the heuristic; keep them
  pure and unit-tested in plain Node (precedent: `layoutModel.ts`). `gitChanges.ts` stays a thin
  translator over the Git API.

## D6 — Degradation, safety, and the toggle

- **Decision**: Every failure path (no Git extension / no repo / detached or unknown refs / no changes /
  indeterminate attribution / malformed history) resolves to a `vscode.window.showInformationMessage`
  and no state change (FR-004/010/011). The adapter calls **only** read APIs; a lightweight guard/asserts
  no write command name is used. The `speckitAtlas.diff.attribution: "off"` setting disables US2.
- **Rationale**: Principles II & III. Keeps the map, 011 Files list, and other panels fully functional
  when git is absent or attribution fails (SC-006).
