import type {
  ArtifactPresence,
  FeatureFacts,
  FeatureInput,
  Reference,
  Warning,
} from "../model/types.js";
import {
  extractBareNumbers,
  extractCodeReferences,
  extractEntities,
  extractLinks,
  extractSlugMentions,
} from "./heuristics.js";

/**
 * Parse ONE feature into node attributes + unresolved outbound references. Pure and
 * total: never throws; any failure degrades to a warning. Uses only the feature's
 * provided file contents (no I/O). Resolution against siblings happens in
 * buildProjectGraph.
 */
export function parseFeature(input: FeatureInput): FeatureFacts {
  const id = typeof input?.id === "string" ? input.id : "";
  const number = typeof input?.number === "string" ? input.number : null;
  const warnings: Warning[] = [];
  const files: Record<string, string> =
    input && typeof input.files === "object" && input.files ? input.files : {};
  const artifacts: string[] = Array.isArray(input?.artifacts)
    ? input.artifacts.filter((a): a is string => typeof a === "string")
    : [];

  const completeness = toCompleteness(artifacts);

  let title = id;
  let status: string | null = null;
  let taskCompletion: { done: number; total: number } | null = null;
  let references: Reference[] = [];

  try {
    const spec = fileByName(files, "spec.md");
    const tasks = fileByName(files, "tasks.md");
    const dataModel = fileByName(files, "data-model.md");
    const allText = Object.values(files).join("\n");

    title = extractTitle(spec) ?? id;
    status = extractStatus(spec);
    taskCompletion = extractTaskCompletion(tasks);

    references = [
      ...extractLinks(allText),
      ...extractSlugMentions(allText),
      ...extractBareNumbers(allText),
      ...extractCodeReferences(allText),
      ...(dataModel ? extractEntities(dataModel) : []),
    ];
  } catch {
    warnings.push({
      code: "parse-error",
      message: `Could not fully parse feature "${id}"; using partial data.`,
      featureId: id,
    });
  }

  return { id, number, title, status, taskCompletion, completeness, references, warnings };
}

const ARTIFACT_KEYS: Record<keyof ArtifactPresence, string[]> = {
  spec: ["spec"],
  plan: ["plan"],
  tasks: ["tasks"],
  research: ["research"],
  dataModel: ["data-model", "datamodel", "dataModel"],
  quickstart: ["quickstart"],
  contracts: ["contracts"],
  checklists: ["checklists"],
};

function toCompleteness(artifacts: readonly string[]): ArtifactPresence {
  const set = new Set(artifacts.map((a) => a.toLowerCase().replace(/\.md$/, "")));
  const has = (key: keyof ArtifactPresence): boolean =>
    ARTIFACT_KEYS[key].some((name) => set.has(name.toLowerCase()));
  return {
    spec: has("spec"),
    plan: has("plan"),
    tasks: has("tasks"),
    research: has("research"),
    dataModel: has("dataModel"),
    quickstart: has("quickstart"),
    contracts: has("contracts"),
    checklists: has("checklists"),
  };
}

/** Look up a file by basename (adapter keys may be relative paths). */
function fileByName(files: Record<string, string>, name: string): string {
  if (typeof files[name] === "string") {
    return files[name];
  }
  for (const [key, value] of Object.entries(files)) {
    if (key.replace(/\\/g, "/").split("/").pop() === name && typeof value === "string") {
      return value;
    }
  }
  return "";
}

function extractTitle(spec: string): string | null {
  const m = spec.match(/^#\s+(?:Feature Specification:\s*)?(.+?)\s*$/m);
  return m ? m[1].trim() : null;
}

/** Tolerant of trailing whitespace and parenthetical notes (FR-007). */
function extractStatus(spec: string): string | null {
  const m = spec.match(/^\s*\*\*Status\*\*:\s*(.+?)\s*$/m);
  return m ? m[1].trim() : null;
}

function extractTaskCompletion(tasks: string): { done: number; total: number } | null {
  if (!tasks) {
    return null;
  }
  const done = (tasks.match(/^\s*-\s*\[[xX]\]/gm) ?? []).length;
  const todo = (tasks.match(/^\s*-\s*\[ \]/gm) ?? []).length;
  const total = done + todo;
  return total === 0 ? null : { done, total };
}
