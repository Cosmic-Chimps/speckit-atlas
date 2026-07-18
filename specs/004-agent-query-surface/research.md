# Phase 0 Research: Agent Query Surface

Delivery/output/CI-mode were resolved by `/speckit-clarify` (both CLI + MCP; CI-assert in
scope; JSON envelope + optional CLI text). Research below fixes the remaining design and
confirms constitution fit. No NEEDS CLARIFICATION items remain.

## Decision 1: A pure query layer in the core (`src/core/query/`)

- **Decision**: The five queries — full graph, a spec's relationships, status/completeness
  summary, orphans, and a check — are **pure functions over a `WorkspaceGraph`**, added as
  `src/core/query/`. Both surfaces call them; nothing is recomputed per-surface.
- **Rationale**: The queries are computations on the already-built model, so they belong in
  the pure core (Principle I) — unit-testable in plain Node, reused verbatim by CLI, MCP,
  and the extension if ever needed. Keeps CLI/MCP as dumb adapters.
- **Alternatives considered**: compute in each adapter (duplication, untestable, drift).

## Decision 2: Read-only `node:fs` scan adapter (`src/platform/nodeScan.ts`)

- **Decision**: A headless scanner mirroring the extension's two-layer scan but using
  `node:fs` (read-only): enumerate `specs/*` per root → artifacts (tree) + read content
  files → `ProjectSnapshot[]`, then `buildWorkspaceGraph` (feature 002, unchanged).
- **Rationale**: The core does no I/O; the CLI/MCP need their own read-only file reader
  (the editor API isn't available headless). Same injected-data shape the extension uses.
- **Alternatives considered**: reuse `extension/projectScan.ts` (impossible — it imports
  `vscode`); a watch/daemon (unneeded — queries are one-shot).

## Decision 3: CLI via built-in `node:util.parseArgs` (no dependency)

- **Decision**: The CLI parses args with Node's built-in `parseArgs` — subcommands
  `graph | spec | status | orphans | check`, flags `--root`, `--project`, `--format
  json|text`, heuristic toggles (`--slug-mentions`, `--shared-entities`, `--bare-numbers`,
  `--spec-to-code`), and check flags. No arg-parsing dependency.
- **Rationale**: "Prefer built-ins and small, focused libraries" (constitution). `parseArgs`
  is sufficient and adds nothing to install/audit.
- **Alternatives considered**: `commander`/`yargs` (unnecessary dependency for a small CLI).

## Decision 4: MCP via `@modelcontextprotocol/sdk` over stdio

- **Decision**: The MCP server uses **`@modelcontextprotocol/sdk`** with the **stdio**
  transport, exposing one MCP tool per query. Launched by an MCP client (Claude Code /
  Desktop) via `command: node dist/mcp.js` (or the published bin).
- **Rationale**: stdio is local-only (no network → Principle VI), the standard MCP transport
  for editor/agent clients; the SDK is the maintained reference implementation. This is the
  one new runtime dependency, scoped to the MCP entry only (it does **not** enter the
  extension `.vsix` bundle).
- **Alternatives considered**: hand-rolling the MCP JSON-RPC (fragile, non-conformant); an
  HTTP transport (would introduce a network surface — rejected).

## Decision 5: Versioned JSON envelope + deterministic ordering

- **Decision**: Every result is a `{ schemaVersion: 1, kind, data, warnings }` JSON
  envelope. All collections are **sorted by stable keys** (node id, then edge
  source/target/heuristic) and contain **no timestamps or absolute paths beyond stable
  ids**, so identical repo + options ⇒ byte-identical output.
- **Rationale**: FR-010/FR-011, SC-005 (diff/assert in CI). Determinism is the whole point
  of the CI use case.
- **Alternatives considered**: unsorted output (non-deterministic); embedding run metadata
  like timestamps (breaks byte-identity).

## Decision 6: Check mode + exit signalling

- **Decision**: `runCheck(graph, rule)` is pure and returns `CheckResult { ok, rule,
  violations[] }`. Rule set starts with **`no-orphans`** (extensible). The **CLI maps
  `ok:false` → exit code 1** (0 on pass); the **MCP tool returns the structured
  `CheckResult`** (agents branch on `ok`).
- **Rationale**: FR-013, SC-007 — a machine-detectable pass/fail on both surfaces.
- **Alternatives considered**: a fixed single rule (less useful); throwing on violation
  (loses the structured violation list).

## Decision 7: Optional human-readable CLI text mode

- **Decision**: A pure `formatText(envelope)` renders a compact table/summary for
  `--format text`; JSON remains the default and the only MCP output.
- **Rationale**: Clarified — JSON is the contract; text is a CLI nicety. Pure ⇒ testable.

## Decision 8: Packaging — sibling bins, out of the `.vsix`

- **Decision**: Add `bin` entries (`speckit-atlas` → `dist/cli.js`, `speckit-atlas-mcp` →
  `dist/mcp.js`) and esbuild Node entries for both. **Exclude `dist/cli.js`/`dist/mcp.js`
  from the `.vsix`** (`.vscodeignore`) — the extension doesn't need them; they ship via npm.
- **Rationale**: The extension and the headless surfaces are distinct artifacts over one
  core/repo (Principle I's "reused by a CLI"). Keeps the `.vsix` lean (feature 003's budget
  untouched).
- **Alternatives considered**: a separate package (more repo overhead now — defer); shipping
  the bins inside the `.vsix` (pointless bloat).

## Decision 9: Tests run in plain Node (no editor)

- **Decision**: Query functions and the envelope/format/check helpers are pure → `node:test`
  on plain Node. The CLI is tested by spawning `node dist/cli.js` against fixtures; the MCP
  server by an in-process SDK client over stdio. **No `@vscode/test-electron` needed.**
- **Rationale**: The whole feature is headless — its tests are fast and editor-free, which
  is itself validation of the "reused by a CLI/CI" goal.

## Open items carried forward

- Whether to split into a separate npm package later (packaging detail).
- Additional check rules beyond `no-orphans` (future).
