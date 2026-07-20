import * as vscode from "vscode";
import * as nodePath from "node:path";
import {
  DEFAULT_GRAPH_OPTIONS,
  buildMapViewModel,
  buildWorkspaceGraph,
  detectRoots,
  specsForFile as querySpecsForFile,
  type GraphOptions,
  type MapViewModel,
  type ProjectSnapshot,
  type SpecsForFile,
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
import { buildServerDefinitions, type McpServerDescriptor } from "./mcpProvider.js";
import {
  openFileDiff as gitOpenFileDiff,
  showChangeset as gitShowChangeset,
} from "./gitChanges.js";
import type { AttributionSetting } from "./attribution.js";
import {
  CLIENTS,
  DEFAULT_SERVER_NAME,
  bundledLaunchSpec,
  composeSetupDocument,
  formatRegistration,
  type ClientId,
} from "./mcpSetup.js";

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
  /** Open a listed source file read-only (feature 011; exposed for tests). */
  openFile(path: string, projectId: string): Promise<void>;
  /** Open one file's before/after diff (feature 012; exposed for tests). */
  openFileDiff(nodeId: string, path: string, projectId: string): Promise<void>;
  /** Open the spec's attributed changeset (feature 012; exposed for tests). */
  showChangeset(nodeId: string, projectId: string): Promise<void>;
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
  /** Feature 010 — the current selection echoed to the sidebar (id + related-spec count). */
  getSelection(): { nodeId: string; relatedCount: number } | null;
  /** Feature 013 — reverse lookup for a workspace file (mirrors the command's core call). */
  specsForFile(path: string, projectId?: string): SpecsForFile;
  /** Feature 013 — reveal + focus a spec on the map (the "Reveal + focus on map" action). */
  revealSpecOnMap(nodeId: string): void;
  /** Feature 013 — whether focus mode is currently on (for assertions). */
  isFocusModeOn(): boolean;
  /** Feature 007 — the MCP server descriptors advertised for the current workspace. */
  getMcpServerDefinitions(): McpServerDescriptor[];
  /** Feature 008 — the setup document the command would produce for a client (deterministic). */
  generateMcpRegistration(client: ClientId, folderPath?: string): string;
}

/**
 * Feature 003: the map renders in a center WebviewPanel; the sidebar hosts controls.
 * The host is the hub — it builds the graph (feature 002), pushes it to the panel, and
 * translates control/panel messages. Read-only and offline.
 */
