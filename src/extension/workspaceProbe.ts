import * as vscode from "vscode";
import type { WorkspaceRoot } from "../core/index.js";

/**
 * The ONLY module that touches the file system. It probes each workspace folder for
 * the cheap, bounded set of entries the pure core needs to classify it, then hands
 * plain data to `core/`. All operations are read-only (Principle III) and use the
 * host's virtual file system so they work for any workspace scheme.
 */
export async function probeWorkspaceRoots(): Promise<WorkspaceRoot[]> {
  const folders = vscode.workspace.workspaceFolders ?? [];
  const roots = await Promise.all(
    folders.map(async (folder) => {
      const entries = await probeFolder(folder.uri);
      return { id: folder.uri.toString(), name: folder.name, entries } satisfies WorkspaceRoot;
    }),
  );
  return roots;
}

/** Probe a single folder. Never throws; a failed probe yields whatever was found. */
async function probeFolder(root: vscode.Uri): Promise<string[]> {
  const entries: string[] = [];

  if (await exists(vscode.Uri.joinPath(root, ".specify"))) {
    entries.push(".specify");
  }

  // Shallow scan of specs/*/spec.md — one level deep only, so the cost stays bounded
  // even on very large workspaces (Principle IV).
  const specsUri = vscode.Uri.joinPath(root, "specs");
  try {
    const children = await vscode.workspace.fs.readDirectory(specsUri);
    for (const [name, type] of children) {
      if (type === vscode.FileType.Directory) {
        if (await exists(vscode.Uri.joinPath(specsUri, name, "spec.md"))) {
          entries.push(`specs/${name}/spec.md`);
        }
      }
    }
  } catch {
    // No specs/ directory (or unreadable) — not an error; just fewer signals.
  }

  return entries;
}

async function exists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}
