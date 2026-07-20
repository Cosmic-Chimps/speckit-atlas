# Feature Specification: Spec-Relationship Graph Model

**Feature Branch**: `002-spec-graph-model`

**Created**: 2026-07-17

**Status**: Completed

**Input**: User description: "Build the headless spec-relationship graph model — the core that turns a Spec Kit repository into a graph of its specifications, with no rendering yet."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A per-project relationship graph from a vanilla repo (Priority: P1)

A person (or tool) points the system at a Spec Kit project and receives a structured
graph of that project's specifications: one node per feature, connected by the
relationships that are actually discoverable in the repo — starting with the
relationships we can assert with certainty. No annotation, config, or metadata is
added to the repo; the graph is derived from what is already there. In this feature
the result is data only — it is handed to the existing view envelope in place of
today's empty placeholder; visualizing it is a separate feature.

**Why this priority**: The graph model is the product's core value and the thing
every later consumer (the visual map, an agent-facing query surface, a CI check)
builds on. The smallest useful slice is: real nodes + the high-confidence edges,
scoped to one project.

**Independent Test**: Run the model builder against a fixture project and assert the
returned model has exactly one node per feature folder and the expected set of
definitive (explicit-link) edges — with no rendering involved.

**Acceptance Scenarios**:

1. **Given** a Spec Kit project with several feature folders, **When** the model is
   built, **Then** it contains exactly one node per feature and each node carries a
   stable identifier and a human-readable title.
2. **Given** one spec's files contain a relative link into another feature's files,
   **When** the model is built, **Then** a definitive edge connects the two,
   annotated with the evidence (the link) that produced it.
3. **Given** a project requiring no proprietary metadata, **When** the model is
   built, **Then** the full result is produced from the vanilla repo alone.

---

### User Story 2 - Trustworthy, tiered, tunable relationships (Priority: P2)

Because no repo declares its dependencies (no front-matter, no `depends_on`), every
relationship beyond an explicit link is *inferred*. The consumer needs to trust those
inferences: each edge states which heuristic produced it and how strong it is, weaker
signals are weighted below stronger ones, risky heuristics are off unless explicitly
enabled, and every heuristic can be toggled independently.

**Why this priority**: Inference is where a relationship tool earns or loses trust. A
graph full of plausible-but-wrong edges is worse than a sparse honest one. This story
makes the inference legible and controllable rather than a black box.

**Independent Test**: Against a fixture exercising each heuristic, assert that every
edge reports its heuristic and weight, that turning a heuristic off removes exactly
its edges, and that the risky heuristic produces nothing unless explicitly enabled.

**Acceptance Scenarios**:

1. **Given** one spec's text mentions another feature's full folder slug, **When** the
   model is built, **Then** a strong edge is produced whose weight reflects how many
   times the slug is mentioned.
2. **Given** two specs reference the same data-model entity that is pinned to a
   concrete code type/location, **When** the shared-entity heuristic is enabled,
   **Then** a medium edge connects them; **And** a shared *name* with no code pin does
   not, by itself, produce that edge.
3. **Given** a spec mentions a bare feature number without its slug, **When** default
   settings are used, **Then** no edge is produced; **And** only when the risky
   heuristic is explicitly enabled does that edge appear, clearly marked as low
   confidence.
4. **Given** any heuristic, **When** it is toggled off, **Then** exactly the edges it
   produced disappear and all other edges are unchanged.

---

### User Story 3 - Status and completeness per spec (Priority: P3)

The consumer needs to see, per spec, how mature and how complete it is: its declared
status, how much of its task list is done, and which standard artifacts exist. These
attributes must be cheap to obtain where possible and must survive messy real-world
formatting.

**Why this priority**: Status/progress is what turns a static relationship map into a
picture of where the project stands. It is valuable but layered on top of the nodes
and edges, so it follows them.

**Independent Test**: Against fixtures with varied maturity (complete vs. thin
folders) and messy status strings, assert each node reports the correct completeness
set, a task-completion measure, and a status value that survives trailing whitespace
and parenthetical notes.

**Acceptance Scenarios**:

1. **Given** a feature folder, **When** the node is built, **Then** it reports which
   standard artifacts are present (spec, plan, tasks, research, data-model,
   quickstart, contracts, checklists) — determined without reading file contents.
2. **Given** a `tasks.md` with checked and unchecked items, **When** the node is
   built, **Then** it reports a task-completion measure (completed vs. total).
