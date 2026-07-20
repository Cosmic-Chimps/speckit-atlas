import * as vscode from "vscode";
import type { API, Change, GitExtension, Repository } from "./git.js";
import {
  candidateBranchName,
  chooseBasis,
  type AttributionBasis,
  type AttributionSetting,
} from "./attribution.js";

/**
 * Feature 012 — read-only git adapter: resolves the attribution basis for a spec and opens the
 * editor's own diff views (single-file `vscode.diff`, multi-file `vscode.changes`). All I/O is
 * confined here (Principle I); it calls only read APIs and never a write/network git op
 * (Principles III & VI). Every failure degrades to an info message (Principle II).
 *
 * Spike (T003) outcome: the built-in Git extension API (`vscode.git`, getAPI(1)) supplies
 * getMergeBase / path-filtered log / diffWith and repository refs; openable "before" documents use
 * the git extension's `git:` URI scheme (`toGitUri`). No CLI fallback was required. The electron
 * integration test (`test/integration/git-changes.test.ts`) exercises this against a real repo.
 */

/** git's canonical empty-tree object — the "before" when a spec's first commit is the root commit. */
const EMPTY_TREE = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";

// Numeric values mirror the Git extension's stable `Status` enum; used defensively (change
// indicators are cosmetic). Imported as a type only, so these avoid a const-enum runtime reference.
const STATUS_INDEX_ADDED = 1;
const STATUS_INDEX_DELETED = 2;
const STATUS_INDEX_RENAMED = 3;
const STATUS_DELETED = 6;

function info(message: string): void {
  void vscode.window.showInformationMessage(`SpecKit Atlas: ${message}`);
}

function basename(p: string): string {
  return p.replace(/\/+$/, "").split("/").pop() ?? p;
}

/** Build the git extension's virtual URI for a file at a given ref (the diff "before" side). */
function toGitUri(uri: vscode.Uri, ref: string): vscode.Uri {
  return uri.with({
    scheme: "git",
    path: uri.path,
    query: JSON.stringify({ path: uri.fsPath, ref }),
  });
}

async function gitApi(): Promise<API | null> {
  const ext = vscode.extensions.getExtension<GitExtension>("vscode.git");
  if (!ext) {
    return null;
  }
  try {
    const exports = ext.isActive ? ext.exports : await ext.activate();
    return exports.getAPI(1);
  } catch {
    return null;
  }
}

async function repositoryFor(projectId: string): Promise<Repository | null> {
  const api = await gitApi();
  if (!api) {
    return null;
  }
  const uri = vscode.Uri.parse(projectId);
  return (
    api.getRepository(uri) ??
    api.repositories.find((r) => uri.path.startsWith(r.rootUri.path)) ??
    api.repositories[0] ??
    null
  );
}

function defaultBranchName(repo: Repository): string | null {
  const names = new Set(
    repo.state.refs.map((r) => r.name).filter((n): n is string => typeof n === "string"),
  );
  for (const candidate of ["main", "master", "origin/main", "origin/master"]) {
    if (names.has(candidate)) {
      return candidate;
    }
  }
  return null;
}

/** Repo-root-relative path of `<projectRoot>/specs/<id>` (repo root may differ from the workspace folder). */
function specPathInRepo(repo: Repository, projectId: string, nodeId: string): string {
  const specFolder = vscode.Uri.joinPath(vscode.Uri.parse(projectId), "specs", nodeId).path;
  const root = repo.rootUri.path.replace(/\/+$/, "");
  return specFolder.startsWith(root + "/") ? specFolder.slice(root.length + 1) : `specs/${nodeId}`;
}

async function resolveBasis(
  repo: Repository,
  nodeId: string,
  projectId: string,
  setting: AttributionSetting,
): Promise<AttributionBasis> {
  const branch = candidateBranchName(nodeId);

  let folderBranchExists = repo.state.refs.some((r) => r.name === branch);
  if (!folderBranchExists && branch) {
    const found = await repo.getBranches({ pattern: branch, count: 1 }).catch(() => []);
    folderBranchExists = found.some((r) => r.name === branch || r.name?.endsWith(`/${branch}`));
  }

  let branchBaseRef: string | null = null;
  if (folderBranchExists) {
    const def = defaultBranchName(repo);
    if (def) {
      branchBaseRef = (await repo.getMergeBase(branch, def).catch(() => undefined)) ?? null;
    }
  }

  let firstCommitParentRef: string | null = null;
  const commits = await repo
    .log({ path: specPathInRepo(repo, projectId, nodeId), reverse: true, maxEntries: 1 })
    .catch(() => []);
  if (commits.length > 0) {
    const first = commits[0];
    firstCommitParentRef = first.parents?.length > 0 ? `${first.hash}~1` : EMPTY_TREE;
  }

  return chooseBasis({ setting, folderBranchExists, branchBaseRef, firstCommitParentRef });
}

