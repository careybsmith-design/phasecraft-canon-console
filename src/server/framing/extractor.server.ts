/**
 * Server-entry bridge for the framing extractor. Client-bundled server-function
 * modules may only dynamically import `*.server` files (import-protection), so
 * the ModelGateway extractor is re-exported under the server suffix here.
 */
export {
  classifyUnits,
  findContradictions,
  describeDrawing,
  EXTRACTOR_VERSIONS,
  type ExtractorVersion,
  type ClassifiedUnit,
  type ClassifyOutcome,
} from "./extractor";
