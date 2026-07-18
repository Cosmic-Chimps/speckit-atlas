import { test } from "node:test";
import assert from "node:assert/strict";
import * as path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type {
  CheckResult,
  QueryResult,
  SpecRelationships,
  WorkspaceGraph,
} from "../../src/core/index.js";

const repo = path.resolve(__dirname, "../../..");
const MCP = path.join(repo, "dist", "mcp.js");
const demo = path.join(repo, "fixtures", "graph", "render-demo");
const malformed = path.join(repo, "fixtures", "graph", "malformed");

async function withClient<T>(root: string, fn: (c: Client) => Promise<T>): Promise<T> {
  const client = new Client({ name: "test", version: "1.0.0" }, { capabilities: {} });
  const transport = new StdioClientTransport({ command: "node", args: [MCP, "--root", root] });
  await client.connect(transport);
  try {
    return await fn(client);
  } finally {
    await client.close();
  }
}

function envelope(res: unknown): QueryResult {
  const content = (res as { content: { type: string; text: string }[] }).content;
  return JSON.parse(content[0].text) as QueryResult;
}

test("MCP-1: lists exactly the five tools", async () => {
  await withClient(demo, async (c) => {
    const { tools } = await c.listTools();
    assert.deepEqual(tools.map((t) => t.name).sort(), [
      "atlas_check",
      "atlas_graph",
      "atlas_orphans",
      "atlas_spec_relationships",
      "atlas_status_summary",
    ]);
  });
});

test("MCP-2: atlas_graph returns the model envelope", async () => {
  await withClient(demo, async (c) => {
    const env = envelope(await c.callTool({ name: "atlas_graph", arguments: {} }));
    assert.equal(env.schemaVersion, 1);
    assert.equal(env.kind, "graph");
    assert.equal((env.data as WorkspaceGraph).projects[0].nodes.length, 3);
  });
});

test("MCP-3: atlas_spec_relationships — found + unknown id", async () => {
  await withClient(demo, async (c) => {
    const ok = envelope(
      await c.callTool({ name: "atlas_spec_relationships", arguments: { specId: "001-alpha" } }),
    );
    assert.equal((ok.data as SpecRelationships).found, true);
    const miss = envelope(
      await c.callTool({ name: "atlas_spec_relationships", arguments: { specId: "999-nope" } }),
    );
    assert.equal((miss.data as SpecRelationships).found, false);
  });
});

test("MCP-4: atlas_check returns { ok, violations } without exiting the server", async () => {
  await withClient(malformed, async (c) => {
    const env = envelope(
      await c.callTool({ name: "atlas_check", arguments: { rule: "no-orphans" } }),
    );
    const cr = env.data as CheckResult;
    assert.equal(cr.ok, false);
    assert.ok(cr.violations.length >= 1);
    // server still responsive after a check
    const again = envelope(await c.callTool({ name: "atlas_orphans", arguments: {} }));
    assert.equal(again.kind, "orphans");
  });
});
