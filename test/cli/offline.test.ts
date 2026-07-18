import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as path from "node:path";

// out/test/cli → repo root is three levels up.
const repo = path.resolve(__dirname, "../../..");

/**
 * Offline / no-network verification (FR-015 / SC-004) for the headless surfaces.
 *
 * `dist/cli.js` is FIRST-PARTY (no SDK) → blanket sink-scan.
 * `dist/mcp.js` bundles the MCP SDK, which legitimately ships unused HTTP/SSE transports —
 * so we do NOT blanket-scan it (same rationale as the cytoscape webview bundle). Instead we
 * assert our MCP SOURCE wires ONLY the stdio transport (no HTTP/SSE), which is the real
 * offline guarantee.
 */

const SINKS: RegExp[] = [
  /XMLHttpRequest/,
  /\bfetch\s*\(/,
  /new\s+WebSocket/,
  /navigator\.sendBeacon/,
  /TelemetryReporter/,
  /applicationinsights/i,
  /https?:\/\//,
];

test("first-party dist/cli.js contains no network/telemetry sink", () => {
  const src = readFileSync(path.join(repo, "dist", "cli.js"), "utf8");
  for (const pattern of SINKS) {
    assert.doesNotMatch(src, pattern, `dist/cli.js must not contain ${pattern}`);
  }
});

test("MCP server source wires ONLY the stdio transport (no HTTP/SSE)", () => {
  const src = readFileSync(path.join(repo, "src", "mcp", "main.ts"), "utf8");
  assert.match(src, /StdioServerTransport/, "uses the stdio transport");
  assert.doesNotMatch(
    src,
    /StreamableHTTP|SSEServerTransport|express|createServer\(/,
    "no HTTP/SSE transport wired",
  );
});
