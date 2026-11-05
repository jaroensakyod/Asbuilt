// Module entry: importing this registers the module's collections, seeds and notification feeds.
import "./store";
import { registerTenderNotes } from "./notes";

registerTenderNotes();

export * from "./store";
