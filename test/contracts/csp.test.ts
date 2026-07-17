import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCspContent, buildWebviewHtml } from "../../src/extension/webviewHtml.js";

const CSP_SOURCE = "vscode-webview://example";
const NONCE = "TESTNONCE1234567890abcdEFGH";

test("W-6: CSP locks down default-src and forbids remote/inline sources", () => {
  const csp = buildCspContent(CSP_SOURCE, NONCE);
  assert.match(csp, /default-src 'none'/);
  assert.match(csp, new RegExp(`script-src 'nonce-${NONCE}'`));
  assert.doesNotMatch(csp, /unsafe-inline/);
  assert.doesNotMatch(csp, /unsafe-eval/);
  assert.doesNotMatch(csp, /https?:/);
});

test("W-6/W-7: HTML has the CSP meta, a nonce, no remote origins, no inline handlers", () => {
  const html = buildWebviewHtml({
    cspSource: CSP_SOURCE,
    nonce: NONCE,
    scriptUri: "vscode-webview://example/webview.js",
    styleUri: "vscode-webview://example/webview.css",
  });
  assert.match(html, /http-equiv="Content-Security-Policy"/);
  assert.match(html, new RegExp(`nonce="${NONCE}"`));
  // No external http(s) origins anywhere in the document.
  assert.doesNotMatch(html, /https?:\/\//);
  // No inline event handlers (on*="…").
  assert.doesNotMatch(html, /\son[a-z]+=/i);
});
