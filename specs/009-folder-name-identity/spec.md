# Feature Specification: Folder-Name Identity for Relationships

**Feature Branch**: `009-folder-name-identity`

**Created**: 2026-07-19

**Status**: Draft

**Input**: User description: "Use the folder names as slugs/tags/identity for everything.
A new spec based on 002-spec-graph-model, so relationships are detected regardless of the
feature-numbering scheme (sequential, timestamp, unnumbered, preset)."

## Context & Motivation

Feature `002-spec-graph-model` builds the relationship graph. It already intends that
"unnumbered or preset feature folders still produce nodes; feature-number-based heuristics
simply don't fire for them." But in practice the model recognizes a feature's identity —
and matches references to it — only through a hardcoded **three-digit** slug shape
(`NNN-slug`). So when a team switches to **timestamp** numbering
(`20260719-143022-short-name`, to avoid concurrent `004` collisions) or uses **unnumbered /
preset** folders, the two strongest tiers — definitive **links** and strong
**slug-mentions** — stop forming, and the graph loses most of its edges even though every
node still appears. This feature makes relationship identity the **actual folder name**, so
references resolve regardless of the numbering scheme, restoring the graph 002 promises.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Relationships form regardless of numbering scheme (Priority: P1)

A team uses timestamp-numbered feature folders. When one spec links to or names another
spec's folder, the graph forms the same definitive/strong edges it would for a
sequential-numbered repo — the map is just as connected.

**Why this priority**: This is the reported gap and the whole point — the relationship
view is Atlas's core value, and today it silently collapses under any non-`NNN-` scheme.
It delivers standalone value even if nothing else changes.

**Independent Test**: Build the model over a timestamp-numbered fixture where specs
reference each other; assert the definitive link edges and strong slug-mention edges are
present (matching what a sequential fixture with the same references would produce).

**Acceptance Scenarios**:

1. **Given** a project whose feature folders use timestamp names, **When** one spec has a
   relative link into another's folder, **Then** a definitive edge connects the two.
2. **Given** a spec's text names another spec's full folder name, **When** the model is
   built, **Then** a strong slug-mention edge is produced, count-weighted by mentions.
3. **Given** the same references written in a sequential-numbered repo and a
   timestamp-numbered repo, **When** each model is built, **Then** the resulting edge sets
   are equivalent.

---

### User Story 2 - Mixed and unnumbered schemes connect (Priority: P2)

A repository has a mix — some legacy `003-…` folders, some new timestamp folders, maybe a
preset's unnumbered folders. References across these schemes still connect, and unnumbered
folders participate in link/mention relationships (not just appear as isolated nodes).

**Why this priority**: Real repositories evolve; a migration or a preset shouldn't split
the graph into disconnected islands. Depends on US1's folder-name matching but adds the
cross-scheme and unnumbered coverage.

**Independent Test**: Build the model over a mixed fixture (sequential + timestamp +
unnumbered) with cross-references; assert edges form across the schemes and that unnumbered
folders take part in link/mention edges.

**Acceptance Scenarios**:

1. **Given** a numbered feature and a timestamp feature that reference each other, **When**
   the model is built, **Then** an edge connects them.
2. **Given** an unnumbered/preset folder referenced by another spec via link or by name,
   **When** the model is built, **Then** the corresponding edge is produced.

---

### User Story 3 - No regressions and no new false edges (Priority: P3)

Purely-sequential repositories produce exactly the graph they do today, the number-only
heuristic (bare numbers) stays scoped to numbered features, and matching against folder
names does not invent edges from incidental words.

**Why this priority**: The change touches the core matcher; trust depends on it neither
regressing existing repos nor flooding the graph with plausible-but-wrong edges (002's
central principle). Lower priority because it is about preservation and precision rather
than the headline capability.

**Independent Test**: Re-run the existing sequential fixtures and assert byte-identical
edge sets; assert incidental prose that is not a real sibling folder name produces no edge;
assert bare-number edges only involve features that have a numeric prefix.

**Acceptance Scenarios**:

1. **Given** the existing sequential fixtures, **When** the model is built, **Then** the
   edge set is unchanged from today (no regression).
2. **Given** a token that is not the name of any real sibling folder, **When** the model is
   built, **Then** it produces no slug-mention edge.
3. **Given** a timestamp or unnumbered feature, **When** the bare-number heuristic is
   enabled, **Then** it does not fabricate a numeric reference for that feature and does not
   error.

---

### Edge Cases

- **Timestamp numbering** (`YYYYMMDD-HHMMSS-slug`): link and slug-mention edges form
  normally; the feature has no simple numeric `number`, and the model works without one.
- **Unnumbered / preset folders**: participate in link and name-mention edges; bare-number
  simply does not apply to them.
