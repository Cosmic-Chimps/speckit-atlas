# Contract: Pure attribution logic (`src/extension/attribution.ts`)

**Purity**: no `vscode`/DOM/Node-fs imports; total; deterministic. Unit-tested in plain Node.
The I/O adapter (`gitChanges.ts`) supplies the facts; this module makes the decisions.

## `candidateBranchName(folderId: string): string`

- Derive the branch name to look for from a spec's folder id (feature 009 identity).
- Same value for the same input; handles any numbering scheme (sequential `003-…`, timestamp, unnumbered).
- **Default rule**: the branch name **equals the folder id** (Spec Kit's `before_specify` hook names the
  branch after the feature). Total; empty in ⇒ empty out.

## `chooseBasis(facts): AttributionBasis`

Inputs (`facts`) — all supplied by the adapter after cheap git queries:

| Field | Type | Meaning |
|-------|------|---------|
| `setting` | `"auto" \| "branch" \| "range" \| "off"` | User toggle (FR-006). |
| `folderBranchExists` | `boolean` | A local/remote branch named `candidateBranchName` exists. |
| `branchBaseRef` | `string \| null` | merge-base(folderBranch, defaultBranch), if resolvable. |
| `firstCommitParentRef` | `string \| null` | parent of the first commit that introduced `specs/<id>/`, if found. |

Output — `AttributionBasis` (see data-model.md): `{ kind, label, beforeRef, reason }`.

### Rules (deterministic)

1. `setting === "off"` → `{ kind: "none", label: "disabled", beforeRef: null, reason: "spec-attributed changes are turned off" }`.
2. Prefer **branch** when allowed (`setting` is `auto` or `branch`) **and** `folderBranchExists` **and**
   `branchBaseRef` → `{ kind: "branch", beforeRef: branchBaseRef, label: "spec branch base" }`.
3. Else prefer **range** when allowed (`setting` is `auto` or `range`) **and** `firstCommitParentRef` →
   `{ kind: "range", beforeRef: firstCommitParentRef, label: "since the spec was added" }`.
4. Else `{ kind: "none", label: "undetermined", beforeRef: null, reason: <specific: branch gone / spec folder not in history / no default branch> }`.

### Guarantees

- **Total**: any combination of facts yields a valid `AttributionBasis`; never throws.
- **Honest**: returns `kind: "none"` rather than a guessed ref when inputs are insufficient (FR-006).
- **Deterministic**: identical facts ⇒ identical output (supports stable, testable behavior).

## Unit-test obligations (plain Node)

| Case | Facts | Expected |
|------|-------|----------|
| Branch present | `auto`, `folderBranchExists`, `branchBaseRef="abc"` | `kind:"branch"`, `beforeRef:"abc"` |
| Branch gone → range | `auto`, `!folderBranchExists`, `firstCommitParentRef="def"` | `kind:"range"`, `beforeRef:"def"` |
| Nothing resolvable | `auto`, `!folderBranchExists`, both refs null | `kind:"none"` + reason |
| Forced range ignores branch | `range`, `folderBranchExists`, `firstCommitParentRef="def"` | `kind:"range"` |
| Forced branch, base missing | `branch`, `folderBranchExists`, `branchBaseRef=null` | `kind:"none"` + reason |
| Off | `off`, any | `kind:"none"`, label `"disabled"` |
| Branch name derivation | `candidateBranchName("012-file-change-diff")` | `"012-file-change-diff"` |
| Branch name, timestamp scheme | `candidateBranchName("20260719-143022-x")` | `"20260719-143022-x"` |
