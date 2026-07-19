import * as vscode from "vscode";
import type { HostToControls, ControlsToHost } from "../webview/protocol.js";
import { buildWebviewHtml } from "./webviewHtml.js";

// NOTE: the view id stays `speckitAtlas.mapView` for backward compatibility with the
// feature-001 manifest contribution; it now hosts the CONTROLS (the map moved to a
// center panel in feature 003). The id/name mismatch is intentional (renaming the id
// would be a breaking contribution change).
export const CONTROLS_VIEW_ID = "speckitAtlas.mapView";

/** Sidebar controls: legend, per-heuristic toggles, filters, spec search, project selector. */
export class ControlsViewProvider implements vscode.WebviewViewProvider {
  private view: vscode.WebviewView | undefined;
  private lastState: Extract<HostToControls, { type: "state" }> | undefined;
  private lastSelection: Extract<HostToControls, { type: "selection" }> | undefined;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly handlers: {
      onMessage(message: ControlsToHost): void;
    },
  ) {}

  /** Push the current control state to the sidebar (if live). */
  setState(state: Extract<HostToControls, { type: "state" }>): void {
    this.lastState = state;
    void this.view?.webview.postMessage(state);
  }

  /** Feature 010 — echo the current selection (id + related-spec count) to the sidebar. */
  setSelection(nodeId: string | null, relatedCount: number): void {
    const msg = { type: "selection" as const, nodeId, relatedCount };
    this.lastSelection = msg;
    void this.view?.webview.postMessage(msg);
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    const webview = webviewView.webview;
    webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, "media")],
    };
    webview.html = this.buildHtml(webview);
    webviewView.onDidDispose(() => {
      if (this.view === webviewView) {
        this.view = undefined;
      }
    });
    webview.onDidReceiveMessage((msg: ControlsToHost) => {
      if (msg?.type === "ready") {
        if (this.lastState) {
          void this.view?.webview.postMessage(this.lastState);
        }
        if (this.lastSelection) {
          void this.view?.webview.postMessage(this.lastSelection);
        }
      }
      this.handlers.onMessage(msg);
    });
  }

  private buildHtml(webview: vscode.Webview): string {
    const nonce = makeNonce();
    const uri = (file: string): string =>
      webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "media", file)).toString();
    return buildWebviewHtml({
      cspSource: webview.cspSource,
      nonce,
      scriptUri: uri("controls.js"),
      styleUri: uri("controls.css"),
      title: "SpecKit Atlas Controls",
      body: `<main id="app" aria-live="polite"></main>`,
    });
  }
}

function makeNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let text = "";
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}
