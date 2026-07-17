# SpecKit Atlas — Agent Context

VS Code extension that reads GitHub Spec Kit repositories and renders the
relationships between specs (dependencies, cross-references, shared data-model
entities) alongside implementation status. Companion to — not a replacement for —
speckit-companion. ("SpecKit Atlas" is a working name; confirm availability and
rename before publishing.)

## Non-negotiables (from `.specify/memory/constitution.md`)

1. **Pure core, thin shell** — all discovery/parsing/model logic lives in `src/core/`
   with **zero `vscode`/DOM/webview imports**. `extension/` and `webview/` are thin
   adapters. Dependencies point inward only; `core/` imports neither.
2. **Resilient parsing** — partial/malformed/missing input degrades to per-item
   warnings + partial results, never an exception or crashed host. Risky heuristics
   are documented and toggleable.
3. **Read-only** — never create/modify/move/delete workspace files.
4. **Responsive** — lazy activation (`workspaceContains`, no `*`/startup); < 50 ms
   startup cost; incremental cached updates (< 200 ms after a save on 200 specs).
5. **Complement, require nothing proprietary** — full value on a vanilla Spec Kit
   repo; namespace all ids under `speckitAtlas.*`; no file associations; coexist with
   speckit-companion.
6. **Offline, private, telemetry-free** — no network, no remote webview assets (strict
   CSP + nonce), no telemetry ever.

## Tech stack

- TypeScript `strict` (`any` justified inline; `// @ts-ignore` banned in `core/`).
- esbuild bundle; `@vscode/vsce` package → VS Code Marketplace **and** Open VSX.
- `engines.vscode` `^1.90.0` (explicit, tested floor).
- Tests: `node:test` for `core/` (plain Node); `@vscode/test-electron` for
  integration. Fixture-driven — every parsing-heuristic change updates a fixture.

## Layout

```
src/core/        pure domain (detection, model)
src/extension/   activate/deactivate, WebviewViewProvider, the only fs I/O
src/webview/     renderer; receives MapViewModel via postMessage
media/  test/  fixtures/
```

## Active feature

- `001-extension-scaffold` — installable skeleton: lazy activation on Spec Kit
  workspaces, one namespaced webview view showing a welcome/empty state, offline +
  read-only. No parsing/graph yet. See `specs/001-extension-scaffold/`.
