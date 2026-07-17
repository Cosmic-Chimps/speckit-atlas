import assert from "node:assert/strict";
import { delay, getSelf, runAll, test } from "./harness.js";

/**
 * US2 (E-3, SC-003): opened on fixtures/plain-project, the extension must not
 * activate — none of its `workspaceContains` signals match.
 */
export async function run(): Promise<void> {
  test("E-3: extension does not activate in a non-Spec Kit workspace", async () => {
    // Give the host a moment to settle any activation events.
    await delay(500);
    const ext = getSelf();
    assert.ok(ext, "extension is installed…");
    assert.equal(ext.isActive, false, "…but must remain inactive on a plain project");
  });

  await runAll("dormant");
}
