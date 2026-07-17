import * as vscode from "vscode";
import assert from "node:assert/strict";
import { delay, getSelf, runAll, test } from "./harness.js";

/**
 * US3 (SC-004, FR-006): activating and refreshing must not write to the workspace.
 * Network-absence is additionally enforced statically (test/contracts/no-telemetry).
 */
export async function run(): Promise<void> {
  test("SC-004: activation + refresh create/modify/delete no workspace files", async () => {
    const folder = vscode.workspace.workspaceFolders?.[0];
    assert.ok(folder, "a workspace folder should be open");

    const before = await snapshot(folder.uri);

    const ext = getSelf();
    assert.ok(ext);
    await ext.activate();
    await vscode.commands.executeCommand("speckitAtlas.refresh");
    await delay(300);

    const after = await snapshot(folder.uri);
    assert.deepEqual(after, before, "no workspace file should change");
  });

  await runAll("offline-readonly");
}

/** Recursive relative-path → byte-size map of a folder (small fixtures only). */
async function snapshot(root: vscode.Uri): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  await walk(root, "", out);
  return out;
}

async function walk(dir: vscode.Uri, prefix: string, out: Record<string, number>): Promise<void> {
  const children = await vscode.workspace.fs.readDirectory(dir);
  for (const [name, type] of children) {
    const rel = prefix ? `${prefix}/${name}` : name;
    const child = vscode.Uri.joinPath(dir, name);
    if (type === vscode.FileType.Directory) {
      await walk(child, rel, out);
    } else {
      const stat = await vscode.workspace.fs.stat(child);
      out[rel] = stat.size;
    }
  }
}
