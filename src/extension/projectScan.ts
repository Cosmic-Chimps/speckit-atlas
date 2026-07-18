import * as vscode from "vscode";
import type { FeatureInput, ProjectSnapshot } from "../core/index.js";

/**
 * Two-layer, read-only scan of the workspace into ProjectSnapshots for the core.
 * Layer 1 (tree): enumerate feature folders and which standard artifacts exist — no
 * file contents read. Layer 2 (content): read only the markdown files the parser needs.
 * All I/O lives here so `core/` stays pure (Principle I); all operations are read-only.
 */

/** Files whose contents the parser reads (for title/status/tasks/edges). */
const CONTENT_FILES = [
  "spec.md",
  "plan.md",
  "tasks.md",
  "data-model.md",
  "research.md",
  "quickstart.md",
];
/** Standard artifacts recorded for the completeness attribute (tree only). */
const ARTIFACT_FILES = ["spec", "plan", "tasks", "research", "data-model", "quickstart"];
const ARTIFACT_DIRS = ["contracts", "checklists"];

export async function scanWorkspaceProjects(): Promise<ProjectSnapshot[]> {
  const folders = vscode.workspace.workspaceFolders ?? [];
  const snapshots: ProjectSnapshot[] = [];
  for (const folder of folders) {
    const features = await scanFeatures(vscode.Uri.joinPath(folder.uri, "specs"));
    if (features.length > 0) {
      snapshots.push({ projectId: folder.uri.toString(), name: folder.name, features });
    }
  }
  return snapshots;
}

/**
 * Incremental rescan for a single changed path (SC-003): re-read ONLY the affected
 * feature and splice it into the current snapshots. Returns null when the change is
 * structural (a new/removed feature, or a non-feature path) so the caller can fall back
 * to a full `scanWorkspaceProjects`.
 */
export async function rescanForChange(
  changedPath: string,
  current: readonly ProjectSnapshot[],
): Promise<ProjectSnapshot[] | null> {
  const norm = changedPath.replace(/\\/g, "/");
  const idx = norm.indexOf("/specs/");
  if (idx < 0) {
    return null; // not under specs/ (e.g. .specify change) → full rescan
  }
  const featureId = norm.slice(idx + "/specs/".length).split("/")[0];
  if (!featureId) {
    return null;
  }

  for (let i = 0; i < current.length; i++) {
    const snap = current[i];
    const feature = snap.features.find((f) => f.id === featureId);
    if (!feature) {
      continue;
    }
    // Re-scan just this feature under the known project root.
    const dir = vscode.Uri.joinPath(vscode.Uri.parse(snap.projectId), "specs", featureId);
    const refreshed = await scanFeature(dir, featureId);
    const features = snap.features.map((f) => (f.id === featureId ? refreshed : f));
    const next = [...current];
    next[i] = { ...snap, features };
    return next;
  }
  return null; // feature not previously known → structural change → full rescan
}

async function scanFeatures(specsUri: vscode.Uri): Promise<FeatureInput[]> {
  let entries: [string, vscode.FileType][];
  try {
    entries = await vscode.workspace.fs.readDirectory(specsUri);
  } catch {
    return []; // no specs/ directory
  }
  const features: FeatureInput[] = [];
  for (const [name, type] of entries) {
    if (type !== vscode.FileType.Directory) {
      continue;
    }
    features.push(await scanFeature(vscode.Uri.joinPath(specsUri, name), name));
  }
  return features;
}

async function scanFeature(dir: vscode.Uri, id: string): Promise<FeatureInput> {
  const numberMatch = id.match(/^(\d{3})-/);
  const number = numberMatch ? numberMatch[1] : null;

  // Layer 1: tree — which artifacts exist (no contents).
  const artifacts: string[] = [];
  for (const base of ARTIFACT_FILES) {
    if (await exists(vscode.Uri.joinPath(dir, `${base}.md`))) {
      artifacts.push(base);
    }
  }
  for (const d of ARTIFACT_DIRS) {
    if (await isDir(vscode.Uri.joinPath(dir, d))) {
      artifacts.push(d);
    }
  }

  // Layer 2: content — read only the files the parser needs.
  const files: Record<string, string> = {};
  for (const fname of CONTENT_FILES) {
    const text = await readText(vscode.Uri.joinPath(dir, fname));
    if (text !== null) {
      files[fname] = text;
    }
  }

  return { id, number, artifacts, files };
}

async function exists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

async function isDir(uri: vscode.Uri): Promise<boolean> {
  try {
    return (await vscode.workspace.fs.stat(uri)).type === vscode.FileType.Directory;
  } catch {
    return false;
  }
}

async function readText(uri: vscode.Uri): Promise<string | null> {
  try {
    return new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
  } catch {
    return null;
  }
}
