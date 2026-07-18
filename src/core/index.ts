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
  // Graph model (feature 002)
  ArtifactPresence,
  FeatureInput,
  ProjectSnapshot,
  ReferenceKind,
  Reference,
  FeatureFacts,
  SpecNode,
  EdgeTier,
  RelationEdge,
  ProjectGraph,
  WorkspaceGraph,
  GraphOptions,
} from "./model/types.js";

export {
  detectRoot,
  detectRoots,
  SIGNAL_DOT_SPECIFY,
  SIGNAL_SPECS_SPEC,
} from "./detection/detect.js";
export { buildMapViewModel } from "./model/viewModel.js";
export {
  parseFeature,
  buildProjectGraph,
  buildWorkspaceGraph,
  DEFAULT_GRAPH_OPTIONS,
} from "./graph/index.js";

// Query layer (feature 004)
export type {
  QueryKind,
  QueryScope,
  SpecRelationships,
  StatusRow,
  StatusSummary,
  Orphans,
  CheckResult,
  QueryResult,
} from "./query/index.js";
export {
  getGraph,
  specRelationships,
  statusSummary,
  orphans,
  runCheck,
  KNOWN_CHECK_RULES,
  toEnvelope,
  formatText,
} from "./query/index.js";
