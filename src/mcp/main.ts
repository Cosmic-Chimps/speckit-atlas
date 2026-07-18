import { parseArgs } from "node:util";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { GraphOptions, QueryKind } from "../core/index.js";
import { runQuery } from "../platform/runQuery.js";

/**
 * `speckit-atlas-mcp` — local MCP server (stdio transport ONLY: no network, offline) over
 * the same shared core + read-only node:fs scan as the CLI. Read-only, no telemetry.
 */

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: { root: { type: "string" } },
  allowPositionals: true,
});
const DEFAULT_ROOT = values.root ?? process.cwd();

const OPTIONS_SCHEMA = {
  type: "object",
  description: "Heuristic toggles (defaults per the model).",
  properties: {
    slugMentions: { type: "boolean" },
    sharedEntities: { type: "boolean" },
    bareNumbers: { type: "boolean" },
    specToCode: { type: "boolean" },
  },
} as const;
const COMMON = {
  root: { type: "string", description: "Workspace root (default: server root)." },
  projectId: { type: "string", description: "Scope to one project." },
  options: OPTIONS_SCHEMA,
};

interface ToolDef {
  readonly name: string;
  readonly kind: QueryKind;
  readonly description: string;
  readonly inputSchema: Record<string, unknown>;
}

const TOOLS: readonly ToolDef[] = [
  {
    name: "atlas_graph",
    kind: "graph",
    description: "The spec-relationship graph for a project (or all).",
    inputSchema: { type: "object", properties: { ...COMMON } },
  },
  {
    name: "atlas_spec_relationships",
    kind: "spec",
    description: "A spec's dependsOn / dependedOnBy with tier/weight/evidence.",
    inputSchema: {
      type: "object",
      required: ["specId"],
      properties: { specId: { type: "string" }, ...COMMON },
    },
  },
  {
    name: "atlas_status_summary",
    kind: "status",
    description: "Implementation-status / completeness summary.",
    inputSchema: { type: "object", properties: { ...COMMON } },
  },
  {
    name: "atlas_orphans",
    kind: "orphans",
    description: "Specs with no relationships.",
    inputSchema: { type: "object", properties: { ...COMMON } },
  },
  {
    name: "atlas_check",
    kind: "check",
    description: "Evaluate a rule (default no-orphans); returns { ok, violations }.",
    inputSchema: { type: "object", properties: { rule: { type: "string" }, ...COMMON } },
  },
];

const server = new Server(
  { name: "speckit-atlas", version: "0.0.1" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  })),
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const tool = TOOLS.find((t) => t.name === req.params.name);
  if (!tool) {
    return { isError: true, content: [{ type: "text", text: `Unknown tool: ${req.params.name}` }] };
  }
  const args = (req.params.arguments ?? {}) as {
    root?: string;
    projectId?: string | null;
    specId?: string;
    rule?: string;
    options?: Partial<GraphOptions>;
  };
  const result = runQuery({
    root: args.root ?? DEFAULT_ROOT,
    kind: tool.kind,
    specId: args.specId,
    rule: args.rule,
    projectId: args.projectId ?? null,
    options: args.options,
  });
  return { content: [{ type: "text", text: JSON.stringify(result) }] };
});

async function main(): Promise<void> {
  await server.connect(new StdioServerTransport());
}
void main();
