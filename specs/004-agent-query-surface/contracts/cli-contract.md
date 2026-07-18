# Contract: CLI (`speckit-atlas`)

A headless Node command (`dist/cli.js`, bin `speckit-atlas`) over the shared core +
`node:fs` read-only scan. JSON by default; optional human text. Read-only, offline.

## Usage

```
speckit-atlas <command> [--root <dir>] [--project <id>] [--format json|text] [heuristic flags]

commands:
  graph                     the whole graph (all projects, or --project)
  spec <spec-id>            one spec's dependsOn / dependedOnBy
  status                    implementation-status / completeness summary
  orphans                   isolated specs
  check [--rule no-orphans] evaluate a rule; exit 1 on failure

heuristic flags (default per feature 002): --slug-mentions/--no-slug-mentions,
  --shared-entities/--no-shared-entities, --bare-numbers, --spec-to-code
  (links are always on)

global: --root <dir> (default: cwd), --format json|text (default: json)
```

## Behavioral contract (assertable by spawning `node dist/cli.js` in plain Node)

- **CLI-1**: `graph --root <fixture> --format json` prints a `QueryResult` envelope
  (`schemaVersion:1`, `kind:"graph"`) whose data equals the model for that fixture.
- **CLI-2**: `spec <id>` prints the relationships envelope; an unknown id prints
  `found:false` and exits **0** (a query, not an error).
- **CLI-3**: `status` and `orphans` print their envelopes matching the model.
- **CLI-4**: `check --rule no-orphans` exits **1** and lists violations when orphans exist;
  exits **0** on a clean repo.
- **CLI-5**: `--format text` prints a human-readable rendering; JSON remains the default.
- **CLI-6**: Running the same command twice on an unchanged repo yields byte-identical
  stdout (deterministic; SC-005).
- **CLI-7**: The command **writes nothing** to the workspace and makes **no network call**
  (SC-004); on a non-Spec-Kit dir it prints an empty-but-valid envelope, exit 0.
- **CLI-8**: `--project <id>` scopes output to one project; output never contains
  cross-project edges (SC-006).
- **CLI-9**: Malformed input → a partial envelope with `warnings`, never a stack trace /
  nonzero-for-crash (nonzero exit is reserved for `check` failures and usage errors).
