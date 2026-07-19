import * as vscode from "vscode";
import * as fs from "node:fs";
import * as path from "node:path";
import assert from "node:assert/strict";
import { getSelf, runAll, test } from "./harness.js";
import type { McpServerDescriptor } from "../../src/extension/mcpProvider.js";

interface McpApiLike {
  refresh(): Promise<unknown>;
  getMcpServerDefinitions(): McpServerDescriptor[];
}

/**
 * Feature 007: the extension advertises the bundled MCP server to VS Code's registry.
 * Adapts to the fixture: asserts one descriptor per open workspace folder, so it runs
 * under both a single-root fixture and the multi-root workspace.
 */
export async function run(): Promise<void> {
  async function api(): Promise<McpApiLike> {
    const ext = getSelf();
    assert.ok(ext, "extension present");
    return (await ext.activate()) as McpApiLike;
  }

  test("MCP-A: the MCP server-definition provider API is present at the engine floor", () => {
    assert.equal(
      typeof vscode.lm.registerMcpServerDefinitionProvider,
      "function",
      "vscode.lm.registerMcpServerDefinitionProvider available (engines ^1.101)",
    );
  });

  test("MCP-B: activation registers the provider without throwing", async () => {
    const a = await api();
    assert.ok(a, "activate() returned — provider registration did not throw");
  });

  test("MCP-C: one descriptor per workspace folder, each launching the bundled dist/mcp.js", async () => {
    const a = await api();
    await a.refresh();
    const defs = a.getMcpServerDefinitions();
    const folders = (vscode.workspace.workspaceFolders ?? []).map((f) => f.uri.fsPath);
    assert.equal(defs.length, folders.length, "one server per folder (C-1)");

    for (const d of defs) {
      // C-3: the advertised binary is the bundled server and it exists in the install layout.
      assert.ok(d.args[0].endsWith(path.join("dist", "mcp.js")), `args[0] is dist/mcp.js: ${d.args[0]}`);
      assert.ok(fs.existsSync(d.args[0]), `bundled server present at ${d.args[0]}`);
      // C-2: scoped to a real workspace folder via --root.
      assert.equal(d.args[1], "--root");
      assert.ok(folders.includes(d.args[2]), `--root ${d.args[2]} is a workspace folder`);
      assert.equal(d.cwd, d.args[2], "cwd matches its root");
      // C-4: launched via the editor Node.
      assert.equal(d.command, process.execPath);
      assert.equal(d.env.ELECTRON_RUN_AS_NODE, "1");
    }
  });

  test("MCP-D: multi-root scoping — each server has a distinct own root (C-2)", async () => {
    const a = await api();
    const defs = a.getMcpServerDefinitions();
    if (defs.length < 2) {
      return; // single-root fixture — nothing multi-root to assert
    }
    const roots = defs.map((d) => d.args[2]);
    assert.equal(new Set(roots).size, roots.length, "each server scoped to a distinct folder");
  });

  await runAll("mcp-provider");
}
