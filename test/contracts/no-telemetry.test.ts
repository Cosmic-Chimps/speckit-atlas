import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as path from "node:path";

// out/test/contracts → repo root is three levels up.
const repoRoot = path.resolve(__dirname, "../../..");

function read(rel: string): string {
  return readFileSync(path.join(repoRoot, rel), "utf8");
}

// FR-007/FR-008: the shipped bundles must contain no network or telemetry sinks.
const FORBIDDEN: RegExp[] = [
  /XMLHttpRequest/,
  /\bfetch\s*\(/,
  /new\s+WebSocket/,
  /TelemetryReporter/,
  /applicationinsights/i,
  /https?:\/\//,
];

for (const bundle of ["dist/extension.js", "media/webview.js"]) {
  test(`no network/telemetry sink in ${bundle}`, () => {
    const source = read(bundle);
    for (const pattern of FORBIDDEN) {
      assert.doesNotMatch(source, pattern, `${bundle} must not contain ${pattern}`);
    }
  });
}
