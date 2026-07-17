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

  const webview = await esbuild.context({
    ...shared,
    entryPoints: ["src/webview/main.ts"],
    format: "iife",
    platform: "browser",
    target: "es2020",
    outfile: "media/webview.js",
  });

  if (watch) {
    await Promise.all([extension.watch(), webview.watch()]);
    console.log("[esbuild] watching…");
  } else {
    await Promise.all([extension.rebuild(), webview.rebuild()]);
    await Promise.all([extension.dispose(), webview.dispose()]);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
