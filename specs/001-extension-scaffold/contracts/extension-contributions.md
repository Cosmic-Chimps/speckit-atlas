# Contract: Editor Contributions (`package.json`)

What the extension declares to the editor. All ids are namespaced under
`speckitAtlas.*` to guarantee coexistence with speckit-companion (FR-010, Principle
V). **No file associations are contributed.**

## Manifest fields

| Field | Value | Rationale |
|-------|-------|-----------|
| `name` | `speckit-atlas` (working name) | Rename before publish; confirm availability. |
| `engines.vscode` | `^1.90.0` | Explicit, tested floor (research Decision 2). |
| `main` | bundled esbuild output (e.g. `./dist/extension.js`) | Single bundle. |
| `capabilities.untrustedWorkspaces` | `{ "supported": true }` | Read-only + offline ⇒ safe in restricted mode (Principles III, VI). |

## `activationEvents`

```json
[
  "workspaceContains:**/.specify/",
  "workspaceContains:**/specs/*/spec.md",
  "onView:speckitAtlas.mapView"
]
```

- **A-1**: No `*` and no `onStartupFinished` — activation is lazy (Principle IV).
- **A-2**: With none of the globs matching and the view unopened, `activate()` is
  never called (assertable indirectly via SC-001/SC-003).

## `contributes`

```jsonc
{
  "viewsContainers": {
    "activitybar": [
      { "id": "speckitAtlas", "title": "SpecKit Atlas", "icon": "media/atlas-icon.svg" }
    ]
  },
  "views": {
    "speckitAtlas": [
      { "id": "speckitAtlas.mapView", "name": "Map", "type": "webview" }
    ]
  },
  "commands": [
    { "command": "speckitAtlas.openMap", "title": "SpecKit Atlas: Open Map" },
    { "command": "speckitAtlas.refresh", "title": "SpecKit Atlas: Refresh" }
  ]
}
```

## Behavioral contract (assertable in `test/integration`, `@vscode/test-electron`)

- **E-1**: Opening a fixture workspace that contains `.specify/` activates the
  extension and registers `speckitAtlas.mapView`.
- **E-2**: The registered commands `speckitAtlas.openMap` and `speckitAtlas.refresh`
  exist after activation and no others are contributed.
- **E-3**: Opening a fixture workspace with none of the activation signals does not
  activate the extension (no `speckitAtlas.*` command becomes available).
- **E-4**: All contributed ids are unique within the `speckitAtlas.` namespace; none
  collide with a known speckit-companion id.
- **E-5**: `deactivate()` disposes every registered disposable; re-activation in the
  same session re-registers cleanly.
