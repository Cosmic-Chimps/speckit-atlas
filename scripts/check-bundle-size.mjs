// Bundle-size gate (SC-009 / R-21). Run AFTER a production build. Asserts the shipped
// webview/extension bundles and any packaged .vsix stay within budget.
import { statSync, readdirSync, existsSync } from "node:fs";

const KB = 1024;
const MB = 1024 * 1024;

/** file → max bytes */
const LIMITS = {
  "media/map.js": 800 * KB, // graph webview incl. cytoscape
  "media/controls.js": 200 * KB,
  "dist/extension.js": 200 * KB,
};

let failed = false;

for (const [file, limit] of Object.entries(LIMITS)) {
  if (!existsSync(file)) {
    console.error(`✖ missing ${file} (run a production build first: node esbuild.js --production)`);
    failed = true;
    continue;
  }
  const size = statSync(file).size;
  const ok = size <= limit;
  console.log(
    `${ok ? "✔" : "✖"} ${file}: ${(size / KB).toFixed(0)} KB / ${(limit / KB).toFixed(0)} KB`,
  );
  if (!ok) {
    failed = true;
  }
}

// Optional: check the packaged .vsix if one is present.
const vsix = readdirSync(".").filter((f) => f.endsWith(".vsix"));
for (const f of vsix) {
  const size = statSync(f).size;
  const ok = size <= 2 * MB;
  console.log(`${ok ? "✔" : "✖"} ${f}: ${(size / MB).toFixed(2)} MB / 2.00 MB`);
  if (!ok) {
    failed = true;
  }
}

if (failed) {
  console.error("Bundle-size budget exceeded.");
  process.exit(1);
}
console.log("Bundle-size budget OK.");