3. **Given** a status line such as `Implemented (authored retroactively)` or one with
   trailing whitespace, **When** the node is built, **Then** a usable status value is
   extracted without error.

---

### Edge Cases

- **No relationships found**: a project whose specs reference nothing else yields
  isolated nodes — a valid graph, not an error or an empty result.
- **Missing/partial artifacts**: a feature with only some files (e.g. spec + plan, no
  data-model) still produces a node with an accurate completeness attribute.
- **Malformed content**: unparseable markdown / front-matter / task lists degrade to
  a partial node plus a per-item warning; never an exception or a dropped project.
- **Unnumbered or preset layouts**: community-preset or unnumbered feature folders
  still produce nodes; feature-number-based heuristics simply don't fire for them.
- **Cross-project temptation**: two projects that reuse the same feature number/slug
  or a generic entity name MUST NOT be linked to each other.
- **Self-reference**: a spec that links to or names its own feature produces no
  self-edge.
- **Duplicate evidence**: the same relationship supported by multiple signals is one
  edge carrying the combined (strongest) evidence, not several parallel edges.
- **Ambiguous target**: a reference that could resolve to more than one feature is
  recorded as a warning rather than a guessed edge.

## Requirements *(mandatory)*

### Functional Requirements

**Scope & structure**

- **FR-001**: The system MUST build the graph **per project** (per Spec Kit root) and
  MUST NOT create edges between specs that belong to different projects.
- **FR-002**: A multi-root workspace MUST yield one independent sub-graph per project,
  each with its own namespace for feature numbers/slugs.
- **FR-003**: The system MUST produce one node per detected feature/specification.
- **FR-004**: The system MUST hand the resulting model to the existing view envelope,
  replacing the current empty placeholder; it MUST NOT render or lay out the graph
  (a separate feature does that).

**Nodes (two layers)**

- **FR-005**: The system MUST derive each node and its **completeness attribute**
  (which standard artifacts are present) from the file tree alone, without reading
  file contents.
- **FR-006**: The system MUST derive from file **contents** each node's title, an
  implementation status, and a task-completion measure.
- **FR-007**: Status extraction MUST tolerate messy real-world values, including
  trailing whitespace and parenthetical annotations, without failing.
- **FR-008**: The task-completion measure MUST be derived from the checked/unchecked
  state of items in the feature's task list.

**Edges (inferred, tiered, weighted, tunable)**

- **FR-009**: Every edge MUST record the heuristic that produced it, a confidence
  tier, a weight, and the evidence supporting it.
- **FR-010**: The system MUST support a **definitive** heuristic — a relative link
  from one spec's files into another feature's files — enabled at all times.
- **FR-011**: The system MUST support a **strong** heuristic — one spec's text
  mentioning another feature's full folder slug — enabled by default, with weight
  increasing by mention frequency.
- **FR-012**: The system MUST support a **medium** heuristic — two specs referencing
  the same data-model entity — restricted to entities pinned to a concrete code
  type/location, and individually toggleable.
- **FR-013**: The system MUST support a **risky** heuristic — a bare feature number
  mentioned without its slug — **off by default**, opt-in, and marked low-confidence
  when enabled.
- **FR-014**: Each heuristic MUST be individually toggleable. Toggling one off MUST
  remove every edge that no remaining enabled heuristic supports, and leave every edge
  supported solely by other heuristics unchanged. For a pair supported by more than one
  heuristic (collapsed per FR-015), disabling the dominant one MUST re-tier the edge to
  the strongest remaining supporting heuristic rather than delete it.
- **FR-015**: The system MUST NOT emit a self-edge, and MUST collapse multiple signals
  for the same relationship into a single edge.
- **FR-016**: Each heuristic that can produce false relations MUST be documented as
  such.

**Optional spec→code layer**

- **FR-017**: The system MUST optionally expose relationships between specs and the
  source files/code types they reference, as a secondary dimension that is **off by
  default**.

**Resilience & scale**

- **FR-018**: Any missing, partial, malformed, or unexpected input MUST degrade to a
  partial model plus a clear per-item warning — never an uncaught exception, a crash,
  or a silently empty graph.
- **FR-019**: An ambiguous or unresolvable reference MUST be recorded as a warning
  rather than resolved to a guessed edge.
- **FR-020**: A change to a single file MUST allow the model to update only the
  affected portion, rather than requiring a full re-scan.