function changeKind(c: Change): "added" | "modified" | "removed" | "renamed" {
  if (c.renameUri && c.originalUri && c.renameUri.path !== c.originalUri.path) {
    return "renamed";
  }
  switch (c.status) {
    case STATUS_INDEX_ADDED:
      return "added";
    case STATUS_INDEX_DELETED:
    case STATUS_DELETED:
      return "removed";
    case STATUS_INDEX_RENAMED:
      return "renamed";
    default:
      return "modified";
  }
}

/** US1 — open one listed file's before/after diff in the editor's diff view. Read-only. */
export async function openFileDiff(
  nodeId: string,
  path: string,
  projectId: string,
  setting: AttributionSetting,
): Promise<void> {
  const repo = await repositoryFor(projectId);
  if (!repo) {
    info("changes are unavailable (no Git repository).");
    return;
  }
  const basis = await resolveBasis(repo, nodeId, projectId, setting);
  if (basis.kind === "none" || !basis.beforeRef) {
    info(`couldn't determine changes — ${basis.reason ?? basis.label}.`);
    return;
  }
  const fileUri = vscode.Uri.joinPath(vscode.Uri.parse(projectId), path);
  const changes = await repo.diffWith(basis.beforeRef).catch(() => [] as Change[]);
  const changed = changes.some(
    (c) => c.uri.path === fileUri.path || c.originalUri?.path === fileUri.path,
  );
  if (!changed) {
    info(`no changes to show for "${path}" (${basis.label}).`);
    return;
  }
  const before = toGitUri(fileUri, basis.beforeRef);
  await vscode.commands.executeCommand(
    "vscode.diff",
    before,
    fileUri,
    `${basename(path)} (since ${basis.label})`,
  );
}

/** US2 — open the spec's full attributed changeset in the native multi-file diff editor. Read-only. */
export async function showChangeset(
  nodeId: string,
  projectId: string,
  setting: AttributionSetting,
): Promise<void> {
  const repo = await repositoryFor(projectId);
  if (!repo) {
    info("changes are unavailable (no Git repository).");
    return;
  }
  const basis = await resolveBasis(repo, nodeId, projectId, setting);
  if (basis.kind === "none" || !basis.beforeRef) {
    info(
      `couldn't determine the changeset — ${basis.reason ?? basis.label}. Try "Open changes" per file.`,
    );
    return;
  }
  const changes = await repo.diffWith(basis.beforeRef).catch(() => [] as Change[]);
  if (changes.length === 0) {
    info(`no changes attributed to "${nodeId}" (${basis.label}).`);
    return;
  }
  const sorted = [...changes].sort((a, b) => {
    const byName = basename(a.uri.path)
      .toLocaleLowerCase()
      .localeCompare(basename(b.uri.path).toLocaleLowerCase());
    return byName !== 0 ? byName : a.uri.path.localeCompare(b.uri.path);
  });
  const beforeRef = basis.beforeRef;
  const resources = sorted.map(
    (c) =>
      [c.uri, toGitUri(c.originalUri ?? c.uri, beforeRef), c.uri] as [
        vscode.Uri,
        vscode.Uri,
        vscode.Uri,
      ],
  );
  await vscode.commands.executeCommand(
    "vscode.changes",
    `Changes to fulfill ${nodeId} (since ${basis.label})`,
    resources,
  );
  const kinds = sorted.map(changeKind);
  const added = kinds.filter((k) => k === "added").length;
  const removed = kinds.filter((k) => k === "removed").length;
  info(
    `${sorted.length} file(s) changed to fulfill "${nodeId}" — ${added} added, ${removed} removed (${basis.label}).`,
  );
}
