# Contract: Webview Message Protocol

The channel between the extension host and the sandboxed `speckitAtlas.mapView`
webview. The webview **never reads the file system** and **never makes network
requests** (Principles I, VI); it only renders what it is sent and reports user
intent back.

## Host → Webview messages

```ts
type HostToWebview =
  | { type: "render"; model: MapViewModel };   // MapViewModel per core-api.md
```

- **W-1**: On view resolve and on `speckitAtlas.refresh`, the host posts exactly one
  `render` message carrying a fully-populated `MapViewModel`.
- **W-2**: The webview renders `state: "welcome"` as the introductory empty state and
  `state: "empty"` as "no map yet for the detected specs", surfacing any `warnings`.
- **W-3**: The webview treats an unknown `schemaVersion` defensively (shows a generic
  message) rather than throwing.

## Webview → Host messages

```ts
type WebviewToHost =
  | { type: "ready" }        // webview finished loading; host may send render
  | { type: "refresh" };     // user clicked a refresh affordance
```

- **W-4**: The webview posts `ready` once after load; the host MUST NOT assume the
  webview can receive `render` before `ready`.
- **W-5**: A `refresh` message triggers the same path as the `speckitAtlas.refresh`
  command.

## Content-Security-Policy contract

The webview HTML MUST include a `<meta http-equiv="Content-Security-Policy">` with:

- `default-src 'none';`
- `img-src ${webview.cspSource};`
- `style-src ${webview.cspSource} 'nonce-${nonce}';`
- `script-src 'nonce-${nonce}';`
- no `unsafe-inline`, no `unsafe-eval`, no remote origins.

`localResourceRoots` is limited to the extension's `media/` directory. A fresh
`nonce` is generated per load.

- **W-6** (assertable): The served HTML contains a CSP meta tag with `default-src
  'none'` and no `http:`/`https:` origin and no inline `on*=` handler.
- **W-7**: All scripts/styles reference the local `media/` bundle via `cspSource` +
  nonce; there are zero external URLs in the document.
