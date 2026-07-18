import * as vscode from "vscode";
import {
  DEFAULT_GRAPH_OPTIONS,
  buildMapViewModel,
  buildWorkspaceGraph,
  detectRoots,
  type GraphOptions,
  type MapViewModel,
  type ProjectSnapshot,
  type WorkspaceGraph,
} from "../core/index.js";
import type { ControlsToHost, HostToControls, PanelToHost, SpecRef } from "../webview/protocol.js";
import { CONTROLS_VIEW_ID, ControlsViewProvider } from "./controlsView.js";
import { MapPanel, type PanelDiagnostics } from "./mapPanel.js";
import { probeWorkspaceRoots } from "./workspaceProbe.js";
import { rescanForChange, scanWorkspaceProjects } from "./projectScan.js";
import { createSpecWatcher } from "./specWatcher.js";
import { LayoutStore } from "./layoutStore.js";
import { ALL_PROJECTS_BUCKET, type SavedMapLayout } from "./layoutModel.js";

/** API returned from activate() for integration tests. */
export interface AtlasApi {
  refresh(): Promise<MapViewModel>;
  getLastModel(): MapViewModel | undefined;
  openMap(): void;
  isPanelOpen(): boolean;
  getPanelDiagnostics(): PanelDiagnostics | undefined;
  /** Current built workspace graph (for assertions). */
  getGraph(): WorkspaceGraph;
  /** Open a node's spec (the panel's click handler; exposed for tests). */
  openSpec(nodeId: string, projectId: string): Promise<void>;
  /** Drive a controls message from tests without the controls webview. */
  applyControlMessage(msg: ControlsToHost): void;
  /** Simulate a debounced file change (deterministic incremental test hook). */
  notifyFileChanged(changedPath: string): Promise<void>;
  /** Feature 006 — the persisted map layout (for assertions). */
  getSavedLayout(): SavedMapLayout;
  /** Feature 006 — drive a webview layout report without a real drag. */
  simulatePersistLayout(msg: Extract<PanelToHost, { type: "persistLayout" }>): void;
  /** Feature 006 — apply the "Reset layout" control action. */
  resetLayout(): void;
}

/**
 * Feature 003: the map renders in a center WebviewPanel; the sidebar hosts controls.
 * The host is the hub — it builds the graph (feature 002), pushes it to the panel, and
 * translates control/panel messages. Read-only and offline.
 */
