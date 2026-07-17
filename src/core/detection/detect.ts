import type { DetectionResult, Warning, WorkspaceRoot } from "../model/types.js";

/** Signal codes. Exported so tests and future UI can reference them by name. */
export const SIGNAL_DOT_SPECIFY = "has:.specify";
export const SIGNAL_SPECS_SPEC = "has:specs/*/spec.md";

/** Normalize a relative path: forward slashes, no leading "./", no surrounding slashes. */
function normalizeRelPath(entry: string): string {
  return entry.replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\/+/, "").replace(/\/+$/, "");
}

function isDotSpecify(path: string): boolean {
  return path === ".specify" || path.startsWith(".specify/");
}

function isSpecsSpec(path: string): boolean {
  // specs/<single-segment>/spec.md
  return /^specs\/[^/]+\/spec\.md$/.test(path);
}

/**
 * Classify a single root. Pure and total: it never throws — any unexpected input
 * degrades to a warning and a non-qualifying result (Principle II).
 */
export function detectRoot(root: WorkspaceRoot): DetectionResult {
  const warnings: Warning[] = [];
  const rootId = typeof root?.id === "string" ? root.id : "";
  const name = typeof root?.name === "string" ? root.name : "";
  const signals: string[] = [];

  try {
    const rawEntries = Array.isArray(root?.entries) ? root.entries : [];
    if (rawEntries.length === 0) {
      warnings.push({
        code: "empty-workspace",
        message: "No entries were probed for this workspace root.",
        rootId,
      });
    }

    const normalized = rawEntries
      .filter((e): e is string => typeof e === "string")
      .map(normalizeRelPath)
      .filter((e) => e.length > 0);

    if (normalized.some(isDotSpecify)) {
      signals.push(SIGNAL_DOT_SPECIFY);
    }
    if (normalized.some(isSpecsSpec)) {
      signals.push(SIGNAL_SPECS_SPEC);
    }
  } catch {
    warnings.push({
      code: "probe-error",
      message: "Could not analyze this workspace root; treating it as non-qualifying.",
      rootId,
    });
  }

  return {
    rootId,
    name,
    qualifies: signals.length > 0,
    signals,
    warnings,
  };
}

/** Classify many roots. Never throws. */
export function detectRoots(roots: readonly WorkspaceRoot[]): DetectionResult[] {
  const list = Array.isArray(roots) ? roots : [];
  return list.map((root) => detectRoot(root));
}
