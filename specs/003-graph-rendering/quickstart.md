# Quickstart & Validation: Graph Rendering

Runnable steps proving the map renders and behaves. Types/behaviors: `data-model.md`,
`contracts/rendering.md`. Graph data comes from feature 002 unchanged.

## Prerequisites

- Node.js (LTS); `npm install` (adds the bundled `cytoscape` runtime dependency).
- Run from the repo root.

## Build & static gates

```bash
npm run typecheck        # strict; core-purity project still passes (core unchanged)
npm run lint
npm run format
npm run build            # esbuild bundles extension + map webview (cytoscape) + controls webview
```

## Bundle-size gate (SC-009 / R-21)

```bash
npm run package          # @vscode/vsce → *.vsix
# assert: .vsix ≤ 2 MB, media/map.js ≤ 800 KB
```

## Pure helper tests (plain Node)

```bash
npm run test:core        # unchanged model tests
npm run test:contracts   # + nodeStyleFor / edgeStyleFor / toCytoscapeElements (R-23..R-25)
                         # + CSP of the panel HTML (R-19)
```

`toCytoscapeElements` tests assert: one element per node/edge, isolated nodes included,
**no cross-project edges**, JSON round-trip. Style helpers assert deterministic
descriptors per status/tier/weight/symmetric.

## Editor-integration tests (`@vscode/test-electron`)

```bash
npm run test:integration
```

Covers: `openMap` creates a center panel (R-1); the sidebar view is controls (R-2);
opening a graph fixture renders nodes/edges (R-5); a `setOption` message rebuilds and
re-renders (R-13); `openSpec` opens the right file read-only and a missing file is handled
(R-11/SC-005); a simulated single-file change updates the model incrementally and
preserves pan/zoom/selection (R-17/SC-003); multi-root shows per-project sub-graphs with
no cross edges (R-16/SC-007); zero workspace writes (Principle III).

## Manual validation (maps to Success Criteria)

1. **F5** the Extension Development Host against `fixtures/graph/cross-links`.
2. **SC-001** — run "Open Map"; the center panel shows the nodes + definitive/strong edges,
   tiers visually distinct.
3. **SC-002** — toggle a heuristic in the sidebar; exactly that type's edges appear/vanish.
4. **SC-005** — select a node → "open spec"; the correct `spec.md` opens read-only.
5. **SC-003** — edit a spec file; the map updates in place within ~200 ms without losing
   your pan/zoom/selection.
6. **SC-006** — open an empty/`malformed` fixture; a sensible empty/partial state renders,
   no crash.
7. **SC-007** — open `fixtures/graph/two-projects`; two sub-graphs, no cross-project edges.
8. **SC-004** — with networking disabled, everything still renders (offline).

## Definition of done

- All gates green; bundle within budget; core unchanged (still pure).
- Manual checks 2–8 pass on the graph fixtures.
- Read-only, offline, no telemetry throughout; the map is interactive on hundreds of nodes.
