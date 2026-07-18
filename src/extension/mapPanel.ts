import * as vscode from "vscode";
import type { EdgeTier, GraphOptions, WorkspaceGraph } from "../core/index.js";
import type { HostToPanel, NodePosition, PanelToHost, Viewport } from "../webview/protocol.js";
import { buildWebviewHtml } from "./webviewHtml.js";

export const MAP_PANEL_TYPE = "speckitAtlas.map";

/** Diagnostics the webview reports back after rendering (used by integration tests). */
export interface PanelDiagnostics {
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly ok: boolean;
}

/** A saved arrangement for one view, resolved fresh from the layout store at post time. */
export interface SavedLayout {
  readonly positions: Record<string, NodePosition>;
  readonly viewport: Viewport | null;
}

/**
 * Owns the center-editor map `WebviewPanel`. Renders whatever WorkspaceGraph it is given
 * (Cytoscape lives in the webview); relays user intent (openSpec/selectNode) to the host.
 * Reads no files and makes no network calls (Principles I & VI).
 */
export class MapPanel {
  private panel: vscode.WebviewPanel | undefined;
  private lastRender:
    { graph: WorkspaceGraph; options: GraphOptions; activeProjectId: string | null } | undefined;
  private diagnostics: PanelDiagnostics | undefined;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly handlers: {
      openSpec(nodeId: string, projectId: string): void;
      selectNode(nodeId: string | null): void;
      /** Resolve the saved arrangement for the given view (feature 006). */
      loadSaved?(activeProjectId: string | null): SavedLayout | null;
      /** Persist a reported arrangement (feature 006). */
      persistLayout?(message: Extract<PanelToHost, { type: "persistLayout" }>): void;
    },
  ) {}

  /** Create the panel if needed and reveal it; (re)send the last render with a fresh layout. */
  reveal(): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Active);
    } else {
      this.panel = this.create();
    }
    this.postRender();
  }

  /** Update the model to show; reveals nothing, but pushes to a live panel. */
  render(graph: WorkspaceGraph, options: GraphOptions, activeProjectId: string | null): void {
    this.lastRender = { graph, options, activeProjectId };
    this.postRender();
  }

  /** Discard seeded positions and re-run the automatic layout (Reset layout, feature 006). */
  relayout(): void {
    this.post({ type: "relayout" });
  }

  /** Re-send the last model, resolving the saved layout fresh so late reports are included. */
  private postRender(): void {
    if (!this.lastRender) {
      return;
    }
    const saved = this.handlers.loadSaved?.(this.lastRender.activeProjectId) ?? null;
    this.post({
      type: "render",
      ...this.lastRender,
      savedPositions: saved?.positions ?? null,
      savedViewport: saved?.viewport ?? null,
    });
  }

  focus(nodeId: string): void {
    this.post({ type: "focus", nodeId });
  }

  setFilter(filterTier: readonly EdgeTier[] | null, filterStatus: readonly string[] | null): void {
    this.post({ type: "filter", filterTier, filterStatus });
  }

  get isOpen(): boolean {
    return this.panel !== undefined;
  }

  getDiagnostics(): PanelDiagnostics | undefined {
    return this.diagnostics;
  }

  private create(): vscode.WebviewPanel {
    const panel = vscode.window.createWebviewPanel(
      MAP_PANEL_TYPE,
      "SpecKit Atlas Map",
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, "media")],
      },
    );
    panel.webview.html = this.buildHtml(panel.webview);
    panel.onDidDispose(() => {
      if (this.panel === panel) {
        this.panel = undefined;
        this.diagnostics = undefined;
      }
    });
    panel.webview.onDidReceiveMessage((msg: PanelToHost) => this.onMessage(msg));
    return panel;
  }

  private onMessage(msg: PanelToHost): void {
    switch (msg?.type) {
      case "ready":
        this.postRender();
        break;
      case "rendered":
        this.diagnostics = { nodeCount: msg.nodeCount, edgeCount: msg.edgeCount, ok: msg.ok };
        break;
      case "openSpec":
        this.handlers.openSpec(msg.nodeId, msg.projectId);
        break;
      case "selectNode":
        this.handlers.selectNode(msg.nodeId);
        break;
      case "persistLayout":
        this.handlers.persistLayout?.(msg);
        break;
      default:
        break;
    }
  }

  private post(message: HostToPanel): void {
    void this.panel?.webview.postMessage(message);
  }

  private buildHtml(webview: vscode.Webview): string {
    const nonce = makeNonce();
    const uri = (file: string): string =>
      webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "media", file)).toString();
    return buildWebviewHtml({
      cspSource: webview.cspSource,
      nonce,
      scriptUri: uri("map.js"),
      styleUri: uri("map.css"),
      title: "SpecKit Atlas Map",
      body: `<div id="cy"></div>
    <div id="empty">No Spec Kit specifications to map yet.</div>
    <aside id="detail" aria-live="polite"></aside>`,
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
