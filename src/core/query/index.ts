/** Public surface of the pure query layer (feature 004). */
export type {
  QueryKind,
  QueryScope,
  SpecRelationships,
  StatusRow,
  StatusSummary,
  Orphans,
  CheckResult,
  QueryResult,
} from "./types.js";
export {
  getGraph,
  specRelationships,
  statusSummary,
  orphans,
  runCheck,
  KNOWN_CHECK_RULES,
} from "./queries.js";
export { toEnvelope, sortWorkspaceGraph, sortProjectGraph } from "./envelope.js";
export { formatText } from "./format.js";
