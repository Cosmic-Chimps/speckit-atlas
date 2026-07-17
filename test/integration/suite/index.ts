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
    default:
      throw new Error(`Unknown ATLAS_SUITE: ${suite}`);
  }
}
