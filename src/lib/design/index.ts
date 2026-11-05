// Module entry: importing this registers the module's collections, seeds and notification feeds.
// Design stages, building permits, specifications, and the customer-portal records (messages, surveys).
import "./store";
import "./notes";

export * from "./types";
export * from "./calc";
export * from "./store";
export { satisfactionScore, responseAvg, isLowScore, type SatisfactionScore } from "./satisfaction";
export { SPEC_LIBRARY } from "./spec-library";
export { ARCHITECTS, ENGINEERS, defaultDeliverables } from "./seed";
