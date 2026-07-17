# Phase 1 Data Model: Extension Scaffold

The scaffold has almost no persisted data — it is read-only and stateless across
sessions. The "model" here is the small set of in-memory types the pure `core/`
exposes and the envelope it hands to the webview. Everything below is a plain
serializable TypeScript type with **no `vscode` imports** (Principle I).

## Entity: WorkspaceRoot (input to core)

A single opened folder the core is asked to classify. Editor types are adapted into
this plain shape by `extension/` before calling the core.

| Field | Type | Notes |
|-------|------|-------|
| `id` | `string` | Stable identifier for the root (adapter supplies the folder URI string). |
| `name` | `string` | Display name of the root. |
| `entries` | `string[]` | Relative paths the adapter probed (e.g. `.specify/`, `specs/`); the core does not touch the file system itself. |

Validation / rules:

- `entries` MAY be empty or partial; the core MUST NOT assume a complete listing
  (Principle II — resilient to partial input).
- The core performs **no** I/O; all file-system reads happen in `extension/` and are
  passed in. This keeps `core/` pure and testable in plain Node.

## Entity: DetectionResult (core output)

The core's verdict for one workspace root.

| Field | Type | Notes |
|-------|------|-------|
| `rootId` | `string` | Matches `WorkspaceRoot.id`. |
| `name` | `string` | Display name echoed from `WorkspaceRoot.name`; used to populate `MapViewModel.qualifyingRoots`. |
| `qualifies` | `boolean` | Whether this root is treated as a Spec Kit repo. |
| `signals` | `string[]` | Which signals fired (e.g. `"has:.specify"`, `"has:specs/*/spec.md"`). For transparency/debuggability. |
| `warnings` | `Warning[]` | Non-fatal issues (see below); never throws. |

State: `qualifies` is a pure function of `signals`. No transitions — recomputed on
demand from a fresh `WorkspaceRoot`.

## Entity: Warning

A per-item, non-fatal degradation notice (Principle II).

| Field | Type | Notes |
|-------|------|-------|
| `code` | `string` | Stable machine code (e.g. `"empty-workspace"`, `"probe-error"`). |
| `message` | `string` | Human-readable, safe to show in the welcome state. |
| `rootId` | `string \| undefined` | Root the warning pertains to, if any. |

## Entity: MapViewModel (envelope sent to webview)

The single serialized object posted to the webview via `postMessage`. In the
scaffold it carries only the empty/welcome state; later features extend it with the
graph. Designed as a versioned envelope so the webview can evolve safely.

| Field | Type | Notes |
|-------|------|-------|
| `schemaVersion` | `number` | Envelope version; starts at `1`. |
| `state` | `"welcome" \| "empty" \| "ready"` | Scaffold emits `"welcome"` or `"empty"`; `"ready"` reserved for the graph feature. |
| `qualifyingRoots` | `string[]` | Names of roots that qualified (may be empty). |
| `warnings` | `Warning[]` | Surfaced to the user in the welcome panel. |
| `graph` | `null` | Placeholder; the graph model lands in a later feature. |

Validation / rules:

- The envelope MUST always be constructible even when detection produced only
  warnings — the webview must never receive `undefined` or a partial object
  (FR-011).
- `graph` is explicitly `null` in this feature to lock the field name in the contract
  now and avoid a breaking rename later.

## Relationships

```
WorkspaceRoot (n)  --core.detect-->  DetectionResult (n)
DetectionResult (n) --core.buildViewModel--> MapViewModel (1)
MapViewModel --postMessage--> Webview (renders welcome/empty)
```

No entity is persisted to disk. No entity is written back to the workspace
(Principle III).
