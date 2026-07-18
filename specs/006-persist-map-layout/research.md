# Research: Persist Map Layout Across Close/Reopen

Feature 006. Resolves the open technical choices behind the plan. No unresolved
`NEEDS CLARIFICATION` remain.

## D1 — Where to persist positions (must stay read-only)

**Decision**: Persist in `context.workspaceState` (a VS Code `Memento`) under one key,
`speckitAtlas.mapLayout`. The host owns the store; the webview never persists.

**Rationale**:
- `workspaceState` is editor-managed storage, **not** a file in the user's repo, so it
  satisfies Principle III (Read-Only) — no create/modify/move/delete of workspace files.
- It is workspace-scoped and survives a full editor restart, satisfying FR-005's
  "SHOULD persist across editor restarts" in addition to the primary close/reopen case.
- It is entirely local, satisfying Principle VI (offline, telemetry-free).

**Alternatives considered**:
- *Webview `getState()/setState()`* — lost when the panel is disposed on tab close,
  which is exactly the moment we must survive. Insufficient on its own. (We may still
  mirror into it for intra-session hidden/shown, but the Memento is the source of truth.)
- *`WebviewPanelSerializer` / `registerWebviewPanelSerializer`* — restores panels open
  at shutdown but does not help the ordinary close-then-manually-reopen flow, and adds
  lifecycle complexity. Rejected as the primary mechanism.
- *A dotfile in the workspace (e.g. `.speckit-atlas/layout.json`)* — directly violates
  Principle III. Rejected.
- *`globalState`* — not workspace-scoped; arrangements would bleed across projects.
  Rejected in favor of `workspaceState`.

## D2 — Position key: how to identify a node's saved position

**Decision**: Key positions by the composite `(projectId, nodeId)`, stored as a nested
map `{ [projectId]: { [nodeId]: {x, y} } }`, plus one viewport per project.

**Rationale**: `nodeId` is the feature slug (e.g. `006-persist-map-layout`) and is only
unique *within* a project — two projects can each have a `001-…`. The map renders a
single project (or all projects when `activeProjectId` is null), so composite keying
prevents one project's arrangement from clobbering another's and satisfies FR-008
(per-project arrangements). These ids are already the stable identifiers used by the
existing incremental-update path, so no new identity scheme is introduced (spec
Assumption).

**Alternatives considered**: flat `{nodeId: {x,y}}` — breaks on cross-project slug
collisions and conflates arrangements. Rejected.

## D3 — Applying a saved layout when the node set changed (partial / stale)

**Decision**: On (re)open, compute the intersection of saved positions and current
nodes:
- **All current nodes have a saved position** → run Cytoscape layout `name: "preset"`
  (uses each node's `position`); no force simulation.
- **Some nodes are new** → seed the known nodes at their saved positions and place the
  new nodes without moving the known ones: run `cose` **only over the new nodes**
  (`{ name: "cose", eles: <newNodes>, randomize: false }`) so existing nodes stay put,
  then leave known nodes as preset. (If constraining `cose` to a subset proves
  unreliable in the bundled Cytoscape version, fall back to placing each new node at the
  centroid of its connected saved neighbours, or the graph centroid if isolated.)
- **No saved position for any current node** (or store empty) → today's behavior: full
  `cose`.
- **Stale entries** (saved nodeIds no longer present) → pruned from the store on save;
  never applied.

**Rationale**: Honors FR-002/FR-006/FR-007 — restore what we can, place newcomers
without scrambling, drop the dead. Keeps the common "unchanged set" path on the cheap
`preset` route (FR-013, SC-002).

**Alternatives considered**: always full `cose` seeded with `randomize:false` from saved
positions — still perturbs every node and fails SC-001's "0 px drift". Rejected for the
unchanged-set case; retained only as the new-node fallback.

## D4 — Capturing positions from the webview

**Decision**: In `map/main.ts`, after render, listen for `dragfree` (a node drag ended)
and `layoutstop` (an auto-layout settled). On either, collect `cy.nodes().map(n => [id,
n.position()])` plus `{ pan: cy.pan(), zoom: cy.zoom() }` and post a **debounced**
`persistLayout` message (`{ projectId, positions, viewport }`) to the host. Also capture
on `pan`/`zoom` end for viewport freshness, debounced together.

**Rationale**: `dragfree` captures FR-004 manual placement; `layoutstop` captures the
settled auto-layout so even a never-dragged graph persists a stable arrangement. Debounce
(≈150–250 ms) keeps drag interactions from flooding `postMessage` and the Memento
(Principle IV). The host writes through to `workspaceState` on each report.

**Alternatives considered**: capture on every `position` tick — far too chatty.
Rejected. Capture only on panel dispose — the webview can't reliably run code during
disposal, and the message may not arrive. Rejected in favor of continuous debounced
reporting.

## D5 — Which project's positions to report, and viewport scope

**Decision**: The webview tags each `persistLayout` with the `projectId` it is currently
showing (the host's `activeProjectId`, forwarded in `render`; when the map shows all
projects, positions are still keyed per `(projectId, nodeId)` from each node's
`projectId` data field). Viewport is stored per project (and a `__all__` bucket for the
all-projects view).

**Rationale**: Keeps FR-008 per-project isolation intact even when the user switches the
active project between sessions. Node `data.projectId` already exists in `CyNodeData`, so
the webview can bucket positions correctly without new host round-trips.

## D6 — Reset layout (escape hatch, FR-010)

**Decision**: Add a "Reset layout" button to the controls sidebar. It sends a new
`resetLayout` `ControlsToHost` message; the host clears the active project's entry in
`workspaceState` and posts a new `relayout` `HostToPanel` message; the webview discards
seeded positions and runs a fresh `cose`, then reports the new settled layout (which
re-populates the store). A pure `resetEnabled(activeProjectId, store)` helper drives the
button's disabled state and is unit-tested.

**Rationale**: Prevents the saved arrangement from becoming a trap (spec Edge Case).
Mirrors the existing controls→host→panel message pattern (feature 003), so no new
architecture.

**Alternatives considered**: a command-palette-only reset — less discoverable for a
purely visual concern. Provide the button; a palette command is a cheap optional add.

## D7 — Determinism of first-time layout (nice-to-have)

**Decision**: Out of scope to change the `cose` algorithm. Persistence makes the *second
and later* opens stable regardless of `cose`'s nondeterminism, which is what the user
reported. We will **not** rely on seeding `Math.random` for determinism.

**Rationale**: Once positions are persisted, the very first `cose` result is captured and
reused, so first-open nondeterminism no longer produces a visible "scramble on reopen".
Keeps scope tight.

## Summary of decisions

| ID | Decision |
|----|----------|
| D1 | Persist in `context.workspaceState` Memento (`speckitAtlas.mapLayout`); read-only, survives restart. |
| D2 | Key positions by composite `(projectId, nodeId)`; nested map + per-project viewport. |
| D3 | `preset` for unchanged sets; subset-`cose`/centroid for new nodes; prune stale; full `cose` when empty. |
| D4 | Webview reports debounced `persistLayout` on `dragfree`/`layoutstop`/viewport-end. |
| D5 | Positions bucketed per project via node `data.projectId`; viewport per project. |
| D6 | "Reset layout" control → clear Memento + `relayout` → fresh `cose`. |
| D7 | No `cose`-determinism change; persistence alone removes the reopen scramble. |
