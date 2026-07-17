<!--
SYNC IMPACT REPORT
==================
Version change: (template / unversioned) → 1.0.0
Change type: Initial ratification (template placeholders replaced with concrete principles)

Modified principles: N/A (initial adoption)
Added principles:
  - I. Pure Domain Core, Thin Editor Shell
  - II. Resilient Parsing Over Rigid Schemas
  - III. Read-Only by Default
  - IV. Responsive at Workspace Scale
  - V. Complement the Ecosystem, Require Nothing Proprietary
  - VI. Offline, Private, Telemetry-Free
Added sections:
  - Technology & Architecture Constraints
  - Development Workflow & Quality Gates
  - Governance (amendment procedure, versioning policy, compliance)

Removed sections: None

Templates requiring updates:
  - ✅ .specify/templates/plan-template.md — "Constitution Check" gate is a generic
       placeholder ("[Gates determined based on constitution file]"); compatible, no
       edit required. Filled per-feature against Principles I–VI.
  - ✅ .specify/templates/spec-template.md — generic; no principle-driven mandatory
       sections added or removed. No edit required.
  - ✅ .specify/templates/tasks-template.md — generic; task categorization unaffected.
       No edit required.
  - ✅ .specify/templates/checklist-template.md — generic; no edit required.

Follow-up TODOs: None. All governance dates supplied; no deferred placeholders.

Naming note (non-blocking): "SpecKit Atlas" is a working name — confirm availability
on the VS Code Marketplace and Open VSX and rename throughout before publishing.
-->

# SpecKit Atlas Constitution

<!--
SpecKit Atlas — a VS Code extension that reads GitHub Spec Kit repositories and
renders the relationships between specs (dependencies, cross-references, shared
data-model entities) alongside implementation status. Companion to, not a
replacement for, the speckit-companion extension.

NOTE: "SpecKit Atlas" is a working name — rename throughout before publishing to
the Marketplace and check the name is available on the VS Code Marketplace and
Open VSX.
-->

## Core Principles

### I. Pure Domain Core, Thin Editor Shell

All specification discovery, parsing, and graph-model construction MUST live in a
pure TypeScript core with **zero imports from the `vscode` API** and no DOM,
webview, or Node-only globals leaking into its public surface. The editor
integration layer (commands, tree/graph views, file watchers) and the webview
renderer are thin adapters that only consume the core's output and translate user
events back into core calls.

Rationale: The correctness of this extension lives almost entirely in its parser,
and the `vscode` API is slow and awkward to unit-test. A headless core can be
tested in plain Node in milliseconds, reused unchanged by a CLI or a CI check, and
ported to a web build later. Coupling parsing to the editor would make the hardest,
most valuable logic the least testable — the opposite of what this project needs.

### II. Resilient Parsing Over Rigid Schemas

The parser MUST tolerate the full variety of real Spec Kit repositories: numbered
and unnumbered feature folders, missing or partial artifacts (`spec.md`,
`plan.md`, `tasks.md`, `data-model.md`, `contracts/`), community presets (AIDE,
Canon, Product Forge, and others) that alter the folder shape, and malformed
Markdown or front-matter. Unexpected, missing, or invalid input MUST degrade to
partial results and a clear per-item warning — never an uncaught exception, a
crashed extension host, or a silently empty graph. Any heuristic that can produce
false relations (e.g. inferring references from bare feature numbers) MUST be
individually documented and toggleable.

Rationale: The user runs this across many projects, each potentially structured
differently. A tool that only works on a pristine, canonical repo is a tool that
works nowhere. Graceful degradation is the feature.

### III. Read-Only by Default

The extension MUST NOT create, modify, move, or delete any file in the user's
workspace as part of its core function. It observes specifications and renders
them. If a write-capable feature is ever introduced (e.g. adding a `depends_on`
front-matter key from the UI), it MUST be explicit, opt-in, previewable, and
reversible, and it MUST be introduced via a constitution amendment.

Rationale: These specs are the source of truth for the user's real projects. An
analysis tool earns trust by being incapable of corrupting the thing it analyzes.

### IV. Responsive at Workspace Scale

