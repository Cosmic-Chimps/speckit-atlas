import * as vscode from "vscode";
import * as path from "node:path";
import assert from "node:assert/strict";
import { getSelf, runAll, test } from "./harness.js";
import type { ClientId } from "../../src/extension/mcpSetup.js";

interface SetupApiLike {
  refresh(): Promise<unknown>;
  generateMcpRegistration(client: ClientId, folderPath?: string): string;
}

/** Feature 008: the setup command is registered and generates a correct registration, writing nothing. */
export async function run(): Promise<void> {
  async function api(): Promise<SetupApiLike> {
    const ext = getSelf();
    assert.ok(ext, "extension present");
    return (await ext.activate()) as SetupApiLike;
  }

  test("MSU-A: the setup command is registered", async () => {
    await api();
    const cmds = await vscode.commands.getCommands(true);
    assert.ok(cmds.includes("speckitAtlas.setupMcpClient"), "command contributed & registered");
  });

  test("MSU-B: generates a Claude Code registration scoped to the workspace, launching the bundled server", async () => {
    const a = await api();
    await a.refresh();
    const doc = a.generateMcpRegistration("claude-code");
    assert.ok(doc.includes("claude mcp add speckit-atlas"), "claude mcp add command present");
    const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "";
    assert.ok(folder.length > 0 && doc.includes(folder), "scoped with the workspace --root");
    assert.ok(doc.includes(path.join("dist", "mcp.js")), "launches the bundled dist/mcp.js");
    assert.ok(doc.includes("speckit-atlas-mcp"), "npm alternative also surfaced");
  });

  test("MSU-C: each client produces a form; writing nothing to the workspace", async () => {
    const a = await api();
    const before = await vscode.workspace.findFiles("**/.mcp.json", "**/node_modules/**", 5);
    for (const client of ["claude-code", "cursor", "claude-desktop", "generic"] as const) {
      const doc = a.generateMcpRegistration(client);
      assert.ok(doc.length > 0, `${client} produced a registration`);
    }
    const after = await vscode.workspace.findFiles("**/.mcp.json", "**/node_modules/**", 5);
    assert.equal(
      after.length,
      before.length,
      "generating a registration wrote no .mcp.json (read-only)",
    );
  });

  await runAll("mcp-setup");
}
