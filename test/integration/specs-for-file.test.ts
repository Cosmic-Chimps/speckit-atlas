import assert from "node:assert/strict";
import * as vscode from "vscode";
import { getSelf, runAll, test, waitFor } from "./harness.js";
import type { SpecsForFile, WorkspaceGraph } from "../../src/core/index.js";

/**
 * Feature 013 — Show Specs for File (reverse traceability), host relay + API smoke.
 *
 * The interactive quick pick cannot be driven headlessly, so the happy paths are exercised
 * through the AtlasApi hooks (which mirror the command's core call and its map action); the
 * pure match logic is covered exhaustively by test/core/query.specs-for-file.test.ts. The real
 * command is executed only for the degradation path (no owning project → info message).
 *
 * Fixture: fixtures/graph/render-demo — 001-alpha references `src/core/graph/heuristics.ts`
 * and `src/webview/map/elements.ts` in its tasks.md.
 */
interface AtlasApiLike {
  refresh(): Promise<unknown>;
  openMap(): void;
  getPanelDiagnostics(): { nodeCount: number; edgeCount: number; ok: boolean } | undefined;
  getGraph(): WorkspaceGraph;
  specsForFile(path: string, projectId?: string): SpecsForFile;
  revealSpecOnMap(nodeId: string): void;
  isFocusModeOn(): boolean;
  getSelection(): { nodeId: string; relatedCount: number } | null;
  openSpec(nodeId: string, projectId: string): Promise<void>;
}

async function api(): Promise<AtlasApiLike> {
  const ext = getSelf();
  assert.ok(ext, "extension present");
  return (await ext.activate()) as AtlasApiLike;
}

async function healthyPanel(a: AtlasApiLike): Promise<void> {
  await waitFor(() => a.getPanelDiagnostics()?.ok === true, 8000);
  assert.ok(a.getPanelDiagnostics()?.ok, "panel reports a healthy render");
}

function projectId(a: AtlasApiLike): string {
  return a.getGraph().projects[0].projectId;
}

export async function run(): Promise<void> {
  test("SFFI-1: an exact code reference resolves to the referencing spec", async () => {
    const a = await api();
    await a.refresh();
    const r = a.specsForFile("src/core/graph/heuristics.ts", projectId(a));
    assert.equal(r.path, "src/core/graph/heuristics.ts");
    assert.ok(
      r.matches.some((m) => m.specId === "001-alpha" && m.matchKind === "exact"),
      "001-alpha is an exact match",
    );
  });

  test("SFFI-2: a file with no exact ref falls back to a folder match (labeled 'folder')", async () => {
    const a = await api();
    await a.refresh();
    const r = a.specsForFile("src/core/graph/does-not-exist.ts", projectId(a));
    assert.ok(
      r.matches.some((m) => m.specId === "001-alpha" && m.matchKind === "folder"),
      "001-alpha matches by containing folder src/core/graph/",
    );
  });

  test("SFFI-3: an unreferenced root-level file yields no matches (no throw)", async () => {
    const a = await api();
    await a.refresh();
    assert.deepEqual(a.specsForFile("totally-unrelated.ts", projectId(a)).matches, []);
  });

  test("SFFI-4: Reveal + focus selects the spec and enables focus mode; panel stays healthy", async () => {
    const a = await api();
    await a.refresh();
    a.openMap();
    await healthyPanel(a);
    assert.doesNotThrow(() => a.revealSpecOnMap("001-alpha"));
    assert.equal(a.getSelection()?.nodeId, "001-alpha", "spec became the single selection");
    assert.equal(a.isFocusModeOn(), true, "focus mode enabled by the reveal action");
    await healthyPanel(a);
  });

  test("SFFI-5: Open spec opens the spec read-only without touching the workspace", async () => {
    const a = await api();
    await a.refresh();
    const pid = projectId(a);
    const specUri = vscode.Uri.joinPath(vscode.Uri.parse(pid), "specs", "001-alpha", "spec.md");
    const before = await vscode.workspace.fs.stat(specUri);
    await a.openSpec("001-alpha", pid);
    const after = await vscode.workspace.fs.stat(specUri);
    assert.equal(after.mtime, before.mtime, "opening the spec did not modify it (read-only)");
  });

  test("SFFI-6: the command degrades cleanly for a file outside any project (no throw)", async () => {
    const a = await api();
    await a.refresh();
    a.openMap();
    await healthyPanel(a);
    // A file outside the workspace resolves to no owning project → info message, no quick pick.
    await assert.doesNotReject(
      vscode.commands.executeCommand(
        "speckitAtlas.showSpecsForFile",
        vscode.Uri.file("/tmp/speckit-atlas-nonexistent-file.ts"),
      ) as Promise<unknown>,
    );
    await healthyPanel(a);
  });

  await runAll("specs-for-file");
}
