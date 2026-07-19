/**
 * Static help/legend content for the controls sidebar (feature 005). Pure and DOM-free so
 * it unit-tests in plain Node. Authored from feature 002's `contracts/heuristics.md`; the
 * `defaultOn` flags MUST match `DEFAULT_GRAPH_OPTIONS` (asserted by a test).
 */

export type HelpEntryId = "link" | "slug" | "shared-entity" | "bare-number" | "spec-code";
export type HelpTier = "definitive" | "strong" | "medium" | "risky" | "layer";

export interface HelpEntry {
  readonly id: HelpEntryId;
  readonly label: string;
  readonly tier: HelpTier;
  readonly defaultOn: boolean;
  readonly description: string;
}

export const HELP_ENTRIES: readonly HelpEntry[] = [
  {
    id: "link",
    label: "Links",
    tier: "definitive",
    defaultOn: true,
    description:
      "A spec's files contain a relative link into another feature's folder — an explicit, definitive reference. Always on.",
  },
  {
    id: "slug",
    label: "Slug mentions",
    tier: "strong",
    defaultOn: true,
    description:
      "A spec's text names another feature's full folder slug (e.g. 001-foo). Strong; weighted by how many times it is mentioned.",
  },
  {
    id: "shared-entity",
    label: "Shared entities",
    tier: "medium",
    defaultOn: true,
    description:
      "Two specs reference the same data-model entity that is pinned to a concrete code type/location. Medium confidence.",
  },
  {
    id: "bare-number",
    label: "Bare numbers",
    tier: "risky",
    defaultOn: true,
    description:
      "A spec mentions a bare feature number without its slug. Risky — matches can be coincidental — so toggle it off to hide these.",
  },
  {
    id: "spec-code",
    label: "Spec → code",
    tier: "layer",
    defaultOn: true,
    description:
      "References from specs to source files / code types. An optional secondary layer you can toggle off.",
  },
];

export interface EncodingNote {
  readonly kind: "node" | "edge";
  readonly label: string;
  readonly description: string;
}

export const ENCODING_NOTES: readonly EncodingNote[] = [
  {
    kind: "node",
    label: "Node colour",
    description: "Implementation status (e.g. draft, implemented).",
  },
  {
    kind: "node",
    label: "Node fill",
    description: "Task-completion — the share of tasks checked off.",
  },
  {
    kind: "node",
    label: "Node border",
    description: "A highlighted border marks a spec with warnings.",
  },
  {
    kind: "edge",
    label: "Line style",
    description: "Confidence tier: solid (definitive/strong), dashed (medium), dotted (risky).",
  },
  {
    kind: "edge",
    label: "Line thickness",
    description: "Relationship weight — thicker means stronger/more mentions.",
  },
  {
    kind: "edge",
    label: "Arrowhead",
    description:
      "An arrow marks a directed reference; no arrow means a symmetric (shared-entity) link.",
  },
];

/**
 * Whether any visual filter is narrowing the view (so "Clear filters" is meaningful).
 * `tierAll`/`statusAll` are true when every tier/status option is currently selected.
 */
export function hasActiveFilter(tierAll: boolean, statusAll: boolean): boolean {
  return !tierAll || !statusAll;
}
