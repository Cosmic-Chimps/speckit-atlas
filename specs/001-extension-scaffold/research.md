# Phase 0 Research: Extension Scaffold

This feature is heavily constrained by the project constitution, so most technology
choices are dictated rather than open. Research below records the decisions, their
rationale, and the alternatives rejected. There are no remaining NEEDS CLARIFICATION
items.

## Decision 1: Language & compiler configuration

- **Decision**: TypeScript in `strict` mode, compiled/bundled with **esbuild**. `any`
  requires an inline justification comment; `// @ts-ignore` is banned in `core/`.
- **Rationale**: Mandated by the constitution (Technology & Architecture
  Constraints). esbuild gives sub-second bundles and a single-file output suited to a
  VS Code extension.
- **Alternatives considered**: `tsc`-only emit (slower, produces many files, no
  tree-shaking); webpack/rollup (heavier config, no benefit at this size).

## Decision 2: Minimum supported editor version (`engines.vscode`)

- **Decision**: `engines.vscode` = `^1.90.0`, and CI runs the integration suite
  against that floor as well as `stable`.
- **Rationale**: 1.90 (mid-2024) is old enough to cover essentially all active
  installs while new enough to rely on stable `WebviewView`, `WorkspaceFolder`, and
  `workspaceContains` activation semantics without shims. Declaring an explicit floor
  and testing against it is required by the constitution.
- **Alternatives considered**: Chasing `latest` (excludes users on slightly older
  editors for no gain); a very old floor like 1.75 (drags in compatibility shims and
  a wider test matrix for a scaffold).

## Decision 3: Activation strategy (lazy)

- **Decision**: No `*` / `onStartupFinished` activation. Activate via
  `workspaceContains` globs that signal a Spec Kit repo, plus `onView` for the Atlas
  view. Primary signal: presence of a `.specify/` directory
  (`workspaceContains:**/.specify/`); secondary: a specs layout
  (`workspaceContains:**/specs/*/spec.md`).
- **Rationale**: `workspaceContains` is evaluated by the host cheaply before the
  extension code loads, so the extension adds ~0 ms to startup in non-qualifying
  workspaces (satisfies SC-001 / Principle IV). `.specify/` is created by Spec Kit
  init and is the strongest low-false-positive signal.
- **Alternatives considered**: `onStartupFinished` + programmatic detection (violates
  lazy-activation budget, runs everywhere); a single `spec.md` glob (too broad —
  matches unrelated Markdown projects).
- **Note (Principle II)**: The *runtime* detection that decides whether a root truly
  qualifies (and which roots) is a separate, documented heuristic layered on top of
  activation; activation globs are intentionally permissive, and the core makes the
  authoritative decision. Detection is toggleable/tunable in later parsing features.

## Decision 4: View surface for the scaffold

- **Decision**: Contribute a dedicated **view container** (activity-bar icon) holding
  one **`WebviewView`** (`speckitAtlas.mapView`) that renders a welcome/empty state.
  The future graph will render in this same webview.
- **Rationale**: The constitution requires the graph to live in a sandboxed webview
  receiving a serialized model via `postMessage`. Using a `WebviewView` now — rather
  than a `TreeView` we would later replace — means the scaffold establishes the exact
  surface, CSP, and message channel the real feature needs.
- **Alternatives considered**: `TreeView` + `viewsWelcome` (simpler empty state but a
  throwaway surface, and TreeView cannot host the graph); a `WebviewPanel` opened by
  command (heavier, not persistent in the sidebar).

## Decision 5: Webview security posture

- **Decision**: Strict Content-Security-Policy with a per-load nonce; `default-src
  'none'`, scripts/styles allowed only from the extension's local `media/` via
  `webview.cspSource` + nonce; no inline event handlers; `localResourceRoots` limited
  to the bundled media directory. No remote origins.
- **Rationale**: Directly enforces Principle VI (offline) and the constitution's
  rendering constraint. Establishing the CSP in the scaffold prevents accidental
  remote-asset creep later.
- **Alternatives considered**: Relaxed CSP with inline scripts (fails the constraint);
  loading a CDN layout library (banned).

## Decision 6: Graph/layout library

- **Decision**: **Defer.** The scaffold ships no graph and therefore bundles no
  layout library. The webview renders static welcome markup only.
- **Rationale**: Nothing to lay out yet; adding a dependency now would spend the
  bundle-size budget with no user value and pre-commit an unvalidated choice.
- **Alternatives considered**: Bundling a graph library preemptively (rejected — must
  be local, audited, and justified against a size budget when the graph feature
  actually lands).

## Decision 7: Test tooling

- **Decision**: Pure `core/` tested with the built-in **`node:test`** runner on plain
  Node (no editor). Editor-integration tested with **`@vscode/test-electron`**.
- **Rationale**: Matches the constitution's split ("core suite on plain Node;
  editor-integration under `@vscode/test-electron`") and its "prefer built-ins"
  guidance. `node:test` needs no extra dependency.
- **Alternatives considered**: Vitest/Jest for core (extra dependency, unneeded for a
  headless pure module); Mocha (the classic VS Code default, but a dependency we can
  avoid for the core).

## Decision 8: Packaging & publishing

- **Decision**: Package with `@vscode/vsce`; publish to both the VS Code Marketplace
  and Open VSX. Bundle a single esbuild output; ship `media/` assets locally.
- **Rationale**: Mandated by the constitution; dual-registry keeps the tool available
  to VSCodium/Open VSX users (ecosystem reach).
- **Alternatives considered**: Marketplace-only (excludes Open VSX users).

## Decision 9: Namespacing to avoid companion conflicts (Principle V)

- **Decision**: Namespace every contribution under `speckitAtlas.*` — view container
  id `speckitAtlas`, view id `speckitAtlas.mapView`, commands `speckitAtlas.openMap`
  / `speckitAtlas.refresh`. Contribute **no** file associations.
- **Rationale**: Guarantees clean coexistence with speckit-companion (SC-005 / FR-010);
  distinct ids cannot shadow or be shadowed.
- **Alternatives considered**: Generic ids like `specMap` (risk collision).

## Open items carried to later features (not blocking this scaffold)

- Precise Spec Kit detection heuristics and their toggles (parsing feature).
- Graph model shape beyond the placeholder envelope (data-model feature).
- Chosen graph/layout library and its bundle-size budget number.