export function activate(context: vscode.ExtensionContext): AtlasApi {
  let options: GraphOptions = { ...DEFAULT_GRAPH_OPTIONS };
  let activeProjectId: string | null = null;
  // Feature 010 — the single selected spec (source of truth), echoed to the controls sidebar.
  let selectedSpecId: string | null = null;
  // Feature 013 — focus-mode state (source of truth), kept in sync with the sidebar toggle.
  let focusMode = false;
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
    void layoutStore.save(
      msg.projectId,
      msg.positions,
      msg.viewport,
      nodeIdsForBucket(msg.projectId),
    );
  }

  const panel = new MapPanel(context.extensionUri, {
    openSpec: (nodeId, projectId) => void openSpec(nodeId, projectId),
    openFile: (path, projectId) => void openFile(path, projectId),
    openFileDiff: (nodeId, path, projectId) => void openFileDiff(nodeId, path, projectId),
    showChangeset: (nodeId, projectId) => void showChangeset(nodeId, projectId),
    selectNode: (nodeId) => pushSelection(nodeId),
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
    vscode.commands.registerCommand(
      "speckitAtlas.showSpecsForFile",
      (uri?: vscode.Uri) => void showSpecsForFile(uri),
    ),
    createSpecWatcher((changedPath) => void onFileChanged(changedPath)),
  );

  // Feature 007: advertise the bundled MCP query server (dist/mcp.js) to VS Code's MCP
  // registry so in-editor agents discover the atlas_* tools on install — no npm install,
  // no config. One stdio server per workspace folder, scoped with --root; launched via the
  // editor's own Node. Read-only + offline (the server reuses the 004 read-only scan).
  function mcpDescriptors(): McpServerDescriptor[] {
    const folders = (vscode.workspace.workspaceFolders ?? []).map((f) => f.uri.fsPath);
    return buildServerDefinitions({
      folders,
      extensionPath: context.extensionPath,
      nodePath: process.execPath,
      version: (context.extension?.packageJSON as { version?: string })?.version ?? "0.0.0",
    });
  }
  function toStdioDefinition(d: McpServerDescriptor): vscode.McpStdioServerDefinition {
    const def = new vscode.McpStdioServerDefinition(d.label, d.command, d.args, d.env, d.version);
    def.cwd = vscode.Uri.file(d.cwd);
    return def;
  }
  const didChangeMcp = new vscode.EventEmitter<void>();
  context.subscriptions.push(
    didChangeMcp,
    // Re-advertise when the set of workspace folders changes (contract C-8).
    vscode.workspace.onDidChangeWorkspaceFolders(() => didChangeMcp.fire()),
    vscode.lm.registerMcpServerDefinitionProvider("speckitAtlas.mcp", {
      onDidChangeMcpServerDefinitions: didChangeMcp.event,
      provideMcpServerDefinitions: () => mcpDescriptors().map(toStdioDefinition),
    }),
  );

  // Feature 008: generate (never write) an MCP registration for a non-VS-Code client
  // (Claude Code, Cursor, Claude Desktop, generic). Copies the registration + opens an
  // untitled doc with full instructions; touches no files (Read-Only).
  function setupDocFor(client: ClientId, folder: string): string {
    return composeSetupDocument({
      client,
      serverName: DEFAULT_SERVER_NAME,
      projectRoot: folder,
      extensionPath: context.extensionPath,
      nodePath: process.execPath,
    });
  }
  async function setupMcpClient(): Promise<void> {
    const folders = vscode.workspace.workspaceFolders ?? [];
    if (folders.length === 0) {
      void vscode.window.showInformationMessage(
        "SpecKit Atlas: open a Spec Kit workspace first, then run this command to connect your agent.",
      );
      return;
    }
    let folder = folders[0].uri.fsPath;
    if (folders.length > 1) {
      const pick = await vscode.window.showQuickPick(
        folders.map((f) => ({ label: f.name, description: f.uri.fsPath })),
        { title: "SpecKit Atlas: which project?", placeHolder: "Choose a workspace folder" },
      );
      if (!pick) {
        return;
      }
      folder = pick.description;
    }
    const clientPick = await vscode.window.showQuickPick(
      CLIENTS.map((c) => ({ label: c.label, description: c.hint, id: c.id })),
      { title: "SpecKit Atlas: which agent client?", placeHolder: "Choose your MCP client" },
    );
    if (!clientPick) {
      return;
    }
    const primary = formatRegistration({
      client: clientPick.id,
      launch: bundledLaunchSpec(context.extensionPath, process.execPath, folder),
      projectRoot: folder,
      serverName: DEFAULT_SERVER_NAME,
    });
    await vscode.env.clipboard.writeText(primary);
    const doc = await vscode.workspace.openTextDocument({
      content: setupDocFor(clientPick.id, folder),
    });
    await vscode.window.showTextDocument(doc, { preview: true });
    void vscode.window.showInformationMessage(
      `SpecKit Atlas: registration for ${clientPick.label} copied to clipboard — full instructions opened.`,
    );
  }
  context.subscriptions.push(
    vscode.commands.registerCommand("speckitAtlas.setupMcpClient", () => void setupMcpClient()),
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

  /** Feature 010 — how many distinct specs relate to `nodeId` in the current graph. */
  function relatedCountFor(nodeId: string): number {
    const neighbors = new Set<string>();
    for (const p of graph.projects) {
      for (const e of p.edges) {
        if (e.source === nodeId) {
          neighbors.add(e.target);
        } else if (e.target === nodeId) {
          neighbors.add(e.source);
        }
      }
    }
    return neighbors.size;
  }

  function specExists(id: string): boolean {
    return graph.projects.some((p) => p.nodes.some((n) => n.id === id));
  }

  /** Feature 010 — record the selection and echo it (with its related count) to the sidebar. */
  function pushSelection(nodeId: string | null): void {
    selectedSpecId = nodeId;
    controls.setSelection(nodeId, nodeId ? relatedCountFor(nodeId) : 0);
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
    reechoSelection();
    return model;
  }

  function rebuild(): void {
    graph = buildWorkspaceGraph(snapshots, options);
    panel.render(graph, options, activeProjectId);
    controls.setState(controlState());
    reechoSelection();
  }

  /** Feature 010 — after a (re)render, re-send the selection so the freshly-rebuilt SPECS
   * list re-highlights it with an up-to-date related count; drop it if the spec is gone. */
  function reechoSelection(): void {
    if (selectedSpecId && !specExists(selectedSpecId)) {
      selectedSpecId = null;
    }
    pushSelection(selectedSpecId);
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
        pushSelection(msg.nodeId); // echo selection back so the SPECS list highlights it
        break;
      case "setFilter":
        panel.setFilter(msg.filterTier, msg.filterStatus);
        break;
      case "setFocusMode":
        focusMode = msg.enabled; // sidebar-initiated; the checkbox already reflects it
        panel.setFocusMode(msg.enabled);
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

  /**
   * Feature 011 — open a workspace-relative source file read-only. Resolves strictly under the
   * project root (rejects absolute or root-escaping paths); a missing/unsafe path warns and opens
   * nothing (Principles II & III).
   */
  async function openFile(path: string, projectId: string): Promise<void> {
    try {
      const norm = (path ?? "").replace(/\\/g, "/");
      const unsafe =
        !norm || norm.startsWith("/") || /^[a-zA-Z]:/.test(norm) || norm.split("/").includes("..");
      if (unsafe) {
        throw new Error("unsafe path");
      }
      const uri = vscode.Uri.joinPath(vscode.Uri.parse(projectId), norm);
      await vscode.workspace.fs.stat(uri); // throws if missing
      await vscode.window.showTextDocument(uri, { preview: true });
    } catch {
      void vscode.window.showWarningMessage(
        `SpecKit Atlas: could not open "${path}" (file missing or moved).`,
      );
    }
  }

  // ── Feature 013 — Show Specs for File (reverse traceability) ──────────────────

  /** Set focus mode from a programmatic source (the command): panel + echo the sidebar toggle. */
  function setFocusModeState(enabled: boolean): void {
    focusMode = enabled;
    panel.setFocusMode(enabled);
    controls.setFocusMode(enabled);
  }

  /** Reveal + focus a spec on the map (the "Reveal + focus on map" quick-pick action). */
  function revealSpecOnMap(nodeId: string): void {
    panel.reveal();
    panel.focus(nodeId);
    pushSelection(nodeId);
    setFocusModeState(true); // scope the view to the spec + its neighbors (feature 010)
  }

  /**
   * Resolve a file URI to the graph project that owns it + the file's path relative to that
   * project root (the same root `codeReferences` are stored against). Picks the most specific
   * (longest) matching root. Returns null when no project contains the file.
   */
  function resolveFileToProject(
    fileUri: vscode.Uri,
  ): { projectId: string; relPath: string } | null {
    const fp = fileUri.fsPath;
    let best: { projectId: string; relPath: string; rootLen: number } | null = null;
    for (const p of graph.projects) {
      let rootPath: string;
      try {
        rootPath = vscode.Uri.parse(p.projectId).fsPath;
      } catch {
        continue;
      }
      const rel = nodePath.relative(rootPath, fp);
      const inside = rel !== "" && !rel.startsWith("..") && !nodePath.isAbsolute(rel);
      if (inside && (!best || rootPath.length > best.rootLen)) {
        best = {
          projectId: p.projectId,
          relPath: rel.replace(/\\/g, "/"),
          rootLen: rootPath.length,
        };
      }
    }
    return best ? { projectId: best.projectId, relPath: best.relPath } : null;
  }

  /** The core reverse lookup over the in-memory graph (shared by the command and the test API). */
  function specsForFileQuery(path: string, projectId?: string): SpecsForFile {
    return querySpecsForFile(graph, path, { projectId: projectId ?? null });
  }

  async function showSpecsForFile(uri?: vscode.Uri): Promise<void> {
    const target = uri ?? vscode.window.activeTextEditor?.document.uri;
    if (!target || target.scheme !== "file") {
      void vscode.window.showInformationMessage("SpecKit Atlas: open or select a file first.");
      return;
    }
    const resolved = resolveFileToProject(target);
    if (!resolved) {
      void vscode.window.showInformationMessage(
        "SpecKit Atlas: no related specs — this file is outside a Spec Kit project.",
      );
      return;
    }
    const result = specsForFileQuery(resolved.relPath, resolved.projectId);
    if (result.matches.length === 0) {
      void vscode.window.showInformationMessage(
        options.specToCode
          ? `SpecKit Atlas: no specs reference "${resolved.relPath}".`
          : 'SpecKit Atlas: enable the "Spec → code layer" toggle to see which specs reference this file.',
      );
      return;
    }

    // Single-match shortcut (FR-013): skip the spec-selection list.
    let chosen = result.matches[0];
    if (result.matches.length > 1) {
      const pick = await vscode.window.showQuickPick(
        result.matches.map((m) => ({
          label: m.specId,
          description: m.matchKind === "folder" ? `${m.title}  · folder` : m.title,
          detail: m.status ? `status: ${m.status}` : undefined,
          match: m,
        })),
        { title: `Specs for ${result.path}`, placeHolder: "Select a related spec" },
      );
      if (!pick) {
        return;
      }
      chosen = pick.match;
    }

    const action = await vscode.window.showQuickPick(
      [
        { label: "$(go-to-file) Open spec", id: "open" as const },
        { label: "$(target) Reveal + focus on map", id: "reveal" as const },
      ],
      { title: chosen.specId, placeHolder: "What would you like to do?" },
    );
    if (!action) {
      return;
    }
    if (action.id === "open") {
      await openSpec(chosen.specId, chosen.projectId);
    } else {
      revealSpecOnMap(chosen.specId);
    }
  }

  /** Feature 012 — the configured attribution basis (FR-006 toggle). */
  function attributionSetting(): AttributionSetting {
    const v = vscode.workspace
      .getConfiguration("speckitAtlas")
      .get<string>("diff.attribution", "auto");
    return v === "branch" || v === "range" || v === "off" ? v : "auto";
  }

  /** Feature 012 — open one listed file's before/after diff (read-only; degrades to a message). */
  async function openFileDiff(nodeId: string, path: string, projectId: string): Promise<void> {
    await gitOpenFileDiff(nodeId, path, projectId, attributionSetting());
  }

  /** Feature 012 — open the spec's full attributed changeset (read-only; degrades to a message). */
  async function showChangeset(nodeId: string, projectId: string): Promise<void> {
    await gitShowChangeset(nodeId, projectId, attributionSetting());
  }

  return {
    refresh,
    getLastModel: () => lastModel,
    openMap: () => panel.reveal(),
    isPanelOpen: () => panel.isOpen,
    getPanelDiagnostics: () => panel.getDiagnostics(),
    getGraph: () => graph,
    openSpec: (nodeId, projectId) => openSpec(nodeId, projectId),
    openFile: (path, projectId) => openFile(path, projectId),
    openFileDiff: (nodeId, path, projectId) => openFileDiff(nodeId, path, projectId),
    showChangeset: (nodeId, projectId) => showChangeset(nodeId, projectId),
    applyControlMessage: (msg) => onControlMessage(msg),
    notifyFileChanged: (changedPath) => onFileChanged(changedPath),
    getSavedLayout: () => layoutStore.load(),
    simulatePersistLayout: (msg) => persistLayout(msg),
    resetLayout: () => onControlMessage({ type: "resetLayout" }),
    getSelection: () =>
      selectedSpecId
        ? { nodeId: selectedSpecId, relatedCount: relatedCountFor(selectedSpecId) }
        : null,
    specsForFile: (path, projectId) => specsForFileQuery(path, projectId),
    revealSpecOnMap: (nodeId) => revealSpecOnMap(nodeId),
    isFocusModeOn: () => focusMode,
    getMcpServerDefinitions: () => mcpDescriptors(),
    generateMcpRegistration: (client, folderPath) =>
      setupDocFor(client, folderPath ?? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? ""),
  };
}

export function deactivate(): void {
  // All disposables are registered on context.subscriptions and disposed by the host.
}
