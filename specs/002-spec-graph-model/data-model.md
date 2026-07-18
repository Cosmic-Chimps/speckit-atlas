# Phase 1 Data Model: Spec-Relationship Graph Model

All types are plain, JSON-serializable TypeScript with **no `vscode`/DOM/Node imports**
(Principle I). The core consumes adapter-provided plain data and returns these shapes.
Nothing is persisted (Principle III).

## Input types (adapter → core)

### FeatureInput

One feature folder, as gathered by the adapter's two-layer scan.

| Field | Type | Notes |
|-------|------|-------|
| `id` | `string` | Feature slug (folder name), e.g. `001-fleet-security-analytics`. Unique **within a project**. |
| `number` | `string \| null` | Leading `NNN` if the folder is numbered, else null. |
| `artifacts` | `string[]` | Which standard artifacts exist — from the **tree only**, no contents (spec, plan, tasks, research, data-model, quickstart, contracts, checklists). |
| `files` | `Record<string, string>` | Contents of the files the adapter chose to read (e.g. `spec.md`, `tasks.md`, `data-model.md`). May be partial/empty. |

### ProjectSnapshot

| Field | Type | Notes |
|-------|------|-------|
| `projectId` | `string` | Stable id of the `.specify` root (adapter supplies, e.g. root URI). |
| `name` | `string` | Display name of the project. |
| `features` | `FeatureInput[]` | The project's features. |

## Intermediate type (per-feature parse result)

### FeatureFacts

Pure output of `parseFeature`; cached by the adapter for incremental rebuilds.

| Field | Type | Notes |
|-------|------|-------|
| `id` | `string` | Echoes `FeatureInput.id`. |
| `number` | `string \| null` | Echoes input. |
| `title` | `string` | H1 title, else the slug. |
| `status` | `string \| null` | Raw `**Status**:` value, trimmed; null if absent. |
| `taskCompletion` | `{ done: number; total: number } \| null` | null = no task list ("no tasks"). |
| `completeness` | `ArtifactPresence` | Which standard artifacts exist (from `artifacts`). |
| `references` | `Reference[]` | Extracted outbound reference candidates (see below). |
| `warnings` | `Warning[]` | Per-item degradations from parsing this feature. |

### ArtifactPresence

Booleans for `spec`, `plan`, `tasks`, `research`, `dataModel`, `quickstart`,
`contracts`, `checklists`.

### Reference

A raw, unresolved outbound signal extracted from one feature's content.

| Field | Type | Notes |
|-------|------|-------|
| `kind` | `"link" \| "slug" \| "entity" \| "number" \| "code"` | Which heuristic family produced it. |
| `targetHint` | `string` | Slug / feature-number / entity-key / code path as found. |
| `evidence` | `string` | Short snippet/location supporting it. |
| `count` | `number` | Occurrences (drives strong-edge weight). |

## Output types (core → consumer)

### SpecNode

| Field | Type | Notes |
|-------|------|-------|
| `id` | `string` | Project-qualified node id. |
| `projectId` | `string` | Owning project. |
| `title` | `string` | |
| `status` | `string \| null` | Raw status. |
| `taskCompletion` | `{ done; total } \| null` | |
| `completeness` | `ArtifactPresence` | |
| `codeReferences` | `string[]` (optional) | Source files/code types the spec points to. The spec→code layer is a **node attribute**, not a separate entity or spec↔code edge; present only when `specToCode` is enabled. |
| `warnings` | `Warning[]` | |

### RelationEdge

Directed, within one project.

| Field | Type | Notes |
|-------|------|-------|
| `source` | `string` | SpecNode id (referrer). |
| `target` | `string` | SpecNode id (referenced). |
| `heuristic` | `string` | e.g. `link`, `slug-mention`, `shared-entity`, `bare-number`, `spec-code`. |
| `tier` | `"definitive" \| "strong" \| "medium" \| "risky"` | Confidence tier. |
| `weight` | `number` | Strength (e.g. slug mention count); ≥1. |
| `evidence` | `string[]` | One or more supporting snippets (merged when signals collapse). |

### ProjectGraph

| Field | Type | Notes |
|-------|------|-------|
| `projectId` | `string` | |
| `name` | `string` | |
| `nodes` | `SpecNode[]` | |
| `edges` | `RelationEdge[]` | Never cross `projectId`. |
| `warnings` | `Warning[]` | Project-level + aggregated node warnings. |

### WorkspaceGraph (envelope payload)

| Field | Type | Notes |
|-------|------|-------|
| `projects` | `ProjectGraph[]` | One independent sub-graph per project. |

`MapViewModel.graph` changes from `null` to `WorkspaceGraph`. The renderer is untouched
in this feature (feature 003 consumes it).

### GraphOptions (heuristic toggles + weights)

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `links` | `true` (locked) | on | Definitive; cannot be disabled. |
| `slugMentions` | `boolean` | `true` | Strong. |
| `sharedEntities` | `boolean` | `true` | Medium; code-pinned only. |
| `bareNumbers` | `boolean` | `false` | Risky; opt-in. |
| `specToCode` | `boolean` | `false` | Optional spec→code layer. |

### Warning

`{ code: string; message: string; featureId?: string }` — non-fatal (Principle II).

## Relationships & rules

```
ProjectSnapshot.features ─parseFeature→ FeatureFacts (1:1)
FeatureFacts[] ─buildProjectGraph(options)→ ProjectGraph
   • SpecNode per FeatureFacts
   • RelationEdge per resolved Reference that (a) resolves to a DIFFERENT feature
     IN THE SAME PROJECT, and (b) whose heuristic is enabled
   • self-references dropped; duplicate (source,target) collapsed to one edge
     (strongest tier, merged evidence, summed/weighted count)
   • unresolved/ambiguous Reference → Warning, not an edge
ProjectGraph[] → WorkspaceGraph → MapViewModel.graph
```

- **Invariant**: no `RelationEdge` connects nodes with different `projectId` (FR-001).
- **Invariant**: `parseFeature` and `buildProjectGraph` never throw; bad input →
  `warnings` (FR-018).
- **Purity**: `completeness` derives from `artifacts` (tree) only; `status`/`title`/
  `taskCompletion`/`references` from `files` (content) — enabling tree-only node
  construction upstream (SC-005).
