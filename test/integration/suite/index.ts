/**
 * Entry point loaded by @vscode/test-electron inside the extension host. Dispatches
 * to the suite named by the ATLAS_SUITE env var (set per scenario in runTest.ts).
 */
export async function run(): Promise<void> {
  const suite = process.env.ATLAS_SUITE ?? "qualifying";

  switch (suite) {
    case "qualifying":
      await (await import("../activate.test.js")).run();
      break;
    case "dormant":
      await (await import("../dormant.test.js")).run();
      break;
    case "multiroot":
      await (await import("../multiroot.test.js")).run();
      break;
    case "malformed":
      await (await import("../malformed.test.js")).run();
      break;
    case "graph":
      await (await import("../graph.test.js")).run();
      break;
    case "render":
      await (await import("../render.test.js")).run();
      break;
    case "render-multiroot":
      await (await import("../render-multiroot.test.js")).run();
      break;
    case "layout":
      // feature 006 — layout persistence (restore, drag, evolve) share one fixture.
      await (await import("../layout-restore.test.js")).run();
      await (await import("../layout-drag.test.js")).run();
      await (await import("../layout-evolve.test.js")).run();
      break;
    case "mcp-provider":
    case "mcp-provider-multiroot":
      // feature 007 — same run() adapts to single-root vs multi-root fixtures.
      await (await import("../mcp-provider.test.js")).run();
      break;
    case "mcp-setup":
      // feature 008 — the setup command generates a registration and writes nothing.
      await (await import("../mcp-setup.test.js")).run();
      break;
    default:
      throw new Error(`Unknown ATLAS_SUITE: ${suite}`);
  }
}
