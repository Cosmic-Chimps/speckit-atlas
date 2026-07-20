import { parseArgs } from "node:util";
import { formatText, type GraphOptions, type QueryKind } from "../core/index.js";
import { runQuery } from "../platform/runQuery.js";

/**
 * `speckit-atlas` — headless CLI over the shared core + read-only node:fs scan.
 * JSON by default (the contract); `--format text` for humans. `check` exits 1 on failure.
 * Read-only, offline, no telemetry.
 */
const USAGE = `speckit-atlas <command> [options]

commands:
  graph                     the whole graph (all projects, or --project)
  spec <spec-id>            a spec's dependsOn / dependedOnBy
  specs-for-file <path>     which spec(s) reference a source file (reverse traceability)
  status                    implementation-status / completeness summary
  orphans                   isolated specs
  check [--rule no-orphans] evaluate a rule; exit 1 on failure

options:
  --root <dir>              workspace root (default: cwd)
  --project <id>            scope to one project
  --format json|text        output format (default: json)
  --rule <name>             check rule (default: no-orphans)
  heuristics: --no-slug-mentions --no-shared-entities --bare-numbers --spec-to-code
`;

export function run(argv: readonly string[]): number {
  let parsed;
  try {
    parsed = parseArgs({
      args: [...argv],
      allowPositionals: true,
      options: {
        root: { type: "string" },
        project: { type: "string" },
        format: { type: "string", default: "json" },
        rule: { type: "string", default: "no-orphans" },
        "slug-mentions": { type: "boolean" },
        "no-slug-mentions": { type: "boolean" },
        "shared-entities": { type: "boolean" },
        "no-shared-entities": { type: "boolean" },
        "bare-numbers": { type: "boolean" },
        "spec-to-code": { type: "boolean" },
        help: { type: "boolean", short: "h" },
      },
    });
  } catch (err) {
    process.stderr.write(`${(err as Error).message}\n\n${USAGE}`);
    return 2;
  }

  const { values, positionals } = parsed;
  if (values.help || positionals.length === 0) {
    process.stdout.write(USAGE);
    return values.help ? 0 : 2;
  }

  const command = positionals[0];
  const kinds: Record<string, QueryKind> = {
    graph: "graph",
    spec: "spec",
    "specs-for-file": "file",
    status: "status",
    orphans: "orphans",
    check: "check",
  };
  const kind = kinds[command];
  if (!kind) {
    process.stderr.write(`Unknown command "${command}"\n\n${USAGE}`);
    return 2;
  }
  if (kind === "spec" && !positionals[1]) {
    process.stderr.write(`"spec" requires a <spec-id>\n\n${USAGE}`);
    return 2;
  }
  if (kind === "file" && !positionals[1]) {
    process.stderr.write(`"specs-for-file" requires a <path>\n\n${USAGE}`);
    return 2;
  }

  const options: Partial<GraphOptions> = {
    ...(values["no-slug-mentions"] ? { slugMentions: false } : {}),
    ...(values["slug-mentions"] ? { slugMentions: true } : {}),
    ...(values["no-shared-entities"] ? { sharedEntities: false } : {}),
    ...(values["shared-entities"] ? { sharedEntities: true } : {}),
    ...(values["bare-numbers"] ? { bareNumbers: true } : {}),
    ...(values["spec-to-code"] ? { specToCode: true } : {}),
  };

  const result = runQuery({
    root: values.root ?? process.cwd(),
    kind,
    specId: positionals[1],
    path: positionals[1],
    rule: values.rule,
    projectId: values.project ?? null,
    options,
  });

  const output = values.format === "text" ? formatText(result) : JSON.stringify(result, null, 2);
  process.stdout.write(output + "\n");

  // Only `check` failures (and usage errors above) produce a nonzero exit.
  if (result.kind === "check" && result.data && (result.data as { ok: boolean }).ok === false) {
    return 1;
  }
  return 0;
}

// Bin entry.
process.exit(run(process.argv.slice(2)));
