// Document stores shared by the documents page and the workspace loader.
// Demo mode: uploads and edits are kept in this browser (localStorage).
// Live mode: see the sync handlers below.

import { allDocs, type DocCategory, type DocItem } from "./docs-data";
import { createLocalStore, syncById } from "./projects-store";
import { upsertRow } from "./workspace";
import { docRow } from "./doc-files";


export type Override = { title?: string; category?: DocCategory; tags?: string[] };
const NO_UPLOADS: DocItem[] = [];
const NO_OVERRIDES: Record<string, Override> = {};
// Live mode: every stored document is loaded into `allDocs`; new uploads go to `uploads`
// and the documents table; edits are merged straight into the document row.
export const uploads = createLocalStore<DocItem[]>("asbuilt.docs.uploads.v1", NO_UPLOADS, {
  hydrate: (rows) => {
    allDocs.splice(0, allDocs.length, ...(rows.documents as DocItem[]));
    return [];
  },
  onChange: syncById<DocItem>("documents", docRow),
});
export const overrides = createLocalStore<Record<string, Override>>("asbuilt.docs.overrides.v1", NO_OVERRIDES, {
  hydrate: () => ({}),
  onChange: (prev, next) => {
    for (const [id, o] of Object.entries(next)) {
      if (prev[id] === o) continue;
      const doc = allDocs.find((d) => d.id === id) ?? uploads.get().find((d) => d.id === id);
      if (doc) void upsertRow("documents", docRow({ ...doc, ...o }));
    }
  },
});

