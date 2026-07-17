import type { MapViewModel } from "../core/index.js";
import type { HostToWebview, WebviewToHost } from "./protocol.js";

/** Minimal typing for the host bridge injected by VS Code into the webview. */
interface VsCodeApi {
  postMessage(message: WebviewToHost): void;
}
declare function acquireVsCodeApi(): VsCodeApi;

const vscode = acquireVsCodeApi();

function post(message: WebviewToHost): void {
  vscode.postMessage(message);
}

function render(model: MapViewModel): void {
  const app = document.getElementById("app");
  if (!app) {
    return;
  }
  app.replaceChildren();

  // Defensive against an unexpected envelope version (W-3).
  if (!model || model.schemaVersion !== 1) {
    app.append(el("p", "SpecKit Atlas could not display this view."));
    return;
  }

  const heading = el("h1", "SpecKit Atlas");
  app.append(heading);

  if (model.state === "empty") {
    app.append(
      el(
        "p",
        `Detected ${model.qualifyingRoots.length} Spec Kit workspace root(s). ` +
          `The specification map will appear here.`,
      ),
    );
  } else {
    app.append(
      el(
        "p",
        "No Spec Kit specifications detected yet. Open a Spec Kit workspace and the " +
          "map of your specs will appear here.",
      ),
    );
  }

  for (const warning of model.warnings ?? []) {
    const note = el("p", warning.message);
    note.className = "warning";
    app.append(note);
  }

  const refresh = document.createElement("button");
  refresh.type = "button";
  refresh.textContent = "Refresh";
  refresh.addEventListener("click", () => post({ type: "refresh" }));
  app.append(refresh);
}

function el(tag: string, text: string): HTMLElement {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}

window.addEventListener("message", (event: MessageEvent<HostToWebview>) => {
  const message = event.data;
  if (message?.type === "render") {
    render(message.model);
  }
});

// Announce readiness so the host knows it can send the first render (W-4).
post({ type: "ready" });
