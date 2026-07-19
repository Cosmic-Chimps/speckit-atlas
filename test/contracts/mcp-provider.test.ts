import { test } from "node:test";
import assert from "node:assert/strict";
import * as path from "node:path";
import {
  buildServerDefinitions,
  serverEntryPath,
  type BuildServerDefinitionsInput,
} from "../../src/extension/mcpProvider.js";

const BASE: BuildServerDefinitionsInput = {
  folders: [],
  extensionPath: "/ext",
  nodePath: "/usr/bin/electron",
  version: "9.9.9",
};

test("MP-1: one descriptor per workspace folder (contract C-1)", () => {
  const defs = buildServerDefinitions({
    ...BASE,
    folders: ["/work/alpha", "/work/beta"],
  });
  assert.equal(defs.length, 2);
  assert.equal(defs[0].label, "SpecKit Atlas — alpha");
  assert.equal(defs[1].label, "SpecKit Atlas — beta");
});

test("MP-2: zero folders → [] (no rootless server, C-1/D7)", () => {
  assert.deepEqual(buildServerDefinitions(BASE), []);
});

test("MP-3: args launch the bundled dist/mcp.js with --root <folder> (C-2/C-3)", () => {
  const [d] = buildServerDefinitions({ ...BASE, folders: ["/work/alpha"] });
  assert.equal(d.args[0], serverEntryPath("/ext"));
  assert.equal(d.args[0], path.join("/ext", "dist", "mcp.js"));
  assert.deepEqual(d.args.slice(1), ["--root", "/work/alpha"]);
  assert.equal(d.cwd, "/work/alpha");
});

test("MP-4: launched via the editor Node with ELECTRON_RUN_AS_NODE (C-4)", () => {
  const [d] = buildServerDefinitions({ ...BASE, folders: ["/work/alpha"] });
  assert.equal(d.command, "/usr/bin/electron");
  assert.equal(d.env.ELECTRON_RUN_AS_NODE, "1");
});

test("MP-5: version is carried through (C-9)", () => {
  const [d] = buildServerDefinitions({ ...BASE, folders: ["/work/alpha"], version: "1.2.3" });
  assert.equal(d.version, "1.2.3");
});

test("MP-6: each folder is scoped to its own root — no cross-project root (C-2)", () => {
  const defs = buildServerDefinitions({ ...BASE, folders: ["/a", "/b"] });
  assert.equal(defs[0].args[2], "/a");
  assert.equal(defs[1].args[2], "/b");
  assert.notEqual(defs[0].args[2], defs[1].args[2]);
});
