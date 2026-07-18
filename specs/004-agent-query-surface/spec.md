# Feature Specification: Agent Query Surface

**Feature Branch**: `004-agent-query-surface`

**Created**: 2026-07-18

**Status**: Draft

**Input**: User description: "Expose the spec-relationship model to agents and automation — a headless query surface over the feature-002 graph that runs outside the editor."

## Clarifications

### Session 2026-07-18

- Q: How should the query surface be delivered? → A: **Both** — a CLI (for people/CI) and a local MCP server (for agents), sharing one pure core + read-only `node:fs` adapter.
- Q: Is the CI-gate "assert" mode (fail on orphans, etc.) in scope for 004? → A: **Yes, in scope now** (opt-in check with a machine-detectable pass/fail signal; both surfaces expose it).
- Q: What output format should the surface produce? → A: **JSON (versioned envelope) as the contract, plus an optional human-readable text mode for the CLI.**

## User Scenarios & Testing *(mandatory)*

### User Story 1 - An agent queries the graph without the editor (Priority: P1)

An agent (or a person, or a script) working in a Spec Kit repository — with no editor
open — asks the query surface for the specification graph, or for a single spec's
relationships, and gets back structured, machine-readable data: the nodes, the inferred
edges (with their confidence tier, weight, and evidence), scoped to the project. This is
the same model feature 002 produces, reached from outside VS Code.

**Why this priority**: This is the core value — making the graph usable by an agent
mid-task ("what relates to the spec I'm editing?") and by automation, reusing the pure
core exactly as the constitution's Principle I anticipated. The smallest useful slice is:
point the surface at a workspace and get the graph / a spec's relationships back.

**Independent Test**: Run the surface against a fixture repository (no editor) and confirm
it returns the same node/edge model the core produces, including a single spec's
dependencies and dependents with tier/weight/evidence.

**Acceptance Scenarios**:

1. **Given** a Spec Kit workspace and no editor, **When** the surface is asked for the
   project graph, **Then** it returns the nodes and edges as structured data equivalent to
   the model feature 002 builds.
2. **Given** a specific spec, **When** the surface is asked for that spec's relationships,
   **Then** it returns what the spec depends on and what depends on it, each with its
   heuristic, confidence tier, weight, and evidence.
3. **Given** the default heuristic settings, **When** the surface builds the graph,
   **Then** the results match the model's defaults (risky/​spec→code off), and the settings
   are adjustable per invocation.

---

### User Story 2 - Status and orphan insight (Priority: P2)

The consumer asks higher-level questions: an implementation-status / completeness summary
across the project's specs, and which specs are isolated (no relationships to any other
spec). These let an agent or reviewer reason about where the project stands and spot
disconnected work.

**Why this priority**: These are the queries that turn raw graph data into decisions;
they build directly on US1's model access.

**Independent Test**: Run the summary and orphan queries against a fixture with mixed
status/completeness and at least one isolated spec; confirm the counts and the orphan list
match the model.

**Acceptance Scenarios**:

1. **Given** a project, **When** the status summary is requested, **Then** it reports each
   spec's status and task-completion and an aggregate view.
2. **Given** a project with an isolated spec, **When** the orphan query is requested,
   **Then** that spec appears in the result and connected specs do not.

---

### User Story 3 - A deterministic check for CI (Priority: P3)

An automation pipeline runs the surface as a check: given the same repository and
settings, it produces the same result every time, and it can signal pass/fail (for
example, fail when a spec is orphaned) so a pipeline can gate on it.

**Why this priority**: Turns the surface into an enforceable guardrail, but depends on the
query capability (US1/US2) being in place first.

**Independent Test**: Run the surface twice on an unchanged repository and confirm
byte-identical output; run an opt-in check on a repo that violates a rule and confirm a
clear failure signal (and success on a clean repo).

**Acceptance Scenarios**:

1. **Given** an unchanged repository and identical settings, **When** the surface runs
   twice, **Then** the two outputs are identical.
2. **Given** an opt-in check (e.g. "no orphaned specs") and a repository that violates it,
   **When** the check runs, **Then** it reports failure distinctly from success.

---

### Edge Cases

- **Not a Spec Kit workspace / no specs**: the surface returns an empty-but-valid result
  (empty graph), not an error.
- **Malformed or partial specs**: results degrade to a partial graph plus per-item
  warnings in the output — never a crash or a silently dropped project.
- **Multi-project tree**: results are scoped per project; a caller can target one project
  or receive all as independent sub-graphs; no edges cross projects.
- **Unknown spec id in a single-spec query**: a clear "not found" result, not a crash.
- **Large workspace** (hundreds of specs across dozens of projects): completes without
  requiring the editor and within a reasonable time for interactive agent use.
- **Concurrent invocations**: multiple read-only invocations do not interfere (no shared
  mutable state, no lock files).

## Requirements *(mandatory)*

### Functional Requirements

**Reuse & scope**

- **FR-001**: The surface MUST build its results from the existing feature-002 model,
  reused unchanged — it MUST NOT re-implement or alter parsing, inference, or the graph.
- **FR-002**: The surface MUST run fully headless — outside the VS Code extension host,
  with no dependency on the editor being open or installed.
- **FR-003**: The surface MUST share the same pure core as the extension; the only new
  input path is reading spec files directly from the filesystem (read-only).

**Queries**

- **FR-004**: The surface MUST return the full graph for a project (or all projects) as
  structured, machine-readable data.
- **FR-005**: The surface MUST return a single spec's relationships — both directions
  (depends-on and depended-on-by) — each with heuristic, confidence tier, weight, and
  evidence.