- **FR-021**: The model builder MUST require **no proprietary metadata**: it works on
  a vanilla Spec Kit repo, and any enrichment metadata is optional.
- **FR-022**: The model MUST be produced without writing to the workspace and without
  any network access.

### Key Entities *(include if data involved)*

- **SpecNode**: one specification/feature. Attributes: stable id, title, status,
  task-completion measure, completeness set (which artifacts exist), and the project
  it belongs to.
- **RelationEdge**: a directed relationship between two SpecNodes in the same project.
  Attributes: source, target, heuristic, confidence tier, weight, evidence.
- **Project (sub-graph)**: the set of nodes/edges for one Spec Kit root; the boundary
  no edge may cross.
- **Warning**: a per-item, non-fatal notice explaining a degradation (missing file,
  malformed content, ambiguous reference).
- **EntityReference** *(medium heuristic)*: a data-model entity a spec references,
  qualified by a concrete code type/location that makes it a reliable match.
- **CodeReference** *(optional layer)*: a source file or code type a spec points to.
  Surfaced as a **node attribute** on the referencing spec (a secondary dimension when
  `specToCode` is enabled) — not a separate graph node or a spec↔code edge in this feature.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For a representative project, the model contains exactly one node per
  feature folder and every definitive (explicit-link) relationship present in the
  repo, with **zero** false definitive edges.
- **SC-002**: **No** edge in any project's sub-graph connects to a spec in a different
  project, even when feature numbers, slugs, or generic entity names coincide.
- **SC-003**: With the risky heuristic at its default (off), the model produces **zero**
  edges attributable to bare feature numbers; enabling it is the only way such edges
  appear, and they are all marked low-confidence.
- **SC-004**: Turning any single heuristic off changes the edge set by exactly the
  edges that heuristic produced (no other edges added or removed).
- **SC-005**: The model layer MUST be able to build the node set and completeness from
  the file tree alone — given only the artifact listing and **zero** file contents, every
  node is present and reports the correct present/absent artifact set. (The adapter still
  reads content in the same pass to infer edges; this criterion is about the model's
  capability, not a requirement that the adapter defer content reads.)
- **SC-006**: Every node exposes a status and a task-completion measure even when the
  source status text is messy (trailing whitespace, parenthetical notes) or the task
  list is partially formatted.
- **SC-007**: Any malformed, missing, or unexpected input yields a partial model with
  a corresponding warning and never throws or empties the graph.
- **SC-008**: After a single file changes, only the affected feature's portion of the
  model needs recomputation (the rest is reusable), on projects of hundreds of specs.
- **SC-009**: Strong-heuristic edge weights increase with mention frequency, so a
  consumer can rank relationships by strength.

## Assumptions

- **Task-completion measure** = completed task items ÷ total task items in the
  feature's task list, expressed as a fraction/percentage; features with no task list
  report "no tasks" rather than 0%.
- **"Code-pinned entity"** = a data-model entity whose definition references a concrete
  code type or location (e.g. a file path or a type-with-location annotation); this is
  the reliable form observed in real repos and the basis for the medium heuristic.
- **Standard artifact set** = spec, plan, tasks, research, data-model, quickstart,
  contracts/, checklists/. Additional/preset artifacts are tolerated but do not change
  the completeness definition.
- **Project boundary** = a Spec Kit root (as detected by feature 001). Feature numbers
  and slugs are unique only within a project.
- **Directed edges**: relationships have a direction (the spec that references →
  the spec referenced); consumers may treat them as undirected for display.
- **Status values are preserved as found** (normalization/classification beyond safe
  extraction is out of scope for this feature).
- Calibration basis: heuristic tiers were validated against a real 27-feature corpus
  (definitive links precise; slug mentions strong; naive shared-name entity matching
  noisy → restricted to code-pinned; bare numbers mostly false → off by default).

## Dependencies

- **Feature 001 (extension scaffold)** — provides Spec Kit project detection and the
  view envelope (`MapViewModel`) whose placeholder graph this feature fills in.
- Governed by the project constitution (pure core, resilient parsing, read-only,
  responsive/incremental, ecosystem-neutral, offline).

## Out of Scope

- Any rendering, layout, or visualization of the graph (a later feature).
- Any agent-facing query surface / CLI / MCP exposure of the model (a later feature).
- Writing the model or any cache/memory into the user's workspace.
- Normalizing or reconciling status vocabularies across specs.
