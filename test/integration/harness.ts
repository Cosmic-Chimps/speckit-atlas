import * as vscode from "vscode";

/**
 * A tiny in-host test harness so the integration suite needs no Mocha dependency.
 * Register cases with `test()`, then `runAll()` executes them and throws if any fail
 * (which @vscode/test-electron reports as a non-zero exit).
 */
type Case = { name: string; fn: () => void | Promise<void> };

/** Locate this extension in the host by its manifest name (publisher-agnostic). */
export function getSelf(): vscode.Extension<unknown> | undefined {
  return vscode.extensions.all.find(
    (e) => (e.packageJSON as { name?: string } | undefined)?.name === "speckit-atlas",
  );
}

const cases: Case[] = [];

export function test(name: string, fn: () => void | Promise<void>): void {
  cases.push({ name, fn });
}

export async function runAll(label: string): Promise<void> {
  const failures: string[] = [];
  for (const c of cases) {
    try {
      await c.fn();
      console.log(`  ✔ ${c.name}`);
    } catch (err) {
      const message = err instanceof Error ? (err.stack ?? err.message) : String(err);
      console.error(`  ✖ ${c.name}\n    ${message}`);
      failures.push(c.name);
    }
  }
  cases.length = 0;
  if (failures.length > 0) {
    throw new Error(`[${label}] ${failures.length} test(s) failed: ${failures.join(", ")}`);
  }
}

/** Poll until `predicate` is true or the timeout elapses. */
export async function waitFor(
  predicate: () => boolean | Promise<boolean>,
  timeoutMs = 5000,
  intervalMs = 100,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await predicate()) {
      return;
    }
    if (Date.now() > deadline) {
      throw new Error("waitFor timed out");
    }
    await delay(intervalMs);
  }
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
