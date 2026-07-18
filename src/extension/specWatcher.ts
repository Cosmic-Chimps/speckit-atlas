import * as vscode from "vscode";

/**
 * Debounced file-system watcher over Spec Kit artifacts. On a change it calls
 * `onChange(changedPath)` once per debounce window with the most recent path (Principle
 * IV — debounced fs events, incremental updates). Read-only: it only observes.
 */
export function createSpecWatcher(
  onChange: (changedPath: string) => void,
  debounceMs = 150,
): vscode.Disposable {
  const watcher = vscode.workspace.createFileSystemWatcher("**/{specs/**/*.md,.specify/**}");
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: string | undefined;

  const schedule = (uri: vscode.Uri): void => {
    pending = uri.fsPath;
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      const path = pending;
      timer = undefined;
      pending = undefined;
      if (path) {
        onChange(path);
      }
    }, debounceMs);
  };

  const subs = [
    watcher,
    watcher.onDidChange(schedule),
    watcher.onDidCreate(schedule),
    watcher.onDidDelete(schedule),
  ];

  return {
    dispose(): void {
      if (timer) {
        clearTimeout(timer);
      }
      for (const s of subs) {
        s.dispose();
      }
    },
  };
}