export function activate(context: vscode.ExtensionContext): AtlasApi {
  let options: GraphOptions = { ...DEFAULT_GRAPH_OPTIONS };
  let activeProjectId: string | null = null;
  let snapshots: ProjectSnapshot[] = [];
  let graph: WorkspaceGraph = { projects: [] };
  let lastModel: MapViewModel | undefined;

  const layoutStore = new LayoutStore(context.workspaceState);

  /** Node ids currently rendered for a bucket — used to prune stale saved positions. */
  function nodeIdsForBucket(bucket: string): string[] {
    const projects =
      bucket === ALL_PROJECTS_BUCKET
        ? graph.projects
        : graph.projects.filter((p) => p.projectId === bucket);
    return projects.flatMap((p) => p.nodes.map((n) => n.id));
  }

  function persistLayout(msg: Extract<PanelToHost, { type: "persistLayout" }>): void {
    void layoutStore.save(msg.projectId, msg.positions, msg.viewport, nodeIdsForBucket(msg.projectId));
  }

  const panel = new MapPanel(context.extensionUri, {
    openSpec: (nodeId, projectId) => void openSpec(nodeId, projectId),
    selectNode: () => {
      /* selection is reflected in the panel's own detail pane */
    },
    loadSaved: (pid) => {
      const bucket = pid ?? ALL_PROJECTS_BUCKET;
      const positions = layoutStore.positions(bucket) ?? {};
      const viewport = layoutStore.viewport(bucket);
      if (Object.keys(positions).length === 0 && !viewport) {
        return null;
      }
      return { positions, viewport };
    },
    persistLayout,
  });

  const controls = new ControlsViewProvider(context.extensionUri, {
    onMessage: (msg) => onControlMessage(msg),
  });

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(CONTROLS_VIEW_ID, controls, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
    vscode.commands.registerCommand("speckitAtlas.openMap", () => {
      panel.reveal();
    }),
    vscode.commands.registerCommand("speckitAtlas.refresh", () => void refresh()),
    createSpecWatcher((changedPath) => void onFileChanged(changedPath)),
  );

  void refresh();

  async function onFileChanged(changedPath: string): Promise<void> {
    // Incremental (SC-003): re-scan only the changed feature; fall back to a full scan
    // for structural changes (feature added/removed, or a non-feature path).
    const incremental = await rescanForChange(changedPath, snapshots);
    if (incremental) {
      snapshots = incremental;
      rebuild();
    } else {
      await refresh();
    }
  }

  function controlState(): Extract<HostToControls, { type: "state" }> {
    const specs: SpecRef[] = graph.projects.flatMap((p) =>
      p.nodes.map((n) => ({ id: n.id, projectId: n.projectId, title: n.title, status: n.status })),
    );
    return {
      type: "state",
      options,
      projects: graph.projects.map((p) => ({ id: p.projectId, name: p.name })),
      specs,
      activeProjectId,
      resetEnabled: layoutStore.enabled(activeProjectId ?? ALL_PROJECTS_BUCKET),
    };
  }

  async function refresh(): Promise<MapViewModel> {
    let model: MapViewModel;
    try {
      const roots = await probeWorkspaceRoots();
      const results = detectRoots(roots);
      snapshots = await scanWorkspaceProjects();
      graph = buildWorkspaceGraph(snapshots, options);
      model = buildMapViewModel(results, graph);
    } catch {
      snapshots = [];
      graph = { projects: [] };
      model = buildMapViewModel([]);
    }
    lastModel = model;
    panel.render(graph, options, activeProjectId);
    controls.setState(controlState());
    return model;
  }

  function rebuild(): void {
    graph = buildWorkspaceGraph(snapshots, options);
    panel.render(graph, options, activeProjectId);
    controls.setState(controlState());
  }

  function onControlMessage(msg: ControlsToHost): void {
    switch (msg?.type) {
      case "setOption":
        if (msg.key === "links") {
          return; // links is locked on
        }
        options = { ...options, [msg.key]: msg.value };
        rebuild();
        break;
      case "selectProject":
        activeProjectId = msg.projectId;
        panel.render(graph, options, activeProjectId);
        break;
      case "focusSpec":
        panel.reveal();
        panel.focus(msg.nodeId);
        break;
      case "setFilter":
        panel.setFilter(msg.filterTier, msg.filterStatus);
        break;
      case "resetLayout": {
        const bucket = activeProjectId ?? ALL_PROJECTS_BUCKET;
        void layoutStore.clear(bucket).then(() => controls.setState(controlState()));
        panel.relayout();
        break;
      }
      case "ready":
        controls.setState(controlState());
        break;
      default:
        break;
    }
  }

  async function openSpec(nodeId: string, projectId: string): Promise<void> {
    try {
      const root = vscode.Uri.parse(projectId);
      const uri = vscode.Uri.joinPath(root, "specs", nodeId, "spec.md");
      await vscode.workspace.fs.stat(uri); // throws if missing
      await vscode.window.showTextDocument(uri, { preview: true });
    } catch {
      void vscode.window.showWarningMessage(
        `SpecKit Atlas: could not open the spec for "${nodeId}" (file missing or moved).`,
      );
    }
  }

  return {
    refresh,
    getLastModel: () => lastModel,
    openMap: () => panel.reveal(),
    isPanelOpen: () => panel.isOpen,
    getPanelDiagnostics: () => panel.getDiagnostics(),
    getGraph: () => graph,
    openSpec: (nodeId, projectId) => openSpec(nodeId, projectId),
    applyControlMessage: (msg) => onControlMessage(msg),
    notifyFileChanged: (changedPath) => onFileChanged(changedPath),
    getSavedLayout: () => layoutStore.load(),
    simulatePersistLayout: (msg) => persistLayout(msg),
    resetLayout: () => onControlMessage({ type: "resetLayout" }),
  };
}

export function deactivate(): void {
  // All disposables are registered on context.subscriptions and disposed by the host.
}
