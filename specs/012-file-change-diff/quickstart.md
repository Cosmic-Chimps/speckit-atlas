# Quickstart: Validating the before/after diff feature

Validation guide. Details live in [data-model.md](./data-model.md), [research.md](./research.md), and
[contracts/](./contracts/).

## Prerequisites

- Repo built: `npm install`, `npm run compile` (or watch/build).
- A Spec Kit workspace **under git** with at least one spec that has a feature branch and/or a commit
  that introduced its `specs/<id>/` folder. The temp-repo integration fixture (below) creates one.

## 0. The spike (do this first)

Before building the adapter, confirm the built-in Git API surface at `engines.vscode ^1.101.0`
(research D1): `getMergeBase`, path-filtered first-commit `log`, `diffBetween`/`diffWith`, and an
openable `git:` diff URI (or `Repository.show` + read-only virtual doc). If any is missing, switch that
one query to the documented read-only `git` CLI fallback — rendering stays in the editor either way.

## 1. Pure unit tests (plain Node, fastest)

```bash
npm test        # or: node --test after compile:tests
```

New assertions — `attribution.ts` (see `contracts/attribution.md` table):

- `candidateBranchName` derives the branch from the folder id under any numbering scheme.
- `chooseBasis`: branch when present; range when branch gone; `none` (+ reason) when neither; `off`
  disables; forced `branch`/`range` honored; totality/determinism.

## 2. Integration (electron harness)

**Harness constraint**: `@vscode/test-electron` launches with `--disable-extensions`, which also
disables the built-in Git extension. So `test/integration/git-changes.test.ts` verifies the
**read-only, no-throw degradation contract** — the safety-critical guarantees — reliably:

| # | Scenario | Expected |
|---|----------|----------|
| 1 | `openFileDiff` with git unavailable | resolves cleanly (no throw); opens nothing; graph still available |
| 2 | `openFileDiff` with a bogus spec/path | resolves cleanly (no throw) |
| 3 | `showChangeset` with git unavailable | resolves cleanly (no throw) |
| 4 | Host still functional after both | a subsequent `refresh()` succeeds (host not wedged) |

The **basis/branch/range/diff-content** scenarios (branch→merge-base, range fallback, multi-diff
contents, `attribution: off`) require a git-backed spec workspace the harness can't provide with git
disabled — they are covered by the pure `chooseBasis` unit tests (§1) plus manual §3 below.

## 3. Manual end-to-end (Extension Development Host)

F5 on a git-backed Spec Kit workspace, open the map, select a spec, then:

| Action | Expected (maps to) |
|--------|--------------------|
| Click **Open changes** on a file with changes | Editor diff opens; title states basis/baseline (US1; FR-001/007/008) |
| Click **Open changes** on an unchanged file | "No changes to show" message (FR-004) |
| Click **See all changes** | Native multi-file diff lists attributed files; basis stated (US2; FR-005/007) |
| Select a spec whose branch was merged+deleted | Falls back to range basis, or a clear "couldn't determine" (FR-006) |
| Open on a non-git workspace | "Changes unavailable" message; map + Files list still work (FR-010; SC-006) |
| Select an edge instead of a spec | No diff affordances (FR-009) |

## 4. Read-only, offline, telemetry-free sanity

- Confirm no workspace file and no git ref/index change from any action (SC-005; Principle III).
- Confirm no network activity (Principle VI) — local git only; no remote fetch/pull.
- Confirm `media/map.js` still passes the no-network/telemetry contract scan.

## Success = all of

- Spike resolved (API path or documented CLI fallback chosen).
- Pure + integration suites green (incl. the temp-repo fixture and the read-only assertion).
- Manual table passes; zero writes, zero network, no unhandled errors on missing/indeterminate history.
