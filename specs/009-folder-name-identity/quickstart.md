# Quickstart / Validation: Folder-Name Identity

Feature 009. Proves relationships form under any numbering scheme, with zero regression on
sequential repos. Run from repo root.

## Prerequisites

- `npm install`. Pure-core work — no editor needed for the core tests.

## Build & static gates

```bash
npm run build
npm run lint
npm run typecheck        # strict; core-purity project passes (change is in pure core)
```

## Automated tests

```bash
npm run test:core        # heuristics + new identity tests (timestamp / mixed / unnumbered + sequential regression)
npm run test:contracts   # element/CSP contracts unaffected
npm run test:cli         # CLI envelopes unaffected
npm run test:mcp         # MCP tools unaffected
npm run test:integration # render/map suites unaffected (consume the model)
```

## Fixtures (fixture-driven, per the constitution)

- `fixtures/graph/timestamp-numbering/` — `YYYYMMDD-HHMMSS-slug` specs that link to and name
  one another.
- `fixtures/graph/mixed-schemes/` — sequential + timestamp + unnumbered folders cross-
  referencing each other.
- existing sequential fixtures (`render-demo`, `cross-links`, …) — regression guards.

## Validation → Success Criteria

1. **SC-001 (timestamp)** — over `timestamp-numbering`, assert the definitive link edges and
   strong slug-mention edges match what the same references produce in a sequential repo.
2. **SC-002 (mixed/cross-scheme)** — over `mixed-schemes`, assert edges form across
   sequential ↔ timestamp ↔ unnumbered, and that unnumbered folders participate in link/name
   edges.
3. **SC-003 (no regression)** — over the existing sequential fixtures, assert the produced
   edge set is **identical** to today's (the render/graph suites stay green unchanged).
4. **SC-004 (no false positives)** — a token that is not a real sibling name produces no
   slug edge; a whole-word mention of a real sibling does.
5. **SC-005 (resilience)** — a malformed/unusual folder name degrades to a warning, never a
   crash; timestamp/unnumbered features never fabricate a numeric reference.

## Real-world check (optional)

Set `.specify/init-options.json` `feature_numbering` to `"timestamp"`, create two new
features that reference each other, open the map → they connect (previously they would not).

## Definition of done

- Static gates green; `test:core` (identity + regression) green; all other suites unchanged.
- Pure `core/` only; no shell/renderer/query/CLI/MCP change; no new dependency; edge model
  unchanged.

## Reference

- Contract: [`contracts/heuristics.md`](./contracts/heuristics.md)
- Data model: [`data-model.md`](./data-model.md)
- Decisions: [`research.md`](./research.md)
