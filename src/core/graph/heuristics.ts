import type { Reference } from "../model/types.js";
import { normalizeWorkspacePath } from "../path.js";

/**
 * Pure extraction of raw, unresolved reference candidates from one feature's text.
 * Resolution against the project's real feature set happens in buildProjectGraph.
 * All functions are total and free of I/O.
 *
 * Heuristic contract: see specs/002-spec-graph-model/contracts/heuristics.md.
 */

/**
 * `link` (definitive): a relative markdown link `](./…)` / `](../…)`. Feature 009 captures
 * the whole relative path so buildProjectGraph can resolve ANY path segment against the real
 * sibling set — folder names of any numbering scheme (NNN-slug, timestamp, unnumbered).
 */
const REL_LINK_RE = /\]\((\.{1,2}\/[^)\s]*)\)/g;

/** `number` (risky): a bare 3-digit token (resolved to a feature number later). */
const NUMBER_RE = /(?<![\w:.\-/])([0-9]{3})(?![\w-])/g;

/** Escape a folder name for safe inclusion in a RegExp alternation. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * `code`: source-file references. Feature 011 broadens capture beyond relative markdown links to
 * the backtick-wrapped paths real `tasks.md` files use, so the detail panel can list the files a
 * spec touches. Both forms are normalized to a workspace-root-relative path (leading `./`/`../`
 * stripped) so the host can resolve them uniformly against the project root.
 */
const CODE_EXT = "ts|tsx|js|jsx|mjs|cjs|cs|py|go";
/** A relative markdown link to a source file, e.g. `](../../src/foo.ts)`. */
const CODE_LINK_RE = new RegExp(`\\]\\(((?:\\.{1,2}/)+[^)\\s]*\\.(?:${CODE_EXT}))\\)`, "g");
/** Any single-backtick inline-code span (validated against CODE_TICK_OK below). */
const CODE_TICK_RE = /`([^`\r\n]+)`/g;
/** A backtick candidate qualifies only if it is a slash-bearing path ending in a source ext. */
const CODE_TICK_OK = new RegExp(`^\\.{0,2}/?(?:[^\\s/]+/)+[^\\s/]+\\.(?:${CODE_EXT})$`);

/**
 * Normalize a captured path to workspace-root-relative: strip leading `./`/`../` segments.
 * Delegates to the shared `normalizeWorkspacePath` so feature-013's reverse lookup normalizes
 * query paths identically (single source of truth).
 */
function normalizeCodePath(raw: string): string {
  return normalizeWorkspacePath(raw);
}

/** data-model entity heading pinned to a concrete code type/location. */
const ENTITY_RE =
  /^#{2,4}\s+([A-Z][A-Za-z0-9]+)\b[^\n]*\(([^)]*(?:\.[a-z]{2,4}|:\d+|db\.types)[^)]*)\)/gm;

function snippet(line: string): string {
  return line.trim().slice(0, 100);
}

/**
 * Extract definitive link references. Feature 009: emit a candidate for **each path segment**
 * of every relative link, so any segment that names a real sibling folder resolves later —
 * regardless of numbering scheme or nesting depth. Non-feature segments (`specs`, `src`, a
 * file name) simply don't resolve. Total; never throws.
 */
export function extractLinks(text: string): Reference[] {
  const out = new Map<string, Reference>();
  for (const m of text.matchAll(REL_LINK_RE)) {
    const evidence = m[0];
    for (const seg of m[1].split("/")) {
      if (!seg || seg === "." || seg === "..") {
        continue;
      }
      const prev = out.get(seg);
      out.set(seg, {
        kind: "link",
        targetHint: seg,
        evidence: prev?.evidence ?? evidence,
        count: (prev?.count ?? 0) + 1,
      });
    }
  }
  return [...out.values()];
}

/**
 * Feature 009: sibling-aware slug-mention matching. Counts **whole-word** occurrences of each
 * real sibling folder name in `text` — for any numbering scheme — excluding `selfId`. Uses a
 * single longest-first alternation scan (so `fleet-safety` never matches inside
 * `fleet-safety-audit`, and nested names resolve to the most specific). Total; never throws.
 */
export function matchSiblingMentions(
  text: string,
  siblingIds: Iterable<string>,
  selfId: string,
): { id: string; count: number }[] {
  const ids = [...new Set(siblingIds)].filter((id) => id && id !== selfId);
  if (ids.length === 0 || !text) {
    return [];
  }
  ids.sort((a, b) => b.length - a.length); // longest-first: most specific wins
  const alternation = ids.map(escapeRegExp).join("|");
  const re = new RegExp(`(?<![A-Za-z0-9-])(?:${alternation})(?![A-Za-z0-9-])`, "g");
  const counts = new Map<string, number>();
  for (const m of text.matchAll(re)) {
    counts.set(m[0], (counts.get(m[0]) ?? 0) + 1);
  }
  return [...counts.entries()].map(([id, count]) => ({ id, count }));
}

/** Extract bare 3-digit number candidates, excluding task ids (`T012`) and line refs. */
export function extractBareNumbers(text: string): Reference[] {
  const counts = new Map<string, string>();
  const tally = new Map<string, number>();
  for (const rawLine of text.split(/\r?\n/)) {
    if (/\bT\d{3}\b/.test(rawLine)) {
      continue; // task-id line — skip to avoid TNNN false matches
    }
    for (const m of rawLine.matchAll(NUMBER_RE)) {
      const num = m[1];
      tally.set(num, (tally.get(num) ?? 0) + 1);
      if (!counts.has(num)) {
        counts.set(num, snippet(rawLine));
      }
    }
  }
  return [...tally.entries()].map(([num, count]) => ({
    kind: "number" as const,
    targetHint: num,
    evidence: counts.get(num) ?? num,
    count,
  }));
}

/** Extract code-pinned data-model entity keys from a feature's data-model text. */
export function extractEntities(dataModelText: string): Reference[] {
  const out = new Map<string, Reference>();
  for (const m of dataModelText.matchAll(ENTITY_RE)) {
    const key = m[1];
    if (out.has(key)) {
      continue;
    }
    out.set(key, {
      kind: "entity",
      targetHint: key,
      evidence: m[0].trim().slice(0, 100),
      count: 1,
    });
  }
  return [...out.values()];
}

/**
 * Extract spec→code source-file references (feature 011). Recognizes relative markdown links and
 * backtick-wrapped workspace-relative paths; both are normalized to a root-relative path and
 * de-duplicated. Total; never throws. Conservative: a candidate must contain a path separator and
 * end in an allowed source extension, so bare identifiers and prose never match.
 */
export function extractCodeReferences(text: string): Reference[] {
  const out = new Map<string, Reference>();
  const add = (raw: string): void => {
    const path = normalizeCodePath(raw);
    if (!path) {
      return;
    }
    const prev = out.get(path);
    out.set(path, {
      kind: "code",
      targetHint: path,
      evidence: path,
      count: (prev?.count ?? 0) + 1,
    });
  };
  for (const m of text.matchAll(CODE_LINK_RE)) {
    add(m[1]);
  }
  for (const m of text.matchAll(CODE_TICK_RE)) {
    const candidate = m[1].trim();
    if (CODE_TICK_OK.test(candidate)) {
      add(candidate);
    }
  }
  return [...out.values()];
}
