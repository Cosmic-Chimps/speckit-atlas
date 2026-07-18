import { test } from "node:test";
import assert from "node:assert/strict";
import { buildWebviewHtml } from "../../src/extension/webviewHtml.js";

const NONCE = "PANELNONCE1234567890abcdEFGH";
const CSP_SOURCE = "vscode-webview://example";

/** The map panel's HTML must be CSP-locked (R-19) — asserted on the built HTML. */
function panelHtml(): string {
  return buildWebviewHtml({
    cspSource: CSP_SOURCE,
    nonce: NONCE,
    scriptUri: "vscode-webview://example/map.js",
    styleUri: "vscode-webview://example/map.css",
    title: "SpecKit Atlas Map",
    body: `<div id="cy"></div><div id="empty"></div><aside id="detail"></aside>`,
  });
}

test("R-19: panel HTML has strict CSP with default-src 'none' and a nonce", () => {
  const html = panelHtml();
  assert.match(html, /http-equiv="Content-Security-Policy"/);
  assert.match(html, /default-src 'none'/);
  assert.match(html, new RegExp(`script-src 'nonce-${NONCE}'`));
});

test("R-19: panel HTML has no remote origin, no unsafe-eval, no inline handlers", () => {
  const html = panelHtml();
  assert.doesNotMatch(html, /unsafe-eval/);
  assert.doesNotMatch(html, /unsafe-inline/);
  assert.doesNotMatch(html, /https?:\/\//); // only local vscode-webview:// URIs
  assert.doesNotMatch(html, /\son[a-z]+=/i); // no inline on*= handlers
});

test("R-19: the map body containers are present and script is nonce'd", () => {
  const html = panelHtml();
  assert.match(html, /id="cy"/);
  assert.match(html, /id="empty"/);
  assert.match(html, new RegExp(`<script nonce="${NONCE}" src="[^"]*map\\.js"`));
});
