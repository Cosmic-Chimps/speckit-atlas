# Contract: Edge Heuristics (documented per Principle II)

The constitution requires that every heuristic which can produce false relations be
**individually documented and toggleable**. This is that documentation. Each entry
defines the signal, its tier, weight, default state, toggle, and known failure modes
(from the aerosens spike).

| Heuristic id | Tier | Signal | Weight | Default | Toggle | Known false-positive modes |
|---|---|---|---|---|---|---|
| `link` | definitive | A relative markdown link from A's files into B's feature folder | 1 | **on (locked)** | — | None observed; a link is a fact. |
| `slug-mention` | strong | A's text contains B's full folder slug (`NNN-slug`) | = mention count | on | `slugMentions` | Very low; an incidental single mention (weight 1) is the weakest case. |
| `shared-entity` | medium | A and B both reference the same data-model entity **pinned to a concrete code type/location** | 1 | on | `sharedEntities` | Naive shared *name* matching is noisy (`Type`, `Derived`, `Reused`) — excluded by the code-pin rule. |
| `bare-number` | risky | A mentions B's bare feature number **without** the slug | 1 | **off** | `bareNumbers` | High: performance figures, `Constitution IV`, link text `[001]`, dates. Opt-in only. |
| `spec-code` | (layer) | A links to a source file / pins an entity to a code type | 1 | **off** | `specToCode` | Sparse but real; a secondary dimension, not a spec↔spec edge. |

## Rules common to all heuristics

- **Scope**: a heuristic only ever connects two features **in the same project**
  (FR-001). Cross-project matches are dropped.
- **Direction**: edges are directed referrer → referenced. `shared-entity` is
  symmetric and is emitted as a single canonical direction (lower id → higher id) or
  as an undirected pair — the renderer may present either; the model marks it
  symmetric.
- **Collapse**: if several heuristics connect the same ordered pair, emit ONE edge at
  the strongest tier, merging `evidence` and keeping the max weight.
- **Self**: a feature referencing itself never yields an edge.
- **Provenance**: every edge records `heuristic`, `tier`, `weight`, `evidence` so a
  consumer (and the toggle UI in feature 003) can explain and filter it.

## Extraction specifics

- **`link`**: relative-path links resolving to `.../<NNN-slug>/...` within the project.
- **`slug-mention`**: word-boundary match of another feature's exact slug in any of the
  feature's read files; count occurrences (excluding matches that are themselves
  captured as `link`).
- **`shared-entity`**: entity headings in `data-model.md` of the form
  `### <Name> (… <path-or-type>:<optional-line> …)` — the code pin is REQUIRED for the
  entity to participate. Two features sharing such an entity key connect.
- **`bare-number`**: a 3-digit token matching an existing feature number, not part of a
  slug, not a task id (`T0NN`), not a code/line reference (`:0NN`). Off by default.
- **`spec-code`**: relative links to source files (`*.ts/tsx/cs/py/go/js`) and entity
  code pins; recorded as `code` references, surfaced only when `specToCode` is on.