- **Mixed schemes in one project**: edges form across schemes.
- **Common-word folder names** (e.g. an unnumbered `dashboard`): an incidental whole-word
  mention *does* form a (count-weighted, low) slug-mention edge — accepted per FR-004 as the
  cost of the simple high-recall matcher; the edge is weak and the tier is toggleable.
- **Cross-project name reuse**: two projects that share a folder name still never link
  across projects and never self-edge (unchanged from 002).
- **Malformed / unusual folder names**: degrade to a per-item warning and partial results,
  never a crash (Principle II).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A feature's identity MUST be its **directory name**. The model MUST NOT
  require a specific numeric-prefix format to recognize a feature or to match references to
  it.
- **FR-002**: Definitive **link** edges MUST be detected for relative links into **any**
  sibling feature folder, regardless of that folder's name format (numbered, timestamped,
  or unnumbered).
- **FR-003**: Strong **slug-mention** edges MUST be detected when a feature's text names
  **any real sibling folder**, whatever its format; the edge weight MUST reflect the number
  of mentions (as today).
- **FR-004**: Reference matching MUST resolve against the **actual set of sibling folder
  names** in the project. A **whole-word** mention (delimited by word boundaries, never a
  substring) of **any** real sibling folder name — numbered, timestamp, or unnumbered
  alike — forms a slug-mention edge, count-weighted by the number of mentions. There is no
  special-casing of common single-word names: the guardrails are that the token MUST name a
  **real sibling** (arbitrary words never match) and that weak signals stay weak via count
  weighting. (Resolved decision: highest-recall, simplest matcher; trust rests on the
  real-sibling constraint plus the existing tier/weight encoding.)
- **FR-005**: A feature's numeric `number`, if the folder has a recognizable numeric
  prefix, MUST be derived; otherwise it MUST be **absent** (not fabricated). The model MUST
  function fully with `number` absent.
- **FR-006**: The risky **bare-number** heuristic MUST remain applicable only to features
  that have a numeric prefix; timestamp/unnumbered features MUST NOT produce spurious
  bare-number edges and MUST NOT cause an error.
- **FR-007**: References that cross numbering schemes within one project MUST resolve (a
  numbered feature and a timestamp feature that reference each other are connected).
- **FR-008**: For a purely sequential (`NNN-`) repository, the produced graph MUST be
  unchanged from the current behavior (no regression).
- **FR-009**: The **shared-entity** and **spec→code** tiers (already identity-agnostic)
  MUST continue to work unchanged.
- **FR-010**: Identity MUST be consistent everywhere it surfaces — node id, reference
  matching, and spec search/selection all key on the folder name, with the spec title used
  as the human-readable label where available.
- **FR-011**: Unusual or malformed folder names MUST degrade to a per-item warning and
  partial results, never an exception or a crashed model (Principle II).

### Key Entities *(include if data involved)*

- **Feature identity**: the directory name — the canonical id used for matching, node
  identity, and search. A derived numeric `number` is optional metadata, not identity.
- **Sibling set**: the collection of real feature-folder names in a project, against which
  references are resolved (replacing the hardcoded numeric-slug pattern).
- **Relation edge**: unchanged from 002 (tiered, weighted, evidence-bearing) — this feature
  changes only *how targets are identified and matched*, not the edge model.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a timestamp-numbered repository, link and slug-mention edges form between
  referencing specs — equivalent to the edge set a sequential repo with the same references
  would produce.
- **SC-002**: In a mixed-scheme repository, 100% of cross-scheme references that name a real
  sibling produce an edge.
- **SC-003**: For the existing sequential fixtures, the produced edge set is **identical** to
  today's (zero regression).
- **SC-004**: A token that is not a real sibling folder name produces zero slug-mention
  edges (no new false positives beyond the agreed matching policy).
- **SC-005**: Timestamp/unnumbered features never generate a fabricated numeric reference and
  never crash the heuristics (100% of malformed-name cases degrade to warnings).

## Assumptions

- The "sibling set" is exactly the feature folders Atlas already discovers under a project
  (the model already creates one node per folder with `id` = folder name); this feature
  aligns *matching* to that same identity.
- Numbering schemes in scope: sequential `NNN-`, timestamp `YYYYMMDD-HHMMSS-`, and
  unnumbered / community-preset folder names.
- This revises feature 002's **pure core** (reference extraction + resolution); per the
  constitution it is fixture-driven — new timestamp / mixed / unnumbered fixtures accompany
  the change, and existing sequential fixtures guard against regression.
- No rendering, query, CLI/MCP, or protocol changes are required; those layers consume the
  same model. Downstream features (003 render, 004 query, 007/008 MCP) benefit automatically.
- **Matching policy (resolved)**: whole-word match against the real sibling set, for every
  scheme, count-weighted — no special handling of common single-word names. Chosen for
  highest recall and the simplest, most explainable matcher; the "must be a real sibling"
  constraint and the existing weak-signal weighting are the false-positive guards.
