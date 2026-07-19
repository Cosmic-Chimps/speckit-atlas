import { test } from "node:test";
import assert from "node:assert/strict";
import * as path from "node:path";
import {
  CLIENTS,
  DEFAULT_SERVER_NAME,
  bundledLaunchSpec,
  clientTarget,
  composeSetupDocument,
  formatRegistration,
  npmLaunchSpec,
  shellQuote,
  type SetupInput,
} from "../../src/extension/mcpSetup.js";

const EXT = "/ext";
const NODE = "/usr/bin/electron";
const ROOT = "/work/aerosens";
const BUNDLED = bundledLaunchSpec(EXT, NODE, ROOT);
const NPM = npmLaunchSpec(ROOT);

// ── US1: Claude Code shell form + quoting ────────────────────────────────────
test("MS-1: claude-code → a `claude mcp add … -- <cmd> <args>` command (C-1/C-6/C-7)", () => {
  const s = formatRegistration({ client: "claude-code", launch: BUNDLED, projectRoot: ROOT, serverName: DEFAULT_SERVER_NAME });
  assert.match(s, /^claude mcp add speckit-atlas /);
  assert.ok(s.includes("--env ELECTRON_RUN_AS_NODE=1"), "bundled env passed as --env");
  assert.ok(s.includes(" -- "), "separator before the command");
  assert.ok(s.includes(path.join(EXT, "dist", "mcp.js")), "launches bundled dist/mcp.js");
  assert.ok(s.includes("--root") && s.includes(ROOT), "scoped with --root");
});

test("MS-2: shellQuote runs verbatim for spaces and embedded quotes (C-5)", () => {
  assert.equal(shellQuote("/plain/path"), "/plain/path");
  assert.equal(shellQuote("/with space/x"), "'/with space/x'");
  assert.equal(shellQuote("a'b"), "'a'\\''b'");
  // A root with a space stays quoted as a single token in the command:
  const s = formatRegistration({ client: "claude-code", launch: bundledLaunchSpec(EXT, NODE, "/w s/root"), projectRoot: "/w s/root", serverName: "x" });
  assert.ok(s.includes("'/w s/root'"), "space-containing root is quoted");
});

// ── US2: JSON forms for Cursor / Claude Desktop / generic ────────────────────
test("MS-3: cursor & claude-desktop → valid mcpServers JSON (C-2/C-3)", () => {
  for (const client of ["cursor", "claude-desktop"] as const) {
    const s = formatRegistration({ client, launch: BUNDLED, projectRoot: ROOT, serverName: "speckit-atlas" });
    const parsed = JSON.parse(s) as { mcpServers: Record<string, { command: string; args: string[]; env?: Record<string, string> }> };
    const server = parsed.mcpServers["speckit-atlas"];
    assert.equal(server.command, NODE);
    assert.ok(server.args.includes("--root") && server.args.includes(ROOT));
    assert.equal(server.env?.ELECTRON_RUN_AS_NODE, "1");
  }
});

test("MS-4: generic includes stdio command+args (C-4); unknown id → generic", () => {
  const s = formatRegistration({ client: "generic", launch: BUNDLED, projectRoot: ROOT, serverName: "speckit-atlas" });
  assert.ok(s.includes(`command: ${NODE}`));
  assert.ok(s.includes("--root"));
  // clientTarget falls back to the generic catalog entry for an unknown id:
  assert.equal(clientTarget("nope" as never).id, "generic");
});

// ── US3: bundled vs npm launch specs ─────────────────────────────────────────
test("MS-5: bundledLaunchSpec vs npmLaunchSpec (C-7)", () => {
  assert.equal(BUNDLED.args[0], path.join(EXT, "dist", "mcp.js"));
  assert.equal(BUNDLED.command, NODE);
  assert.equal(BUNDLED.env.ELECTRON_RUN_AS_NODE, "1");
  assert.equal(NPM.command, "speckit-atlas-mcp");
  assert.deepEqual(NPM.args, ["--root", ROOT]);
  assert.deepEqual(NPM.env, {});
});

test("MS-6: composeSetupDocument surfaces BOTH the bundled and npm forms (FR-003)", () => {
  const input: SetupInput = { client: "claude-code", serverName: "speckit-atlas", projectRoot: ROOT, extensionPath: EXT, nodePath: NODE };
  const doc = composeSetupDocument(input);
  assert.ok(doc.includes(path.join(EXT, "dist", "mcp.js")), "bundled form present");
  assert.ok(doc.includes("speckit-atlas-mcp"), "npm alternative present");
  assert.ok(doc.includes("Claude Code"), "labeled for the chosen client");
});

test("MS-7: CLIENTS catalog has the four supported targets", () => {
  assert.deepEqual(
    CLIENTS.map((c) => c.id),
    ["claude-code", "cursor", "claude-desktop", "generic"],
  );
});
