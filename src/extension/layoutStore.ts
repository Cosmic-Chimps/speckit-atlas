import type * as vscode from "vscode";
import type { NodePosition, Viewport } from "../webview/protocol.js";
import {
  MAP_LAYOUT_KEY,
  clearProject,
  emptyLayout,
  mergeReport,
  parseStored,
  positionsForProject,
  resetEnabled,
  viewportForProject,
  type SavedMapLayout,
} from "./layoutModel.js";

/**
 * Thin wrapper persisting the map layout in `context.workspaceState` (a Memento) —
 * editor storage, **not** a workspace file, so Principle III (Read-Only) holds. All
 * validation/merge/prune logic lives in the pure `layoutModel`; this class only does
 * the Memento get/update. Feature 006.
 */
export class LayoutStore {
  constructor(private readonly memento: vscode.Memento) {}

  load(): SavedMapLayout {
    return parseStored(this.memento.get(MAP_LAYOUT_KEY));
  }

  positions(projectId: string): Record<string, NodePosition> | null {
    return positionsForProject(this.load(), projectId);
  }

  viewport(projectId: string): Viewport | null {
    return viewportForProject(this.load(), projectId);
  }

  enabled(projectId: string): boolean {
    return resetEnabled(this.load(), projectId);
  }

  /** Merge a reported arrangement, pruning stale ids against `currentNodeIds`. */
  async save(
    projectId: string,
    positions: Record<string, NodePosition>,
    viewport: Viewport | null,
    currentNodeIds: Iterable<string>,
  ): Promise<void> {
    const next = mergeReport(this.load(), projectId, positions, viewport, currentNodeIds);
    await this.memento.update(MAP_LAYOUT_KEY, next);
  }

  /** Drop one project bucket (Reset layout). */
  async clear(projectId: string): Promise<void> {
    const next = clearProject(this.load(), projectId);
    await this.memento.update(MAP_LAYOUT_KEY, next);
  }

  /** Replace the whole document (used only by tests). */
  async replaceAll(next: SavedMapLayout | undefined): Promise<void> {
    await this.memento.update(MAP_LAYOUT_KEY, next ?? emptyLayout());
  }
}
