/**
 * Feature 012 — pure attribution logic for "what changed to fulfill a spec".
 *
 * This module is free of `vscode`/DOM/Node imports (Principle I) so it unit-tests in plain Node.
 * The I/O adapter (`gitChanges.ts`) gathers the git facts and this module decides the basis.
 * See specs/012-file-change-diff/contracts/attribution.md.
 */

/** How the "before" side of a spec's diff was determined. */
export type AttributionKind = "branch" | "range" | "none";

/** The user setting governing attribution (FR-006 toggle). */
export type AttributionSetting = "auto" | "branch" | "range" | "off";

/** The decided basis for a spec's before/after comparison. */
export interface AttributionBasis {
  readonly kind: AttributionKind;
  /** Human-readable, shown to the user (FR-007). */
  readonly label: string;
  /** The resolved "before" ref; null when `kind` is "none". */
  readonly beforeRef: string | null;
  /** When `kind` is "none", a brief why; otherwise null. */
  readonly reason: string | null;
}

/** Facts the adapter supplies after cheap git queries. */
export interface AttributionFacts {
  readonly setting: AttributionSetting;
  /** A branch named after the spec's folder exists. */
  readonly folderBranchExists: boolean;
  /** merge-base(folderBranch, defaultBranch), if resolvable. */
  readonly branchBaseRef: string | null;
  /** Parent of the first commit that introduced `specs/<id>/`, if found. */
  readonly firstCommitParentRef: string | null;
}

/**
 * Derive the branch name to look for from a spec's folder id (feature 009 identity). Spec Kit's
 * `before_specify` hook names the branch after the feature folder, so the branch name equals the
 * folder id under any numbering scheme (sequential, timestamp, unnumbered). Total.
 */
export function candidateBranchName(folderId: string): string {
  return typeof folderId === "string" ? folderId.trim() : "";
}

/**
 * Decide the attribution basis from the gathered facts. Deterministic and total: any combination
 * yields a valid basis, and insufficient facts yield `kind: "none"` (honest, never a guessed ref).
 */
export function chooseBasis(facts: AttributionFacts): AttributionBasis {
  const setting = facts?.setting ?? "auto";
  if (setting === "off") {
    return {
      kind: "none",
      label: "disabled",
      beforeRef: null,
      reason: "spec-attributed changes are turned off",
    };
  }

  const allowBranch = setting === "auto" || setting === "branch";
  const allowRange = setting === "auto" || setting === "range";

  if (allowBranch && facts.folderBranchExists && facts.branchBaseRef) {
    return {
      kind: "branch",
      label: "spec branch base",
      beforeRef: facts.branchBaseRef,
      reason: null,
    };
  }

  if (allowRange && facts.firstCommitParentRef) {
    return {
      kind: "range",
      label: "since the spec was added",
      beforeRef: facts.firstCommitParentRef,
      reason: null,
    };
  }

  return { kind: "none", label: "undetermined", beforeRef: null, reason: reasonFor(facts) };
}

function reasonFor(facts: AttributionFacts): string {
  if (facts.setting === "branch") {
    return facts.folderBranchExists
      ? "the spec branch exists but its base could not be resolved"
      : "no branch named after the spec was found";
  }
  if (facts.setting === "range") {
    return "the spec folder was not found in version-control history";
  }
  // auto
  if (!facts.folderBranchExists && !facts.firstCommitParentRef) {
    return "no spec branch and the spec folder was not found in history (merged/squashed or uncommitted)";
  }
  return "the change basis could not be resolved from local history";
}
