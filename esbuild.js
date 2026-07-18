// Bundles the extension host entry (Node/CJS) and the webview renderer (browser/IIFE).
// No remote sources are ever fetched; everything is bundled locally (Principle VI).
"use strict";

const esbuild = require("esbuild");

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

/** @type {import('esbuild').BuildOptions} */
const shared = {
  bundle: true,
  sourcemap: !production,
  minify: production,
  logLevel: "info",
};

// Webview bundles (browser/IIFE). Each is self-contained and loaded via a nonce'd
// <script> in a strict-CSP webview. Cytoscape is bundled into map.js (no CDN).
const WEBVIEW_ENTRIES = [
  { in: "src/webview/map/main.ts", out: "media/map.js" },
  { in: "src/webview/controls/main.ts", out: "media/controls.js" },
];

async function main() {
  const extension = await esbuild.context({
    ...shared,
    entryPoints: ["src/extension/extension.ts"],
    format: "cjs",
    platform: "node",
    target: "node18",
    outfile: "dist/extension.js",
    // The 'vscode' module is provided by the host at runtime, never bundled.
    external: ["vscode"],
  });

  // Headless siblings (feature 004): CLI + MCP server. Node/CJS, no vscode. The MCP SDK is
  // bundled in. Shipped via npm `bin`, excluded from the .vsix.
  const cli = await esbuild.context({
    ...shared,
    entryPoints: ["src/cli/main.ts"],
    format: "cjs",
    platform: "node",
    target: "node18",
    outfile: "dist/cli.js",
    banner: { js: "#!/usr/bin/env node" },
  });

  const mcp = await esbuild.context({
    ...shared,
    entryPoints: ["src/mcp/main.ts"],
    format: "cjs",
    platform: "node",
    target: "node18",
    outfile: "dist/mcp.js",
    banner: { js: "#!/usr/bin/env node" },
  });

  const webviews = await Promise.all(
    WEBVIEW_ENTRIES.map((e) =>
      esbuild.context({
        ...shared,
        entryPoints: [e.in],
        format: "iife",
        platform: "browser",
        target: "es2020",
        outfile: e.out,
      }),
    ),
  );

  const contexts = [extension, cli, mcp, ...webviews];
  if (watch) {
    await Promise.all(contexts.map((c) => c.watch()));
    console.log("[esbuild] watching…");
  } else {
    await Promise.all(contexts.map((c) => c.rebuild()));
    await Promise.all(contexts.map((c) => c.dispose()));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
