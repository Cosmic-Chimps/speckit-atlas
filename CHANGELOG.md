# Changelog

All notable changes to this extension are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Extension scaffold (`001-extension-scaffold`): an installable VS Code extension that
  activates lazily in a Spec Kit workspace (detected via `.specify/` or
  `specs/*/spec.md`) and contributes a single namespaced **SpecKit Atlas** activity-bar
  view hosting a sandboxed webview with a welcome/empty state.
- Pure domain core (`src/core/`) with workspace detection and view-model construction,
  unit-tested in plain Node.
- Strict Content-Security-Policy (with per-load nonce) for the webview; no network
  calls, no remote assets, no telemetry.
- Build (esbuild), type-check (strict, incl. core-purity project), lint (with a
  core import-boundary rule), format, and test tooling; CI workflow running the gate
  against the `engines.vscode` floor and `stable`.
- Resilience coverage for malformed Spec Kit workspaces: a `.specify/`-present repo
  with a broken `specs/` layout still activates and degrades to a safe state.
