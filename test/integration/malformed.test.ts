import * as vscode from "vscode";
import assert from "node:assert/strict";
import { getSelf, runAll, test } from "./harness.js";

/**
 * FR-011 / spec edge case: a malformed-but-present Spec Kit workspace (has `.specify/`
 * but a broken `specs/` layout and garbage front-matter) must still activate and
 * degrade to a safe view — never an uncaught exception or a crashed host.
 */
export async function run(): Promise<void> {
  test("FR-011: malformed workspace activates without throwing", async () => {
    const ext = getSelf();
    assert.ok(ext, "extension should be present");
    await ext.activate();
    assert.equal(ext.isActive, true, "the .specify signal still activates the extension");
  });

  test("FR-011: refreshing over malformed input does not throw", async () => {
    // If probing/detection threw on the broken layout, this would reject.
    await vscode.commands.executeCommand("speckitAtlas.refresh");
  });

  await runAll("malformed");
}
