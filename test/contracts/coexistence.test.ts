import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as path from "node:path";

// out/test/contracts → repo root is three levels up.
const repoRoot = path.resolve(__dirname, "../../..");
const manifest = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8"));

test("E-4: every contributed id is namespaced under speckitAtlas", () => {
  const contributes = manifest.contributes ?? {};
  const ids: string[] = [];
  for (const c of contributes.commands ?? []) {
    ids.push(c.command);
  }
  for (const vc of contributes.viewsContainers?.activitybar ?? []) {
    ids.push(vc.id);
  }
  for (const views of Object.values(contributes.views ?? {})) {
    for (const v of views as { id: string }[]) {
      ids.push(v.id);
    }
  }
  assert.ok(ids.length > 0, "there should be contributions to check");
  for (const id of ids) {
    assert.ok(
      id === "speckitAtlas" || id.startsWith("speckitAtlas."),
      `contribution id "${id}" must be namespaced under speckitAtlas`,
    );
  }
});

test("FR-010: no file associations / language contributions are declared", () => {
  const contributes = manifest.contributes ?? {};
  assert.equal(contributes.languages, undefined);
  assert.equal(contributes.grammars, undefined);
});

test("view container keys match the declared views container id", () => {
  const contributes = manifest.contributes ?? {};
  for (const key of Object.keys(contributes.views ?? {})) {
    assert.equal(key, "speckitAtlas");
  }
});
