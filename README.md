# SpecKit Atlas

> ⚠️ **Working name.** "SpecKit Atlas" is a placeholder — confirm availability on the
> VS Code Marketplace and Open VSX and rename before publishing.

A VS Code extension that reads [GitHub Spec Kit](https://github.com/github/spec-kit)
repositories and renders the relationships between specs — dependencies,
cross-references, and shared data-model entities — alongside implementation status.
It is a companion to, not a replacement for, `speckit-companion`.

This repository currently contains the **extension scaffold** (feature
`001-extension-scaffold`): an installable skeleton that activates lazily in a Spec Kit
workspace and shows a placeholder Map view. Specification parsing and graph rendering
land in later features.

## Principles (see `.specify/memory/constitution.md`)

- **Pure core, thin shell** — all logic lives in `src/core/` with zero `vscode`/DOM
  imports and is unit-tested in plain Node.
- **Resilient** — partial/malformed input degrades to warnings, never a crash.
- **Read-only** — the extension never writes to your workspace.
- **Responsive** — lazy activation; no cost until a Spec Kit workspace is detected.
- **Complementary** — full value on a vanilla Spec Kit repo; coexists with
  `speckit-companion`; all contributions namespaced `speckitAtlas.*`.
- **Offline & telemetry-free** — no network calls, no remote assets, no telemetry.

## Architecture

```
src/core/        pure domain (detection + view model) — no vscode/DOM
src/extension/   VS Code adapters (activation, webview provider, the only fs I/O)
src/webview/     sandboxed renderer (strict CSP + nonce)
test/core/       node:test unit tests (plain Node)
test/contracts/  static contract tests (CSP, coexistence, no-telemetry) — plain Node
test/integration/ @vscode/test-electron suites
fixtures/        Spec Kit fixture workspaces
```

## Develop

```bash
npm install
npm run build        # esbuild → dist/extension.js + media/webview.js
npm run typecheck    # strict tsc, incl. core-purity project
npm run lint         # eslint (incl. core import-boundary rule)
npm run format       # prettier --check
npm run test:core        # pure core tests (plain Node)
npm run test:contracts   # static contract tests (plain Node)
npm run test:integration # editor integration (downloads VS Code; needs a display)
```

Press **F5** to launch the Extension Development Host against
`fixtures/vanilla-speckit`.

## Package

```bash
npm run package      # @vscode/vsce → *.vsix
```

Set a real `publisher` in `package.json` first. Publish to both the VS Code
Marketplace and Open VSX.

## Minimum editor version

`engines.vscode`: `^1.90.0` (tested against this floor and `stable` in CI).

## License

MIT — see the `LICENSE` file in this repository.
