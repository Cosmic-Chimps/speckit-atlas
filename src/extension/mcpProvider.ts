import * as path from "node:path";

/**
 * Pure mapping from workspace folders to MCP stdio server descriptors (feature 007). No
 * `vscode`/`fs`/process imports, so it unit-tests in plain Node. `extension.ts` maps each
 * descriptor onto a `vscode.McpStdioServerDefinition` and registers the provider.
 *
 * The descriptors advertise the SAME bundled `dist/mcp.js` (feature 004) — one server per
 * workspace folder, scoped with `--root`, launched via the editor's Node (`process.execPath`
 * + `ELECTRON_RUN_AS_NODE`), so no system Node is required and tool parity is structural.
 *
 * See specs/007-mcp-provider-contribution/contracts/mcp-provider.md.
 */

export interface McpServerDescriptor {
  /** Human-readable name shown in the editor's MCP list. */
  readonly label: string;
  /** Node-capable executable (the editor's own Node via process.execPath). */
  readonly command: string;
  /** `[<extensionPath>/dist/mcp.js, "--root", <folderPath>]`. */
  readonly args: string[];
  /** Working directory = the workspace folder. */
  readonly cwd: string;
  /** Runs the editor binary as plain Node. */
  readonly env: Record<string, string>;
  /** Extension version — a change prompts the editor to restart the server. */
  readonly version: string;
}

export interface BuildServerDefinitionsInput {
  /** Workspace folder filesystem paths. */
  readonly folders: readonly string[];
  /** The installed extension root (`context.extensionPath`). */
  readonly extensionPath: string;
  /** The editor's Node executable (`process.execPath`). */
  readonly nodePath: string;
  /** The extension version (`context.extension.packageJSON.version`). */
  readonly version: string;
}

/** Absolute path to the bundled MCP server inside the installed extension. */
export function serverEntryPath(extensionPath: string): string {
  return path.join(extensionPath, "dist", "mcp.js");
}

/**
 * One descriptor per workspace folder; `[]` when no folder is open (no rootless server).
 * Each server is scoped to its own folder via `--root`, so multi-root workspaces yield no
 * cross-project results.
 */
export function buildServerDefinitions(input: BuildServerDefinitionsInput): McpServerDescriptor[] {
  const entry = serverEntryPath(input.extensionPath);
  return input.folders.map((folder) => ({
    label: `SpecKit Atlas — ${path.basename(folder) || folder}`,
    command: input.nodePath,
    args: [entry, "--root", folder],
    cwd: folder,
    env: { ELECTRON_RUN_AS_NODE: "1" },
    version: input.version,
  }));
}
