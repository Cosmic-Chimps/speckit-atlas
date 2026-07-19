import assert from "node:assert/strict";
import { getSelf, runAll, test, waitFor } from "./harness.js";
import type { ControlsToHost } from "../../src/webview/protocol.js";
import type { WorkspaceGraph } from "../../src/core/index.js";

/**
 * Feature 010 — host-relay smoke for selection & focus mode.
 *
 * The webview runs in a sandboxed VS Code webview, so this suite cannot inspect
 * Cytoscape `:selected`/`display` state directly. It verifies the end-to-end RELAY
 * (`setFocusMode`/`focusSpec` reach the panel) and that the webview processes those
 * messages without crashing (the panel keeps reporting a healthy render). The
 * neighborhood/selection LOGIC is covered exhaustively by the pure unit suite
 * (test/contracts/focus-set.test.ts); the visible DOM behavior by quickstart.md.
 *
 * Fixture: fixtures/graph/render-demo — 001-alpha, 002-beta, 003-gamma;
 * edges: 001-alpha→002-beta (link), 001-alpha↔003-gamma (shared-entity).
 */
interface AtlasApiLike {
  refresh(): Promise<unknown>;
  openMap(): void;
  isPanelOpen(): boolean;
  getPanelDiagnostics(): { nodeCount: number; edgeCount: number; ok: boolean } | undefined;
  getGraph(): WorkspaceGraph;
  applyControlMessage(msg: ControlsToHost): void;
  notifyFileChanged(changedPath: string): Promise<void>;
  getSelection(): { nodeId: string; relatedCount: number } | null;
}

async function api(): Promise<AtlasApiLike> {
  const ext = getSelf();
  assert.ok(ext, "extension present");
  return (await ext.activate()) as AtlasApiLike;
}

async function healthyPanel(a: AtlasApiLike): Promise<void> {
  await waitFor(() => a.getPanelDiagnostics()?.ok === true, 8000);
  const d = a.getPanelDiagnostics();
  assert.ok(d && d.ok, "panel reports a healthy render");
  assert.equal(d.nodeCount, 3, "render-demo has three specs");
}

export async function run(): Promise<void> {
  test("SF-1: host accepts and relays setFocusMode without error; panel stays healthy", async () => {
    const a = await api();
    await a.refresh();
    a.openMap();
    await healthyPanel(a);
    // The relay (extension.ts → mapPanel.setFocusMode → focusMode message) must not throw.
    assert.doesNotThrow(() => a.applyControlMessage({ type: "setFocusMode", enabled: true }));
    assert.doesNotThrow(() => a.applyControlMessage({ type: "setFocusMode", enabled: false }));
    await healthyPanel(a);
  });

  test("SF-2: enabling focus then selecting each spec in turn keeps the panel healthy", async () => {
    const a = await api();
    await a.refresh();
    a.openMap();
    await healthyPanel(a);
    a.applyControlMessage({ type: "setFocusMode", enabled: true });
    for (const id of ["001-alpha", "002-beta", "003-gamma"]) {
      assert.doesNotThrow(() => a.applyControlMessage({ type: "focusSpec", nodeId: id }));
    }
    a.applyControlMessage({ type: "setFocusMode", enabled: false });
    await healthyPanel(a);
  });

  test("SF-3: focus mode composes with the tier/status filter (both relay, no reset, panel healthy)", async () => {
    const a = await api();
    await a.refresh();
    a.openMap();
    await healthyPanel(a);
    a.applyControlMessage({ type: "setFocusMode", enabled: true });
    a.applyControlMessage({ type: "focusSpec", nodeId: "001-alpha" });
    // Applying a dimming filter while focus is on must not error (orthogonal layers).
    assert.doesNotThrow(() =>
      a.applyControlMessage({ type: "setFilter", filterTier: ["definitive"], filterStatus: null }),
    );
    assert.doesNotThrow(() =>
      a.applyControlMessage({ type: "setFilter", filterTier: null, filterStatus: null }),
    );
    await healthyPanel(a);
  });

  test("SF-5: selecting a spec echoes the selection with its related-spec count", async () => {
    const a = await api();
    await a.refresh();
    a.openMap();
    await healthyPanel(a);
    // 001-alpha → 002-beta (link) + 001-alpha ↔ 003-gamma (shared-entity): two related specs.
    a.applyControlMessage({ type: "focusSpec", nodeId: "001-alpha" });
    assert.deepEqual(a.getSelection(), { nodeId: "001-alpha", relatedCount: 2 });
    // A leaf spec relates only back to alpha: one related spec.
    a.applyControlMessage({ type: "focusSpec", nodeId: "002-beta" });
    assert.deepEqual(a.getSelection(), { nodeId: "002-beta", relatedCount: 1 });
  });

  test("SF-6: selection persists across an incremental update; clears if the spec is gone", async () => {
    const a = await api();
    await a.refresh();
    a.openMap();
    await healthyPanel(a);
    a.applyControlMessage({ type: "focusSpec", nodeId: "003-gamma" });
    assert.equal(a.getSelection()?.nodeId, "003-gamma");

    // A node-data change (same node set) keeps the selection.
    const vscode = await import("vscode");
    const proj = a.getGraph().projects[0];
    const gammaUri = vscode.Uri.joinPath(
      vscode.Uri.parse(proj.projectId),
      "specs",
      "003-gamma",
      "spec.md",
    );
    const original = await vscode.workspace.fs.readFile(gammaUri);
    try {
      await vscode.workspace.fs.writeFile(
        gammaUri,
        Buffer.from("# Feature Specification: Gamma\n\n**Status**: Draft\n"),
      );
      await a.notifyFileChanged(gammaUri.fsPath);
      assert.equal(a.getSelection()?.nodeId, "003-gamma", "selection survived the re-parse");
    } finally {
      await vscode.workspace.fs.writeFile(gammaUri, Buffer.from(original));
      await a.notifyFileChanged(gammaUri.fsPath);
    }
  });

  test("SF-4: focus survives an incremental update; removed-selection path stays healthy", async () => {
    const a = await api();
    await a.refresh();
    a.openMap();
    await healthyPanel(a);
    a.applyControlMessage({ type: "setFocusMode", enabled: true });
    a.applyControlMessage({ type: "focusSpec", nodeId: "002-beta" });

    // A node-data change (same node set) re-renders in place; the webview re-applies focus.
    const proj = a.getGraph().projects[0];
    const vscode = await import("vscode");
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
      await healthyPanel(a);
    } finally {
      await vscode.workspace.fs.writeFile(betaUri, Buffer.from(original));
      await a.notifyFileChanged(betaUri.fsPath);
    }
  });

  await runAll("selection-focus");
}
