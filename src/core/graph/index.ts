/** Public surface of the spec-relationship graph model (feature 002). Pure core. */
export { parseFeature } from "./parseFeature.js";
export { buildProjectGraph } from "./buildProjectGraph.js";
export { buildWorkspaceGraph } from "./buildWorkspaceGraph.js";
export { DEFAULT_GRAPH_OPTIONS, resolveOptions } from "./options.js";
export {
  extractLinks,
  extractSlugMentions,
  extractBareNumbers,
  extractEntities,
  extractCodeReferences,
} from "./heuristics.js";
