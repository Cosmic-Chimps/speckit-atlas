/**
 * Feature 012 — minimal typed surface of the built-in VS Code Git extension API
 * (`vscode.git`, `getAPI(1)`). Types only; no runtime code. Curated subset of the official
 * microsoft/vscode `extensions/git/src/api/git.d.ts` — just what `gitChanges.ts` consumes.
 */
import type { Uri, Event } from "vscode";

export interface GitExtension {
  readonly enabled: boolean;
  readonly onDidChangeEnablement: Event<boolean>;
  getAPI(version: 1): API;
}

export interface API {
  readonly state: "uninitialized" | "initialized";
  readonly repositories: Repository[];
  getRepository(uri: Uri): Repository | null;
}

export const enum Status {
  INDEX_MODIFIED,
  INDEX_ADDED,
  INDEX_DELETED,
  INDEX_RENAMED,
  INDEX_COPIED,
  MODIFIED,
  DELETED,
  UNTRACKED,
  IGNORED,
  INTENT_TO_ADD,
  INTENT_TO_RENAME,
  TYPE_CHANGED,
  ADDED_BY_US,
  ADDED_BY_THEM,
  DELETED_BY_US,
  DELETED_BY_THEM,
  BOTH_ADDED,
  BOTH_DELETED,
  BOTH_MODIFIED,
}

export interface Change {
  /** The current uri (the "after"/renamed target). */
  readonly uri: Uri;
  /** The original uri (the "before"/pre-rename source). */
  readonly originalUri: Uri;
  readonly renameUri: Uri | undefined;
  readonly status: Status;
}

export interface Commit {
  readonly hash: string;
  readonly message: string;
  readonly parents: string[];
}

export interface Ref {
  readonly type: number;
  readonly name?: string;
  readonly commit?: string;
  readonly remote?: string;
}

export interface RepositoryState {
  readonly HEAD: { readonly name?: string; readonly commit?: string } | undefined;
  readonly refs: Ref[];
}

export interface LogOptions {
  readonly maxEntries?: number;
  readonly path?: string;
  readonly reverse?: boolean;
  readonly range?: string;
}

export interface BranchQuery {
  readonly remote?: boolean;
  readonly pattern?: string;
  readonly count?: number;
  readonly contains?: string;
}

export interface Repository {
  readonly rootUri: Uri;
  readonly state: RepositoryState;
  getMergeBase(ref1: string, ref2: string): Promise<string | undefined>;
  log(options?: LogOptions): Promise<Commit[]>;
  /** Changes between two refs. */
  diffBetween(ref1: string, ref2: string): Promise<Change[]>;
  /** Changes between a ref and the working tree. */
  diffWith(ref: string): Promise<Change[]>;
  getBranches(query: BranchQuery): Promise<Ref[]>;
  show(ref: string, path: string): Promise<string>;
}
