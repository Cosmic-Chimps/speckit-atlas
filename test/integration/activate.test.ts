import * as vscode from "vscode";
import assert from "node:assert/strict";
import { getSelf, runAll, test } from "./harness.js";
import { run as runOfflineReadonly } from "./offline-readonly.test.js";

/**
 * US1 (E-1, E-2) + the runtime read-only guarantee (US3, run in the same host).
 * Opened on fixtures/vanilla-speckit.
 */
export async function run(): Promise<void> {
  test("E-1: extension activates in a Spec Kit workspace", async () => {
    const ext = getSelf();
    assert.ok(ext, "extension should be present in the host");
    await ext.activate();
    assert.equal(ext.isActive, true);
  });

  test("E-2: the namespaced commands are contributed and registered", async () => {
    const ext = getSelf();
    assert.ok(ext);
    const contributed = (
      ext.packageJSON as { contributes: { commands: { command: string }[] } }
    ).contributes.commands
      .map((c) => c.command)
      .sort();
    assert.deepEqual(contributed, [
      "speckitAtlas.openMap",
      "speckitAtlas.refresh",
      "speckitAtlas.setupMcpClient",
    ]);
    // Every contributed command is namespaced under speckitAtlas.*
    assert.ok(contributed.every((c) => c.startsWith("speckitAtlas.")));

    const registered = await vscode.commands.getCommands(true);
    assert.ok(registered.includes("speckitAtlas.openMap"));
    assert.ok(registered.includes("speckitAtlas.refresh"));
    assert.ok(registered.includes("speckitAtlas.setupMcpClient"));
  });

  test("E-1b: focusing and refreshing the Map view do not throw", async () => {
    await vscode.commands.executeCommand("speckitAtlas.openMap");
    await vscode.commands.executeCommand("speckitAtlas.refresh");
  });

  await runAll("qualifying");

  // Same host, same qualifying workspace — assert the read-only guarantee (T028).
  await runOfflineReadonly();
}
