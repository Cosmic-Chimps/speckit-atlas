import type {
  ProjectGraph,
  RelationEdge,
  SpecNode,
  Warning,
  WorkspaceGraph,
} from "../model/types.js";

/**
 * Query layer types (feature 004). Plain, JSON-serializable, no vscode/DOM/Node imports.
 * The heuristic `GraphOptions` are applied by the adapter at build time (buildWorkspaceGraph);
 * these pure query functions operate on the already-built graph + a projectId scope.
 */

export type QueryKind = "graph" | "spec" | "status" | "orphans" | "check";

/** Filters the built graph. Options are NOT here — they are applied before building. */
export interface QueryScope {
  readonly projectId?: string | null;
}

export interface SpecRelationships {
  readonly spec: SpecNode | null;
  readonly found: boolean;
  readonly dependsOn: readonly RelationEdge[];
  readonly dependedOnBy: readonly RelationEdge[];
}

export interface StatusRow {
  readonly id: string;
  readonly projectId: string;
  readonly status: string | null;
  readonly done: number | null;
  readonly total: number | null;
}

export interface StatusSummary {
  readonly perSpec: readonly StatusRow[];
  readonly aggregate: {
    readonly specs: number;
    readonly byStatus: Readonly<Record<string, number>>;
    readonly tasksDone: number;
    readonly tasksTotal: number;
  };
}

export interface Orphans {
  readonly orphans: readonly string[];
}

export interface CheckResult {
  readonly rule: string;
  readonly ok: boolean;
  readonly violations: readonly string[];
}

/** The versioned, machine-readable envelope every query returns. */
export interface QueryResult {
  readonly schemaVersion: 1;
  readonly kind: QueryKind;
  readonly data:
    WorkspaceGraph | ProjectGraph | SpecRelationships | StatusSummary | Orphans | CheckResult;
  readonly warnings: readonly Warning[];
}
