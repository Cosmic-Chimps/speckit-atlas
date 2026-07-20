# Phase 0 Research: View Graph JSON

The three shaping choices ("view, export, json graph?") were resolved before the spec was
written (output, payload, scope). This records the design decisions for *how* those resolved
requirements are implemented. No `NEEDS CLARIFICATION` markers remain.

---

## R-1 — Payload: reuse the 004 versioned graph envelope

**Decision**: The JSON is the `kind:"graph"` `QueryResult` envelope
(`{ schemaVersion, kind:"graph", data, warnings }`) — identical to what the CLI `graph` command
and the MCP `atlas_graph` tool already return.

**Rationale**: The user asked to see "the json we are using to generate the graph." The 004
query layer's graph envelope is exactly that canonical, deterministic, contract-defined
representation (`specs/004-agent-query-surface/`). Reusing it means the editor view, the CLI,
and the agent tool all show the *same* shape (SC-003 across surfaces), with a version stamp so
consumers can evolve safely. Rejected: a bare `WorkspaceGraph` (drops `schemaVersion`/`warnings`
and diverges from the CLI/MCP contract) and the internal Cytoscape render elements (a webview
detail, not the model).

---

## R-2 — A tiny pure `graphEnvelope(graph, scope?)` builds the payload

**Decision**: Add `graphEnvelope(graph: WorkspaceGraph, scope?: QueryScope): QueryResult` to
`src/core/query/queries.ts`: it calls `getGraph(graph, scope)`, derives warnings from the
returned value, and wraps with `toEnvelope("graph", …)`.

**Rationale**: `runQuery` (platform) already composes scan → build → `getGraph` → `toEnvelope`
for the CLI/MCP, but it owns the *scan* and takes a filesystem `root`. The editor already holds
the built in-memory `WorkspaceGraph`, so it needs the same composition *without* re-scanning. A
pure helper over an already-built graph gives that, keeps the command a thin adapter (Principle
I), and makes the exact bytes unit-testable and deterministic (SC-004). It is small enough that
`runQuery`'s `graph` case could later delegate to it, but this feature does not refactor
`runQuery` (no churn).

**Alternatives rejected**:
- *Compose `getGraph` + `toEnvelope` inline in `extension.ts`* — pushes envelope/warning logic
  into the shell and leaves it untested.
- *Call `runQuery`* — would re-scan the filesystem and needs a `root`; wasteful and wrong layer.

---

## R-3 — Warnings scoped to the returned data

**Decision**: `graphEnvelope` derives the envelope's `warnings` from whatever `getGraph`
returned: a single `ProjectGraph` (scoped) → that project's `warnings`; the whole
`WorkspaceGraph` (unscoped) → all projects' warnings flattened. (`getGraph` already returns a
`ProjectGraph` when `scope.projectId` is set, else a `WorkspaceGraph`.)

**Rationale**: The warnings then always describe the data actually shown (FR-008), and stay
deterministic. This is a deliberate, minor refinement over `runQuery`, which flattens *all*
projects' warnings regardless of scope; for an editor view scoped to one project, surfacing
other projects' warnings would be confusing. Documented so the divergence is intentional.

---

## R-4 — Scope follows the controls' active project selection

**Decision**: The command reads the extension's existing `activeProjectId`: when a project is
selected, `scope = { projectId: activeProjectId }`; when "All projects" is active
(`activeProjectId === null`), no scope (whole workspace). A selected project that has since
disappeared from the graph degrades to the whole workspace.

**Rationale**: Matches the resolved clarification and the on-screen context (FR-006) with zero
new UI — the selector already exists (feature 003). `getGraph` returns an empty `ProjectGraph`
for an unknown id, so the stale-selection case is inherently non-throwing; the command treats an
absent project as "no scope" for a friendlier whole-workspace fallback.

---

## R-5 — Delivery: open an untitled JSON document (read-only-safe)

**Decision**: `JSON.stringify(envelope, null, 2)` → `vscode.workspace.openTextDocument({
content, language: "json" })` → `vscode.window.showTextDocument(doc, { preview: true })`. The
document is untitled; the user may Save As themselves.

**Rationale**: Exactly feature 008's pattern (`setupMcpClient` opens an untitled doc). It writes
**no** workspace file, so Principle III (Read-Only) holds with no Complexity-Tracking exception.
Pretty-printing (2-space indent) satisfies FR-004; `language: "json"` gives syntax highlighting
and fold/search for free (no custom viewer, FR-002). Clipboard and a save-dialog were considered
and left out of scope to keep the feature minimal and unambiguously read-only.

---

## R-6 — Command surface & determinism

**Decision**: Register `speckitAtlas.viewGraphJson`, titled "SpecKit Atlas: View Graph JSON",
contributed to the command palette only (no context/title menus — this acts on the workspace
graph, not a specific file). Activation is the existing lazy `onCommand`/`workspaceContains`;
no `activationEvents` or `engines` change. Output is deterministic because `getGraph` sorts
projects/nodes/edges and `toEnvelope` adds no timestamps/run metadata (SC-004).

**Rationale**: The graph is a workspace-level artifact, so a palette command is the right and
sufficient surface; unlike feature 013 (which acts on a file), there is no file to hang
editor/explorer menus off. Determinism is inherited from the 004 layer's existing guarantees.

---

## Summary of decisions

| # | Decision |
|---|----------|
| R-1 | Payload = the 004 versioned `kind:"graph"` envelope (same as CLI/MCP). |
| R-2 | New pure `graphEnvelope(graph, scope?)` in `core/query` composes `getGraph` + `toEnvelope`. |
| R-3 | Warnings derived from the scoped result (deliberate refinement over `runQuery`). |
| R-4 | Scope follows `activeProjectId`; stale selection → whole workspace. |
| R-5 | Deliver by opening an untitled pretty-printed JSON document (feature-008 pattern; read-only). |
| R-6 | Palette-only command `speckitAtlas.viewGraphJson`; no engine bump; deterministic output. |
