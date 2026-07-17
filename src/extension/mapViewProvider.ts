import * as vscode from "vscode";
import type { MapViewModel } from "../core/index.js";
import type { HostToWebview, WebviewToHost } from "../webview/protocol.js";
import { buildWebviewHtml } from "./webviewHtml.js";

export const MAP_VIEW_ID = "speckitAtlas.mapView";

/**
 * Hosts the sandboxed Map webview. It renders whatever MapViewModel it is given and
 * relays user intent (`ready`, `refresh`) back to the extension. It reads no files
 * and makes no network calls; the webview loads only local assets under `media/`
 * behind a strict CSP with a per-load nonce (Principles I & VI).
 */
export class MapViewProvider implements vscode.WebviewViewProvider {
  private view: vscode.WebviewView | undefined;
  private model: MapViewModel | undefined;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly onRefreshRequested: () => void,
  ) {}

  /** Update the model and, if the view is live, push it to the webview. */
  update(model: MapViewModel): void {
    this.model = model;
    this.post({ type: "render", model });
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

    webview.onDidReceiveMessage((message: WebviewToHost) => {
      switch (message?.type) {
        case "ready":
          // The webview is loaded and can now receive a render (W-4).
          if (this.model) {
            this.post({ type: "render", model: this.model });
          }
          break;
        case "refresh":
          this.onRefreshRequested();
          break;
        default:
          // Unknown messages are ignored, never fatal.
          break;
      }
    });
  }

  private post(message: HostToWebview): void {
    void this.view?.webview.postMessage(message);
  }

  private buildHtml(webview: vscode.Webview): string {
    const nonce = makeNonce();
    return buildWebviewHtml({
      cspSource: webview.cspSource,
      nonce,
      scriptUri: webview
        .asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "media", "webview.js"))
        .toString(),
      styleUri: webview
        .asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "media", "webview.css"))
        .toString(),
    });
  }
}

/** Cryptographically-simple nonce; no external randomness source needed. */
function makeNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let text = "";
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}
