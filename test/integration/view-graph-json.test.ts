import assert from "node:assert/strict";
import * as vscode from "vscode";
import { getSelf, runAll, test, waitFor } from "./harness.js";
import type { ControlsToHost } from "../../src/webview/protocol.js";
import type { ProjectGraph, QueryResult, WorkspaceGraph } from "../../src/core/index.js";

/**
 * Feature 014 — View Graph JSON. Verifies the JSON the command produces (via the AtlasApi hook)
 * and that executing the command opens a JSON document, writing nothing to the workspace. The
 * envelope shape itself is covered by test/core/query.graph-envelope.test.ts.
 *
 * Fixture: fixtures/graph/render-demo (one project: 001-alpha, 002-beta, 003-gamma).
 */
interface AtlasApiLike {
  refresh(): Promise<unknown>;
  getGraph(): WorkspaceGraph;
  getGraphJson(): string;
  applyControlMessage(msg: ControlsToHost): void;
}

async function api(): Promise<AtlasApiLike> {
  const ext = getSelf();
  assert.ok(ext, "extension present");
  return (await ext.activate()) as AtlasApiLike;
}

export async function run(): Promise<void> {
  test("VGJ-1: getGraphJson is valid, versioned kind:'graph' JSON matching the workspace", async () => {
    const a = await api();
    await a.refresh();
    a.applyControlMessage({ type: "selectProject", projectId: null }); // All projects
    const env = JSON.parse(a.getGraphJson()) as QueryResult;
    assert.equal(env.schemaVersion, 1);
    assert.equal(env.kind, "graph");
    const data = env.data as WorkspaceGraph;
    assert.ok(Array.isArray(data.projects) && data.projects.length >= 1, "whole-workspace scope");
    assert.equal(data.projects[0].projectId, a.getGraph().projects[0].projectId);
  });

  test("VGJ-2: pretty-printed (indented) output", async () => {
    const a = await api();
    await a.refresh();
    assert.match(a.getGraphJson(), /\n {2}"schemaVersion":/, "2-space indented JSON");
  });

  test("VGJ-3: scope follows the active project selection (single ProjectGraph)", async () => {
    const a = await api();
    await a.refresh();
    const pid = a.getGraph().projects[0].projectId;
    a.applyControlMessage({ type: "selectProject", projectId: pid });
    const scoped = JSON.parse(a.getGraphJson()) as QueryResult;
    const data = scoped.data as ProjectGraph;
    assert.equal(data.projectId, pid, "data is the single selected ProjectGraph");
    assert.equal(
      Array.isArray((data as unknown as WorkspaceGraph).projects),
      false,
      "not a whole-workspace envelope when scoped",
    );

    // Back to "All projects" → whole workspace again.
    a.applyControlMessage({ type: "selectProject", projectId: null });
    const all = JSON.parse(a.getGraphJson()) as QueryResult;
    assert.ok(Array.isArray((all.data as WorkspaceGraph).projects));
  });

  test("VGJ-4: the command opens a JSON document and writes nothing to the workspace", async () => {
    const a = await api();
    await a.refresh();
    // The command handler is fire-and-forget, so poll until the untitled JSON doc appears.
    await vscode.commands.executeCommand("speckitAtlas.viewGraphJson");
    const untitledJson = (): vscode.TextDocument | undefined =>
      vscode.workspace.textDocuments.find(
        (d) => d.languageId === "json" && d.uri.scheme === "untitled",
      );
    await waitFor(() => untitledJson() !== undefined, 8000);
    const opened = untitledJson();
    assert.ok(opened, "an untitled JSON document was opened");
    assert.doesNotThrow(() => JSON.parse(opened.getText()));
    // Read-only: the produced document is untitled (unsaved) — nothing was written to disk.
    assert.equal(
      opened.isUntitled,
      true,
      "the graph JSON document is untitled (no workspace write)",
    );
  });

  await runAll("view-graph-json");
}
