# Contract: CLI `specs-for-file`

**Binary**: `speckit-atlas` (`src/cli/main.ts`). Read-only, offline, no telemetry.

## Usage

```text
speckit-atlas specs-for-file <path> [options]

options:
  --root <dir>        workspace root (default: cwd); <path> is interpreted relative to it
  --project <id>      scope to one project
  --format json|text  output format (default: json)
  --spec-to-code      force the Spec→Code layer on (default already on)
```

- `<path>` is required; missing → usage error, exit `2` (mirrors `spec <spec-id>`).
- `--root` sets the scan root; `<path>` is normalized workspace-root-relative before matching.

## Output

- `--format json` (default): the `kind:"file"` envelope (see `query-file.md`), pretty-printed.
- `--format text`: human lines, e.g.

  ```text
  # specs for src/core/graph/parseFeature.ts (2 exact)
    002-spec-graph-model      [done]    (exact)
    009-folder-name-identity  [planned] (exact)
  ```

## Exit codes

- `0` always for a successful lookup (including **zero matches** — not an error; FR-014).
- `2` usage error (missing `<path>`, unknown flag).
- (`specs-for-file` never returns `1`; only `check` does.)

## Wiring

`run()` maps `specs-for-file` → `kind:"file"`, passes `positionals[1]` as `path` into
`runQuery({ root, kind:"file", path, projectId, options })`.

## Tests

- `specs-for-file src/x.ts` on a fixture → expected JSON matches the core result (parity).
- missing `<path>` → exit 2 + usage.
- `--format text` snapshot.
- zero matches → exit 0, empty `matches`.
