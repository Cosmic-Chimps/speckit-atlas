import * as vscode from "vscode";
import { buildMapViewModel, detectRoots } from "../core/index.js";
import { MAP_VIEW_ID, MapViewProvider } from "./mapViewProvider.js";
import { probeWorkspaceRoots } from "./workspaceProbe.js";

/**
 * Activation is lazy: the manifest's `workspaceContains` events (plus the implicit
 * `onView` for the contributed view) mean this runs only in a Spec Kit workspace
 * (Principle IV). Everything here is read-only and offline.
 */
export function activate(context: vscode.ExtensionContext): void {
  const provider = new MapViewProvider(context.extensionUri, () => void refresh(provider));

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(MAP_VIEW_ID, provider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
    vscode.commands.registerCommand("speckitAtlas.openMap", () => {
      void vscode.commands.executeCommand(`${MAP_VIEW_ID}.focus`);
    }),
    vscode.commands.registerCommand("speckitAtlas.refresh", () => void refresh(provider)),
  );

  // Initial scan; failures degrade to a welcome state rather than throwing (FR-011).
  void refresh(provider);
}

export function deactivate(): void {
  // All disposables are registered on context.subscriptions and disposed by the host.
}

async function refresh(provider: MapViewProvider): Promise<void> {
  try {
    const roots = await probeWorkspaceRoots();
    const results = detectRoots(roots);
    provider.update(buildMapViewModel(results));
  } catch {
    // Never let a probe failure crash the host; show the welcome state.
    provider.update(buildMapViewModel([]));
  }
}