The extension MUST remain responsive on large and multi-root workspaces
(target: hundreds of specs across dozens of projects). Activation MUST be lazy
(scoped `activationEvents`, no work on VS Code startup unless a Spec Kit workspace
is detected). The initial scan MUST NOT block the extension host; parsing results
MUST be cached and updated **incrementally** in response to debounced file-system
events rather than by full re-scans. Target budgets: extension activation adds
< 50 ms to host startup, and an incremental update after a single file save
reflects in the graph in < 200 ms on a 200-spec workspace. Budgets are asserted,
not aspired to.

Rationale: Slow, eager extensions are the ones users disable. Scale is a stated
requirement here, so performance is a principle rather than a nice-to-have.

### V. Complement the Ecosystem, Require Nothing Proprietary

The extension MUST provide its full core value on a **vanilla, unmodified Spec Kit
repository** with no proprietary metadata, config file, or annotation required.
Optional enrichment (e.g. reading `depends_on` / `related` front-matter, or a
project-level config) MAY improve the graph but MUST never be a precondition for
it. The extension MUST coexist cleanly with speckit-companion and Spec Kit's own
file layout, and MUST NOT claim file associations, commands, or view containers
that conflict with them.

Rationale: Adoption depends on fitting into a workflow the user already values.
Anything that demands the user re-annotate their repos, or that fights the tools
they already run, will not be used.

### VI. Offline, Private, Telemetry-Free

The extension MUST function fully offline, behind firewalls, and in air-gapped
environments — no runtime network calls, no remote fonts, scripts, or assets in
the webview. It MUST NOT collect or transmit telemetry, usage data, or workspace
contents. Introducing any telemetry, even anonymous and opt-in, requires a
constitution amendment and a MAJOR version bump.

Rationale: This mirrors Spec Kit's own offline/enterprise ethos, and the tool
operates over private source code. Privacy is not a setting to be defaulted on
later — it is the starting posture.

## Technology & Architecture Constraints

- **Language:** TypeScript in `strict` mode. `any` requires an inline justification
  comment; `// @ts-ignore` is prohibited in the domain core.
- **Layering:** `core/` (pure, principle I) → `extension/` (VS Code adapters) →
  `webview/` (renderer). Dependencies point inward only; `core/` imports from
  neither of the others.
- **Rendering:** The graph renders in a **sandboxed webview** governed by a strict
  Content-Security-Policy that forbids remote sources and inline event handlers.
  The renderer receives a serialized graph model via `postMessage`; it never reads
  the file system directly.
- **Runtime dependencies:** Kept minimal and audited. A graph/layout library MAY be
  bundled, but MUST be local (no CDN) and MUST not pull the bundle past a stated
  size budget. Prefer built-ins and small, focused libraries over frameworks.
- **Build & packaging:** Bundled with esbuild; packaged with `vsce` and published to
  both the VS Code Marketplace and Open VSX. Declare the minimum supported
  `engines.vscode` explicitly and test against it.

## Development Workflow & Quality Gates

- **Fixture-driven parsing:** A corpus of representative Spec Kit fixture
  repositories lives in the repo. Every change to a parsing heuristic MUST add or
  update a fixture and assert the resulting graph model. A heuristic change with no
  fixture is not mergeable.
- **CI is the gate:** Type-check, lint, format check, and the full test suite MUST
  pass before merge. The pure core suite runs on plain Node; editor-integration
  tests run under `@vscode/test-electron`.
- **Versioning:** The extension follows semantic versioning. User-visible behavior
  changes require a CHANGELOG entry.
- **Constitution check:** `/speckit.plan` and `/speckit.analyze` MUST verify each
  feature against these principles; a plan that violates a principle without a
  recorded, justified exception does not proceed to `/speckit.implement`.

## Governance

This constitution supersedes ad-hoc convention and preference in any conflict.
It applies to all specs, plans, tasks, and implementation work in this repository.

**Amendment procedure:** Propose a change via pull request that (1) states the
principle or section affected, (2) justifies the change with a concrete use case,
and (3) records the resulting version bump. Amendments merge only after review.

**Versioning policy:** MAJOR for backward-incompatible removals or redefinitions of
a principle (or introducing telemetry, per Principle VI); MINOR for a new principle
or materially expanded guidance; PATCH for clarifications and wording.

**Compliance:** All pull requests are reviewed for conformance to these principles.
Any deliberate deviation MUST be documented as an explicit, justified exception in
the relevant plan; unexplained complexity or coupling is grounds to send work back.

**Version**: 1.0.0 | **Ratified**: 2026-07-17 | **Last Amended**: 2026-07-17
