import * as path from "node:path";
import { runTests } from "@vscode/test-electron";

/**
 * Launches VS Code (pinned via VSCODE_TEST_VERSION, default "stable") once per
 * scenario, loading this extension from source and opening a fixture workspace. The
 * suite to run inside the host is selected via the ATLAS_SUITE env var.
 */
async function main(): Promise<void> {
  // out/test/integration → repo root is three levels up.
  const extensionDevelopmentPath = path.resolve(__dirname, "../../..");
  const extensionTestsPath = path.resolve(__dirname, "./suite/index.js");
  const fixtures = path.join(extensionDevelopmentPath, "fixtures");
  const version = process.env.VSCODE_TEST_VERSION || "stable";

  const scenarios = [
    { suite: "qualifying", target: path.join(fixtures, "vanilla-speckit") },
    { suite: "dormant", target: path.join(fixtures, "plain-project") },
    { suite: "multiroot", target: path.join(fixtures, "atlas.code-workspace") },
    { suite: "malformed", target: path.join(fixtures, "malformed-speckit") },
    { suite: "graph", target: path.join(fixtures, "graph", "cross-links") },
    { suite: "render", target: path.join(fixtures, "graph", "render-demo") },
    { suite: "selection-focus", target: path.join(fixtures, "graph", "render-demo") },
    {
      suite: "render-multiroot",
      target: path.join(fixtures, "graph", "two-projects", "atlas.code-workspace"),
    },
    { suite: "layout", target: path.join(fixtures, "graph", "render-demo") },
    { suite: "mcp-provider", target: path.join(fixtures, "graph", "render-demo") },
    {
      suite: "mcp-provider-multiroot",
      target: path.join(fixtures, "graph", "two-projects", "atlas.code-workspace"),
    },
    { suite: "mcp-setup", target: path.join(fixtures, "graph", "render-demo") },
    { suite: "git-changes", target: path.join(fixtures, "graph", "render-demo") },
    { suite: "specs-for-file", target: path.join(fixtures, "graph", "render-demo") },
  ];

  for (const scenario of scenarios) {
    await runTests({
      version,
      extensionDevelopmentPath,
      extensionTestsPath,
      // Open the fixture and disable all OTHER installed extensions for isolation
      // (the extension under development still loads).
      launchArgs: [scenario.target, "--disable-extensions"],
      extensionTestsEnv: { ATLAS_SUITE: scenario.suite },
    });
  }
}

main().catch((err) => {
  console.error("Integration tests failed:", err);
  process.exit(1);
});