- **FR-006**: The surface MUST return an implementation-status / completeness summary
  across a project's specs (per-spec and aggregate).
- **FR-007**: The surface MUST return the set of isolated/orphaned specs (no relationships).
- **FR-008**: All queries MUST be scoped per project and MUST NOT return edges that cross
  projects; a caller MUST be able to target one project or receive all as independent
  sub-graphs.
- **FR-009**: The surface MUST honor the model's tiered, toggleable heuristics with the
  same defaults (links on/locked, slug/shared-entity on, bare-number/​spec→code off), and
  MUST allow those to be adjusted per invocation.

**Output contract**

- **FR-010**: The machine-readable output MUST be **JSON**, a single **versioned envelope**
  (explicit schema version) so consumers can evolve safely. The CLI MUST additionally offer
  an **optional human-readable text mode**; JSON remains the canonical contract (and the
  default/only format the MCP surface emits).
- **FR-011**: Given the same repository and settings, output MUST be deterministic
  (stable ordering, identical bytes) so it can be diffed and asserted.
- **FR-012**: Warnings and partial results MUST be represented in the output (never a
  crash), consistent with the model's resilient-parsing behavior.

**Automation / check**

- **FR-013**: The surface MUST support an opt-in check mode that evaluates a rule (e.g.
  "no orphaned specs") and reports pass/fail distinctly, suitable for gating a pipeline.

**Delivery**

- **FR-017**: The surface MUST be delivered as **both** a **CLI** (for people and CI) and a
  **local MCP server** (for agents), both sharing the same pure core and read-only
  filesystem adapter. Every query (FR-004…FR-008) and the check (FR-013) MUST be reachable
  through both surfaces, returning equivalent results.

**Read-only, offline, private**

- **FR-014**: The surface MUST NOT create, modify, move, or delete anything in the
  workspace — no cache, no "memory" file, no annotations (Principle III). It only reads
  specs and emits results to its own output channel.
- **FR-015**: The surface MUST function fully offline (no network) and MUST NOT collect or
  transmit telemetry.
- **FR-016**: The surface MUST work on a vanilla Spec Kit repository with no proprietary
  metadata required.

### Key Entities *(include if data involved)*

- **Query**: a request to the surface — e.g. get-graph, get-spec-relationships,
  status-summary, orphans, check — with optional project scope and heuristic settings.
- **QueryResult**: a versioned, machine-readable envelope carrying the requested data plus
  any warnings.
- **CheckResult**: a pass/fail outcome for check mode, with the violating specs listed.
- *(Reused unchanged from feature 002: `SpecNode`, `RelationEdge`, `ProjectGraph`,
  `WorkspaceGraph`, `GraphOptions`, `Warning`.)*

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With no editor open, a consumer can obtain a project's graph via the surface,
  and it equals the model feature 002 builds for that project.
- **SC-002**: A single-spec relationship query returns the correct dependencies and
  dependents (matching the model), each carrying tier, weight, and evidence.
- **SC-003**: The status summary and orphan queries match the model (correct per-spec
  status/completeness and the exact set of isolated specs).
- **SC-004**: No query, in any scenario, creates/modifies/moves/deletes any workspace file,
  and no network request is made.
- **SC-005**: Running the surface twice on an unchanged repository yields byte-identical
  output (deterministic).
- **SC-006**: In a multi-project tree, results contain zero cross-project edges and a
  caller can retrieve exactly one project's sub-graph.
- **SC-007**: The opt-in check reports failure on a repository that violates its rule and
  success on one that does not, via a distinct, machine-detectable signal.
- **SC-008**: On a workspace of hundreds of specs, a query completes without the editor and
  fast enough for interactive agent use (target: a few seconds, no hang).

## Assumptions

- **Delivery mechanism** (clarified 2026-07-18): **both** a CLI and a local MCP server,
  pull-based sibling entry points over the same pure core (no workspace writes). See FR-017.
- **CI assert mode** (clarified): **in scope for 004** (FR-013 / US3) — both surfaces expose
  the opt-in check with a machine-detectable pass/fail signal.
- **Output** (clarified): JSON is the canonical, versioned contract for both surfaces; the
  CLI additionally offers an optional human-readable text mode (FR-010). The concrete JSON
  envelope shape is a plan detail; it reuses feature 002's model types.
- **Distribution**: the surface is a sibling of the extension in the same repository,
  sharing the core; it is expected to be published separately from the `.vsix` (e.g. as a
  runnable command / package). The exact packaging is a plan detail.
- **The read-only, offline, no-write posture is fixed**: a persisted-memory-file / cache
  variant is out of scope and would require a constitution amendment (Principle III) before
  it could be specified.
- Filesystem access is read-only and uses a Node adapter mirroring the extension's
  injected-I/O design (the core itself stays pure).

## Dependencies

- **Feature 002 (spec-graph-model)** — provides the graph model and its `parseFeature` /
  `buildProjectGraph` / `buildWorkspaceGraph` core, reused unchanged.
- **Feature 001 (extension scaffold)** — established the pure `core/` and the injected-I/O
  design that makes a headless sibling adapter possible.
- Governed by the project constitution (pure core, read-only, offline, telemetry-free,
  ecosystem-neutral, resilient parsing).

## Out of Scope

- Rendering or visualizing the graph (feature 003).
- Any change to parsing, inference, or the model/heuristics (feature 002).
- Writing anything into the user's workspace — cache, memory file, or annotations
  (would require a constitution amendment).
- Remote or hosted operation; multi-user servers; authentication.
