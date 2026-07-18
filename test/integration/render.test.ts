import * as vscode from "vscode";
import assert from "node:assert/strict";
import { getSelf, runAll, test, waitFor } from "./harness.js";
import type { ControlsToHost } from "../../src/webview/protocol.js";
import type { WorkspaceGraph } from "../../src/core/index.js";

interface AtlasApiLike {
  refresh(): Promise<unknown>;
  openMap(): void;
  isPanelOpen(): boolean;
  getPanelDiagnostics(): { nodeCount: number; edgeCount: number; ok: boolean } | undefined;
  getGraph(): WorkspaceGraph;
  openSpec(nodeId: string, projectId: string): Promise<void>;
  applyControlMessage(msg: ControlsToHost): void;
  notifyFileChanged(changedPath: string): Promise<void>;
}

async function api(): Promise<AtlasApiLike> {
  const ext = getSelf();
  assert.ok(ext, "extension present");
  return (await ext.activate()) as AtlasApiLike;
}

/** Opened on fixtures/graph/render-demo (001-alpha→002-beta link; 001-alpha↔003-gamma entity). */
export async function run(): Promise<void> {
  test("R-1: openMap creates a center panel", async () => {
    const a = await api();
    await a.refresh();
    a.openMap();
    assert.equal(a.isPanelOpen(), true);
  });

  test("R-5 / I1: panel renders nodes+edges and Cytoscape initializes under the CSP", async () => {
    const a = await api();
    await a.refresh();
    a.openMap();
    await waitFor(() => a.getPanelDiagnostics() !== undefined, 8000);
    const d = a.getPanelDiagnostics();
    assert.ok(d, "panel reported render diagnostics");
    assert.equal(d.ok, true, "cytoscape initialized under CSP (no eval error)");
    assert.equal(d.nodeCount, 3, "three features");
    assert.equal(d.edgeCount, 2, "definitive link + medium shared-entity");
  });

  test("R-13: toggling a heuristic changes the edge set; links cannot be disabled", async () => {
    const a = await api();
    await a.refresh();
    const edges = () => a.getGraph().projects[0].edges;
    const before = edges().length;
    assert.equal(before, 2);

    a.applyControlMessage({ type: "setOption", key: "sharedEntities", value: false });
    assert.ok(edges().length < before, "disabling sharedEntities removed its edge");
    assert.ok(!edges().some((e) => e.heuristic === "shared-entity"));

    a.applyControlMessage({ type: "setOption", key: "sharedEntities", value: true });
    assert.equal(edges().length, before, "re-enabling restores it");

    a.applyControlMessage({ type: "setOption", key: "links", value: false });
    assert.ok(
      edges().some((e) => e.heuristic === "link"),
      "links locked on",
    );
  });

  test("R-11 / SC-005: open spec opens the correct file read-only; missing is handled", async () => {
    const a = await api();
    await a.refresh();
    const proj = a.getGraph().projects[0];
    await a.openSpec("001-alpha", proj.projectId);
    const active = vscode.window.activeTextEditor?.document.uri.path ?? "";
    assert.ok(active.endsWith("specs/001-alpha/spec.md"), `opened ${active}`);
    // Missing target must not throw.
    await assert.doesNotReject(() => a.openSpec("999-nope", proj.projectId));
  });

  test("R-17 / SC-003: a single spec change updates the model incrementally", async () => {
    const a = await api();
    await a.refresh();
    const proj = a.getGraph().projects[0];
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
      const beta = a.getGraph().projects[0].nodes.find((n) => n.id === "002-beta");
      assert.equal(beta?.status, "Draft", "incremental re-parse picked up the new status");
      // node set unchanged → still 3 nodes
      assert.equal(a.getGraph().projects[0].nodes.length, 3);
    } finally {
      await vscode.workspace.fs.writeFile(betaUri, Buffer.from(original));
    }
  });

  await runAll("render");
}
