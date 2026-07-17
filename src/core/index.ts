/**
 * Public surface of the pure domain core (the contracts/core-api.md contract).
 * Consumers (the extension adapters, a future CLI, CI checks) import only from here.
 * This module and everything it re-exports is free of vscode/DOM/Node dependencies.
 */

export type {
  WorkspaceRoot,
  Warning,
  DetectionResult,
  MapViewState,
  MapViewModel,
} from "./model/types.js";

export {
  detectRoot,
  detectRoots,
  SIGNAL_DOT_SPECIFY,
  SIGNAL_SPECS_SPEC,
} from "./detection/detect.js";
export { buildMapViewModel } from "./model/viewModel.js";
