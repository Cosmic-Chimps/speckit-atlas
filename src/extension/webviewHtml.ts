/**
 * Pure builder for the Map webview's HTML shell. No vscode/DOM imports, so the
 * strict-CSP contract (contracts/webview-protocol.md W-6/W-7) can be asserted in
 * plain Node. The caller supplies already-resolved local URIs, the webview's
 * `cspSource`, and a per-load nonce.
 */
export interface WebviewHtmlInputs {
  readonly cspSource: string;
  readonly nonce: string;
  readonly scriptUri: string;
  readonly styleUri: string;
  /** Body markup (static, no inline handlers). Defaults to the welcome/app container. */
  readonly body?: string;
  /** Document title. */
  readonly title?: string;
}

/** The Content-Security-Policy string. `default-src 'none'` + nonce; no remote origins. */
export function buildCspContent(cspSource: string, nonce: string): string {
  return [
    `default-src 'none'`,
    `img-src ${cspSource}`,
    `style-src ${cspSource} 'nonce-${nonce}'`,
    `script-src 'nonce-${nonce}'`,
  ].join("; ");
}

export function buildWebviewHtml(inputs: WebviewHtmlInputs): string {
  const csp = buildCspContent(inputs.cspSource, inputs.nonce);
  const body = inputs.body ?? `<main id="app" aria-live="polite"></main>`;
  const title = inputs.title ?? "SpecKit Atlas";
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="${csp}" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link href="${inputs.styleUri}" rel="stylesheet" nonce="${inputs.nonce}" />
    <title>${title}</title>
  </head>
  <body>
    ${body}
    <script nonce="${inputs.nonce}" src="${inputs.scriptUri}"></script>
  </body>
</html>`;
}
