import { serverEntryPath } from "./mcpProvider.js";

/**
 * Pure generation of an MCP client registration for the SpecKit Atlas query server
 * (feature 008). No `vscode`/`fs`/process imports, so it unit-tests in plain Node.
 *
 * The extension GENERATES the registration and hands it off (clipboard + an untitled
 * document) — it writes no files (Read-Only, Principle III). Reuses the feature-007 bundled
 * server (`dist/mcp.js` via the editor's Node) and offers the npm `speckit-atlas-mcp` form.
 *
 * See specs/008-mcp-client-setup/contracts/mcp-setup.md.
 */

export type ClientId = "claude-code" | "cursor" | "claude-desktop" | "generic";

export interface ClientTarget {
  readonly id: ClientId;
  readonly label: string;
  readonly format: "shell" | "json";
  /** Where the user applies the generated registration. */
  readonly hint: string;
}

/** Default MCP server name to register. */
export const DEFAULT_SERVER_NAME = "speckit-atlas";

/** Catalog surfaced in the client QuickPick. */
export const CLIENTS: readonly ClientTarget[] = [
  {
    id: "claude-code",
    label: "Claude Code",
    format: "shell",
    hint: "Run this in a terminal at your project root.",
  },
  {
    id: "cursor",
    label: "Cursor",
    format: "json",
    hint: "Add to .cursor/mcp.json (project) or ~/.cursor/mcp.json (global).",
  },
  {
    id: "claude-desktop",
    label: "Claude Desktop",
    format: "json",
    hint: "Add to claude_desktop_config.json (Settings → Developer → Edit Config).",
  },
  {
    id: "generic",
    label: "Other (generic stdio)",
    format: "json",
    hint: "Use this command/args with any MCP client that speaks stdio.",
  },
];

export interface ServerLaunchSpec {
  readonly command: string;
  readonly args: string[];
  readonly env: Record<string, string>;
  readonly kind: "bundled" | "npm";
}

/** The bundled server — the editor's Node runs dist/mcp.js; guaranteed present. */
export function bundledLaunchSpec(
  extensionPath: string,
  nodePath: string,
  root: string,
): ServerLaunchSpec {
  return {
    command: nodePath,
    args: [serverEntryPath(extensionPath), "--root", root],
    env: { ELECTRON_RUN_AS_NODE: "1" },
    kind: "bundled",
  };
}

/** The npm-installed bin, for users who have `speckit-atlas-mcp` on PATH. */
export function npmLaunchSpec(root: string): ServerLaunchSpec {
  return { command: "speckit-atlas-mcp", args: ["--root", root], env: {}, kind: "npm" };
}

/** POSIX single-quote a shell argument so it runs verbatim (spaces, quotes, etc.). */
export function shellQuote(arg: string): string {
  if (/^[A-Za-z0-9_./:=-]+$/.test(arg)) {
    return arg; // safe bare token
  }
  return "'" + arg.replace(/'/g, "'\\''") + "'";
}

function mcpServersJson(serverName: string, launch: ServerLaunchSpec): string {
  const server: { command: string; args: string[]; env?: Record<string, string> } = {
    command: launch.command,
    args: launch.args,
  };
  if (Object.keys(launch.env).length > 0) {
    server.env = launch.env;
  }
  return JSON.stringify({ mcpServers: { [serverName]: server } }, null, 2);
}

function claudeAddCommand(serverName: string, launch: ServerLaunchSpec): string {
  const envFlags = Object.entries(launch.env).flatMap(([k, v]) => ["--env", `${k}=${v}`]);
  const parts = [
    "claude",
    "mcp",
    "add",
    serverName,
    ...envFlags,
    "--",
    launch.command,
    ...launch.args,
  ];
  return parts.map(shellQuote).join(" ");
}

export interface FormatInput {
  readonly client: ClientId;
  readonly launch: ServerLaunchSpec;
  readonly projectRoot: string;
  readonly serverName: string;
}

/** Render the registration for one client from one launch spec. Deterministic; pure. */
export function formatRegistration(input: FormatInput): string {
  const { client, launch, serverName } = input;
  switch (client) {
    case "claude-code":
      return claudeAddCommand(serverName, launch);
    case "cursor":
    case "claude-desktop":
      return mcpServersJson(serverName, launch);
    case "generic":
    default:
      return [
        `command: ${launch.command}`,
        `args: ${JSON.stringify(launch.args)}`,
        `env: ${JSON.stringify(launch.env)}`,
        "",
        "# or, as a JSON MCP-servers block:",
        mcpServersJson(serverName, launch),
      ].join("\n");
  }
}

export interface SetupInput {
  readonly client: ClientId;
  readonly serverName: string;
  readonly projectRoot: string;
  readonly extensionPath: string;
  readonly nodePath: string;
}

/** Resolve a client id to its target (falls back to the generic form). */
export function clientTarget(client: ClientId): ClientTarget {
  return CLIENTS.find((c) => c.id === client) ?? CLIENTS[CLIENTS.length - 1];
}

/**
 * The full, copy-ready document for a client: the bundled registration (primary, works with
 * no extra install) plus the npm alternative, with an apply hint. This is what the command
 * shows and copies, and what the deterministic test hook returns.
 */
export function composeSetupDocument(input: SetupInput): string {
  const target = clientTarget(input.client);
  const bundled = bundledLaunchSpec(input.extensionPath, input.nodePath, input.projectRoot);
  const npm = npmLaunchSpec(input.projectRoot);
  const primary = formatRegistration({
    client: target.id,
    launch: bundled,
    projectRoot: input.projectRoot,
    serverName: input.serverName,
  });
  const alternative = formatRegistration({
    client: target.id,
    launch: npm,
    projectRoot: input.projectRoot,
    serverName: input.serverName,
  });
  return [
    `Connect ${target.label} to SpecKit Atlas`,
    "",
    target.hint,
    "",
    "── Registration (bundled server — works with no extra install) ──",
    primary,
    "",
    "── Alternative (if you installed the npm package `speckit-atlas-mcp`) ──",
    alternative,
  ].join("\n");
}
