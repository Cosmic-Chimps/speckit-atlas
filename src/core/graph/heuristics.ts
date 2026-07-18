import type { Reference } from "../model/types.js";

/**
 * Pure extraction of raw, unresolved reference candidates from one feature's text.
 * Resolution against the project's real feature set happens in buildProjectGraph.
 * All functions are total and free of I/O.
 *
 * Heuristic contract: see specs/002-spec-graph-model/contracts/heuristics.md.
 */

const SLUG = "[0-9]{3}-[a-z0-9-]+";

/** `link` (definitive): relative link into another feature folder `.../NNN-slug/...`. */
const LINK_RE = new RegExp(`\\]\\((?:\\.\\.?/)+(${SLUG})/`, "g");

/** `slug` (strong): any full feature-slug token appearing in the text. */
const SLUG_TOKEN_RE = new RegExp(`(?<![\\w-])(${SLUG})(?![\\w-])`, "g");

/** `number` (risky): a bare 3-digit token (resolved to a feature number later). */
const NUMBER_RE = /(?<![\w:.\-/])([0-9]{3})(?![\w-])/g;

/** `code`: relative link to a source file. */
const CODE_LINK_RE = /\]\((?:\.\.\/)+([^)]+\.(?:ts|tsx|cs|py|go|js|jsx))\)/g;

/** data-model entity heading pinned to a concrete code type/location. */
const ENTITY_RE =
  /^#{2,4}\s+([A-Z][A-Za-z0-9]+)\b[^\n]*\(([^)]*(?:\.[a-z]{2,4}|:\d+|db\.types)[^)]*)\)/gm;

function snippet(line: string): string {
  return line.trim().slice(0, 100);
}

/** Extract definitive link references (target = the slug in the path). */
export function extractLinks(text: string): Reference[] {
  const out = new Map<string, Reference>();
  for (const m of text.matchAll(LINK_RE)) {
    const target = m[1];
    const prev = out.get(target);
    out.set(target, {
      kind: "link",
      targetHint: target,
      evidence: prev?.evidence ?? m[0],
      count: (prev?.count ?? 0) + 1,
    });
  }
  return [...out.values()];
}

/** Extract slug-mention candidates, counted. (buildProjectGraph filters to real siblings.) */
export function extractSlugMentions(text: string): Reference[] {
  const counts = new Map<string, number>();
  for (const m of text.matchAll(SLUG_TOKEN_RE)) {
    counts.set(m[1], (counts.get(m[1]) ?? 0) + 1);
  }
  return [...counts.entries()].map(([slug, count]) => ({
    kind: "slug" as const,
    targetHint: slug,
    evidence: slug,
    count,
  }));
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

/** Extract spec→code source-file references. */
export function extractCodeReferences(text: string): Reference[] {
  const out = new Map<string, Reference>();
  for (const m of text.matchAll(CODE_LINK_RE)) {
    const path = m[1];
    const prev = out.get(path);
    out.set(path, {
      kind: "code",
      targetHint: path,
      evidence: path,
      count: (prev?.count ?? 0) + 1,
    });
  }
  return [...out.values()];
}
