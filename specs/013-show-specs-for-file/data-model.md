# Phase 1 Data Model: Show Specs for File

All types are plain, JSON-serializable, and live in the pure query layer (`src/core/query/`) —
no `vscode`/DOM/Node imports (Principle I). They extend the feature-004 query types.

## New / extended types (`src/core/query/types.ts`)

```ts
// Extend the existing union with the reverse-lookup kind.
export type QueryKind = "graph" | "spec" | "status" | "orphans" | "check" | "file";

/** How a file matched a spec's declared code references. */
export type MatchKind = "exact" | "folder";

/** One spec that references the queried file. Flat projection of a SpecNode + match label. */
export interface RelatedSpec {
  readonly specId: string;      // SpecNode.id (folder name / feature id)
  readonly projectId: string;   // owning project (folder URI string) — FR-006
  readonly title: string;       // SpecNode.title, for the quick-pick label
  readonly status: string | null;
  readonly matchKind: MatchKind;
}

/** Result of specsForFile: the (normalized) queried path + its ordered matches. */
export interface SpecsForFile {
  readonly path: string;               // the normalized workspace-root-relative query path
  readonly matches: readonly RelatedSpec[];
}

// Extend the envelope payload union:
export interface QueryResult {
  readonly schemaVersion: 1;
  readonly kind: QueryKind;
  readonly data:
    | WorkspaceGraph | ProjectGraph | SpecRelationships
    | StatusSummary | Orphans | CheckResult
    | SpecsForFile;                     // ← added
  readonly warnings: readonly Warning[];
}
```

`QueryScope` is unchanged and reused (`{ projectId?: string | null }`).

## Shared path normalizer (`src/core/path.ts`, new)

```ts
/**
 * Normalize a captured or queried path to workspace-root-relative form:
 * backslashes → "/", trimmed, leading "./" and "../" segments stripped.
 * Single source of truth shared by feature-011 code-reference extraction and the
 * feature-013 reverse lookup, so both sides of the comparison normalize identically.
 */
export function normalizeWorkspacePath(raw: string): string;
```

`src/core/graph/heuristics.ts`'s private `normalizeCodePath` becomes a thin delegate to this
(behavior-preserving; guarded by the existing 011 fixtures).

## The lookup (`src/core/query/queries.ts`)

```ts
export function specsForFile(
  graph: WorkspaceGraph,
  path: string,
  scope?: QueryScope,
): SpecsForFile
```

**Algorithm** (pure, total, deterministic):

1. `p = normalizeWorkspacePath(path ?? "")`. If `p === ""` → return `{ path: "", matches: [] }`.
2. `dir = p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : ""`.
3. For each project in `scopedProjects(graph, scope)` (reuses the existing helper), for each
   node, read `node.codeReferences ?? []`:
   - **exact hit** if that array includes `p`.
   - **folder hit** if `dir !== ""` and some entry `startsWith(dir + "/")`.
4. Collect **exact** matches first. **Only if there are zero exact matches** across all scoped
   projects, collect **folder** matches (FR-003 fallback semantics).
5. Emit one `RelatedSpec` per matching node with its `matchKind`.
6. **Order** deterministically: by `matchKind` (`exact` < `folder`), then `projectId`
   (localeCompare), then `specId` (localeCompare). (FR-007 / SC-004.)

**Invariants**
- Never throws (Principle II). A node without `codeReferences` (e.g. `specToCode` off, or no
  code refs) contributes nothing.
- A given `specId` appears at most once (a node is either an exact or a folder match; exact wins
  and the folder pass does not run when any exact exists).
- Byte-identical output for identical `(graph, path, scope)` (SC-004).

## Envelope & formatting

- `toEnvelope("file", specsForFileResult, warnings)` — unchanged, kind-agnostic (FR-015).
- `formatText` gains a `case "file"`:

  ```text
  # specs for src/core/graph/parseFeature.ts (2 exact)
    002-spec-graph-model      [done]   (exact)
    009-folder-name-identity  [planned] (exact)
  ```
  (When the fallback fired, the header reads e.g. `1 folder` and rows are labeled `(folder)`.)

## Platform input (`src/platform/runQuery.ts`)

```ts
export interface RunQueryInput {
  readonly root: string;
  readonly kind: QueryKind;
  readonly specId?: string;
  readonly path?: string;              // ← added (for kind "file")
  readonly rule?: string;
  readonly projectId?: string | null;
  readonly options?: Partial<GraphOptions>;
}
// case "file": toEnvelope("file", specsForFile(graph, input.path ?? "", scope), warnings)
```

## Protocol addition (`src/webview/protocol.ts`) — only for the reveal-focus sync (research R-6)

```ts
export type HostToControls =
  | { readonly type: "state"; /* …unchanged… */ }
  | { readonly type: "selection"; readonly nodeId: string | null; readonly relatedCount: number }
  | { readonly type: "focusMode"; readonly enabled: boolean };   // ← added: keep the sidebar toggle in sync
```

The controls webview reflects `focusMode` on its checkbox; the host tracks a `focusMode`
boolean and emits this echo whenever it changes focus mode (from the toggle **or** from the new
command's "Reveal + focus" action). No change to `HostToPanel`/`ControlsToHost` — the existing
`focusMode`/`setFocusMode` messages carry the actual scoping.

## Entities → spec mapping

| Spec entity | Realized as |
|-------------|-------------|
| **File query** (path + match rule) | `specsForFile(graph, path, scope)` argument + the exact-then-folder algorithm |
| **Related-spec result** (id, project, name, spec.md location, match kind) | `RelatedSpec` (spec.md location derived by the command as `specs/<specId>/spec.md` under `projectId`, mirroring `openSpec`) |
| **Reverse-lookup result set** (ordered + warnings, versioned) | `SpecsForFile` wrapped by `toEnvelope("file", …, warnings)` |

## What is explicitly NOT changed

- The 002 graph model, edges, and heuristics; the 004 existing queries; the 011
  `codeReferences` semantics (consumed read-only, never modified).
- No git / feature-012 code path is touched (data source = 011 only).
- No new runtime dependency; `engines.vscode` stays `^1.101.0`.
