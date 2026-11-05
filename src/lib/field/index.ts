// Module entry: importing this registers the module's collections, seeds and notification feeds.
// Field (site diary, phone app, punch list) + service (dispatch, van stock, service contracts, warranty).
import "./store";
import { registerFieldNotes } from "./notes";

registerFieldNotes();

export * from "./store";
