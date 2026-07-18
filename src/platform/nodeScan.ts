import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import type { FeatureInput, ProjectSnapshot } from "../core/index.js";

/**
 * Headless, READ-ONLY scan of a directory tree into ProjectSnapshots for the core — the
 * `node:fs` sibling of the extension's `projectScan.ts`. Only reads (stat/readdir/readFile);
 * never writes. The core stays pure; this is the CLI/MCP I/O boundary.
 */

const CONTENT_FILES = [
  "spec.md",
  "plan.md",
  "tasks.md",
  "data-model.md",
  "research.md",
  "quickstart.md",
];
const ARTIFACT_FILES = ["spec", "plan", "tasks", "research", "data-model", "quickstart"];
const ARTIFACT_DIRS = ["contracts", "checklists"];

/**
 * Scan a root directory. A root that has a `specs/` dir with feature folders becomes one
 * project; if the root is itself a multi-project tree, each immediate subdirectory that
 * contains a `specs/` folder becomes a project too.
 */
export function scanRoot(root: string): ProjectSnapshot[] {
  const snapshots: ProjectSnapshot[] = [];
  const abs = path.resolve(root);

  const asProject = (dir: string): void => {
    const features = scanFeatures(path.join(dir, "specs"));
    if (features.length > 0) {
      snapshots.push({
        projectId: pathToFileURL(dir).toString(),
        name: path.basename(dir),
        features,
      });
    }
  };

  asProject(abs);
  for (const child of readDirSafe(abs)) {
    if (child.isDirectory() && !child.name.startsWith(".") && child.name !== "node_modules") {
      asProject(path.join(abs, child.name));
    }
  }
  // De-duplicate by projectId (a root that is itself a project won't be re-added as a child).
  const seen = new Set<string>();
  return snapshots.filter((s) => (seen.has(s.projectId) ? false : (seen.add(s.projectId), true)));
}

function scanFeatures(specsDir: string): FeatureInput[] {
  const features: FeatureInput[] = [];
  for (const entry of readDirSafe(specsDir)) {
    if (!entry.isDirectory()) {
      continue;
    }
    features.push(scanFeature(path.join(specsDir, entry.name), entry.name));
  }
  return features;
}

function scanFeature(dir: string, id: string): FeatureInput {
  const numberMatch = id.match(/^(\d{3})-/);
  const number = numberMatch ? numberMatch[1] : null;

  const artifacts: string[] = [];
  for (const base of ARTIFACT_FILES) {
    if (isFile(path.join(dir, `${base}.md`))) {
      artifacts.push(base);
    }
  }
  for (const d of ARTIFACT_DIRS) {
    if (isDir(path.join(dir, d))) {
      artifacts.push(d);
    }
  }

  const files: Record<string, string> = {};
  for (const fname of CONTENT_FILES) {
    const text = readTextSafe(path.join(dir, fname));
    if (text !== null) {
      files[fname] = text;
    }
  }

  return { id, number, artifacts, files };
}

function readDirSafe(dir: string): fs.Dirent[] {
  try {
    return fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}
function isFile(p: string): boolean {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}
function isDir(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}
function readTextSafe(p: string): string | null {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return null;
  }
}
