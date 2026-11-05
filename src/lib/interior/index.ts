// Module entry: importing this registers the module's collections, seeds and notification feeds.
// Client selections (house finishes) and interior fit-out: catalogue, boards, FF&E, samples, installation, punch list.
import "./store";
import "./notes";

export * from "./types";
export * from "./calc";
export * from "./store";
export { DESIGNERS, CREWS } from "./seed";
