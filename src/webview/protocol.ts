import type { MapViewModel } from "../core/index.js";

/**
 * The postMessage contract between the extension host and the Map webview
 * (contracts/webview-protocol.md). Pure types only — shared by both sides.
 */

export type HostToWebview = { readonly type: "render"; readonly model: MapViewModel };

export type WebviewToHost = { readonly type: "ready" } | { readonly type: "refresh" };
