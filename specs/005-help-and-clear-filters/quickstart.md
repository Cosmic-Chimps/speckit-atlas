# Quickstart & Validation: Help & Clear Filters

A small controls-sidebar enhancement to feature 003. Types/behaviors: `data-model.md`,
`contracts/controls-ui.md`. No core/model/query changes.

## Build & static gates

```bash
npm run typecheck
npm run lint
npm run format
npm run build            # rebuilds media/controls.js with the new button + help
```

## Pure tests (plain Node)

```bash
npm run test:contracts   # + help-content completeness/consistency + hasActiveFilter
                         #   (HLP-2..HLP-5, H-4)
```

`controls-help.test.ts` asserts: `HELP_ENTRIES` has the five relationship ids with correct
tiers and non-empty descriptions; `defaultOn` matches `DEFAULT_GRAPH_OPTIONS`; `ENCODING_NOTES`
covers node + edge encodings; `hasActiveFilter` truth table.

## Manual validation (VS Code Extension Development Host)

1. **F5** and open the map on `fixtures/graph/render-demo` (or the aerosens workspace).
2. **SC-001/SC-002 (clear filters)** — uncheck some tiers and/or statuses so part of the map
   dims; click **Clear filters** → all nodes/edges return to full visibility and the filter
   controls show "all". The button is disabled when nothing is filtered.
3. **SC-003** — before/after clearing, confirm the relationship toggles, the selected project,
   and any selected node are unchanged.
4. **SC-004 (help)** — open **help**; confirm all five relationship types are explained with
   their tiers, bare-numbers and spec→code are marked off-by-default, and node/edge encodings
   are described. Dismiss it; the map is unchanged.
5. **SC-005** — with networking disabled, help + clear still work; `git status` shows no
   workspace writes.
6. **SC-006** — operate both the Clear-filters button and the help toggle with the keyboard only.

## Definition of done

- Static gates green; `test:contracts` (help + hasActiveFilter) green.
- Manual checks 2–6 pass. Offline, read-only, telemetry-free. No core/model/query/`.vsix`
  budget changes (controls bundle only).
