import * as vscode from "vscode";
import assert from "node:assert/strict";
import { getSelf, runAll, test } from "./harness.js";

/**
 * US2 edge case: a multi-root workspace where only one root qualifies. The extension
 * activates once and does not fail on the non-qualifying root. (Which roots qualify
 * is asserted authoritatively by the core unit tests.)
 */
export async function run(): Promise<void> {
  test("multi-root: two folders are open", () => {
    const folders = vscode.workspace.workspaceFolders ?? [];
    assert.equal(folders.length, 2);
  });

  test("multi-root: extension activates once and refresh does not throw", async () => {
    const ext = getSelf();
    assert.ok(ext);
    await ext.activate();
    assert.equal(ext.isActive, true);
    await vscode.commands.executeCommand("speckitAtlas.refresh");
  });

  await runAll("multiroot");
}
