import * as vscode from "vscode";
import assert from "node:assert/strict";
import { getSelf, runAll, test } from "./harness.js";
import type { LayoutApiLike } from "./layoutApi.js";

/** US2 (feature 006): hand-placed positions survive close/reopen and incremental updates. */
export async function run(): Promise<void> {
  async function api(): Promise<LayoutApiLike> {
    const ext = getSelf();
    assert.ok(ext, "extension present");
    return (await ext.activate()) as LayoutApiLike;
  }

  test("L4 / SC-005: a dragged position is persisted", async () => {
    const a = await api();
    await a.refresh();
    const dragged = a.getGraph().projects[0].nodes[0].id;
    a.simulatePersistLayout({
      type: "persistLayout",
      projectId: "__all__",
      positions: { [dragged]: { x: 777, y: 333 } },
      viewport: { pan: { x: 0, y: 0 }, zoom: 1 },
    });
    assert.deepEqual(
      a.getSavedLayout().projects["__all__"].positions[dragged],
      { x: 777, y: 333 },
      "manual drag captured",
    );
  });

  test("L5: an incremental spec change does not clear the saved layout", async () => {
    const a = await api();
    await a.refresh();
    const proj = a.getGraph().projects[0];
    const dragged = proj.nodes[0].id;
    const betaUri = vscode.Uri.joinPath(
      vscode.Uri.parse(proj.projectId),
      "specs",
      "002-beta",
      "spec.md",
    );
    const original = await vscode.workspace.fs.readFile(betaUri);
    try {
      await vscode.workspace.fs.writeFile(
        betaUri,
        Buffer.from("# Feature Specification: Beta\n\n**Status**: Draft\n"),
      );
      await a.notifyFileChanged(betaUri.fsPath);
      assert.deepEqual(
        a.getSavedLayout().projects["__all__"].positions[dragged],
        { x: 777, y: 333 },
        "same-node-set update leaves saved positions untouched",
      );
    } finally {
      await vscode.workspace.fs.writeFile(betaUri, Buffer.from(original));
    }
  });

  await runAll("layout-drag");
}
