import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as path from "node:path";

// out/test/contracts → repo root is three levels up.
const repoRoot = path.resolve(__dirname, "../../..");

function read(rel: string): string {
  return readFileSync(path.join(repoRoot, rel), "utf8");
}

// FR-007/FR-008/SC-004: shipped bundles must contain no network or telemetry sinks.
// Actual sinks (apply to every bundle):
const SINKS: RegExp[] = [
  /XMLHttpRequest/,
  /\bfetch\s*\(/,
  /new\s+WebSocket/,
  /navigator\.sendBeacon/,
  /TelemetryReporter/,
  /applicationinsights/i,
];
// Generic remote-URL check — only for FIRST-PARTY bundles. A bundled third-party graph
// library legitimately contains benign URL strings (SVG namespace, license headers), so
// scanning it for `https?://` would false-positive; the sink checks above still apply.
const REMOTE_URL = /https?:\/\//;

const FIRST_PARTY = ["dist/extension.js", "media/controls.js"];
const THIRD_PARTY_BUNDLED = ["media/map.js"]; // contains cytoscape

for (const bundle of [...FIRST_PARTY, ...THIRD_PARTY_BUNDLED]) {
  test(`no network/telemetry sink in ${bundle}`, () => {
    const source = read(bundle);
    for (const pattern of SINKS) {
      assert.doesNotMatch(source, pattern, `${bundle} must not contain ${pattern}`);
    }
    if (FIRST_PARTY.includes(bundle)) {
      assert.doesNotMatch(source, REMOTE_URL, `${bundle} must not contain a remote URL`);
    }
  });
}
