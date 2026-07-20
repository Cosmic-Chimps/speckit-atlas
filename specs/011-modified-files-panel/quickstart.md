# Quickstart: Validating the modified-files list

Validation guide for the Files section in the map detail panel. Details live in
[data-model.md](./data-model.md) and [contracts/](./contracts/).

## Prerequisites

- Repo installed and built: `npm install`, then `npm run compile` (or the project's watch/build).
- The extension's "Spec → code layer" relationship toggle **on** (default) — see Decision D2.

## 1. Pure unit tests (plain Node, fastest)

Run the core + webview unit suites:

```bash
npm test        # or: node --test test/
```

Expected new/updated assertions:

- **Extractor** (`extractCodeReferences`) against fixtures — see `contracts/extraction.md` table:
  backtick paths and relative links captured; bare words, non-code extensions, and un-quoted prose
  paths excluded; duplicates collapse with `count ≥ 2`; a no-code feature yields `[]`.
- **`sortFilesByName`** (`webview/map/elements.ts`) — ascending by basename (case-insensitive),
  full-path tiebreak, de-duplicated, total (empty ⇒ empty). Same input ⇒ identical output (SC-002).
- **`CyNodeData.files`** populated from `SpecNode.codeReferences` in `nodeElement`.

## 2. Fixture-level graph assertion

Confirm a fixture feature whose `tasks.md` lists files (backtick + relative-link forms) produces the
expected `codeReferences` on its `SpecNode` after `buildProjectGraph`, and that an existing
sequential fixture with no code references still yields `codeReferences: []`.

## 3. Manual end-to-end (Extension Development Host)

Launch the extension (F5) on a Spec Kit workspace, open the SpecKit Atlas Map, then:

| # | Action | Expected (maps to) |
|---|--------|--------------------|
| 1 | Select a spec whose `tasks.md` names several files | Detail panel shows a **Files** section listing those files, ascending by name, no duplicates (US1; FR-001/002/003) |
| 2 | Select a spec that references no source files | Files section present with the empty state "No source files referenced" (FR-004) |
| 3 | Select a different spec | List refreshes to that spec's files (FR-005) |
| 4 | Click a listed file that exists | It opens read-only for viewing; workspace unchanged (US2; FR-006/006a) |
| 5 | Click a listed file whose path no longer resolves | Warning shown; map/panel unchanged (US2 scenario 2; FR-007) |
| 6 | Select an edge (relationship) instead of a spec | No Files section; edge detail unchanged (FR-005) |
| 7 | Select a spec referencing many files | List scrolls within the panel; "Open spec" stays reachable (SC-004) |
| 8 | Re-select the same spec several times | Identical order every time (SC-002) |

## 4. Read-only & offline sanity

- Confirm no workspace file is created/modified while browsing/clicking the list (Principle III).
- Confirm no network activity from the webview (Principle VI) — the section is plain DOM in the
  detail panel, no remote assets.

## Success = all of

- Unit + fixture suites green (including the new extractor fixtures).
- Manual table rows 1–8 pass.
- No writes, no network, no unhandled errors on malformed/missing input.
