import type { WorkspaceGraph } from "../../src/core/index.js";
import type { PanelToHost } from "../../src/webview/protocol.js";
import type { SavedMapLayout } from "../../src/extension/layoutModel.js";

/** The subset of AtlasApi the feature-006 integration suites exercise. */
export interface LayoutApiLike {
  refresh(): Promise<unknown>;
  openMap(): void;
  isPanelOpen(): boolean;
  getPanelDiagnostics(): { nodeCount: number; edgeCount: number; ok: boolean } | undefined;
  getGraph(): WorkspaceGraph;
  notifyFileChanged(changedPath: string): Promise<void>;
  getSavedLayout(): SavedMapLayout;
  simulatePersistLayout(msg: Extract<PanelToHost, { type: "persistLayout" }>): void;
  resetLayout(): void;
}
