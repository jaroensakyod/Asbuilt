"use client";

// Document files in live mode: uploaded to the private "documents" bucket under
// <company_id>/<doc id>/<file name> and opened through short-lived signed URLs.

import { useEffect, useState } from "react";
import { supabase } from "./supabase/client";
import { isLiveReady, upsertRow, workspace } from "./workspace";
import type { DocItem } from "./docs-data";

export type StoredDoc = DocItem & { storagePath?: string };

export const docRow = (d: StoredDoc) => ({ id: d.id, project_id: d.projectId || null, kind: d.category, storage_path: d.storagePath ?? null, data: d });

const safeName = (name: string) => name.normalize("NFC").replace(/[^\p{L}\p{N}._-]+/gu, "_");

/** Upload the file and record its storage path. Returns the updated doc. */
export async function uploadDocFile(doc: StoredDoc, file: File): Promise<StoredDoc | null> {
  const sb = supabase();
  const cid = workspace().companyId;
  if (!sb || !cid || !isLiveReady()) return null;
  const path = `${cid}/${doc.id}/${safeName(file.name)}`;
  const { error } = await sb.storage.from("documents").upload(path, file, { contentType: file.type || undefined, upsert: true });
  if (error) {
    console.error("upload failed", error.message);
    return null;
  }
  const next = { ...doc, storagePath: path, local: false };
  await upsertRow("documents", docRow(next));
  return next;
}

export async function signedDocUrl(doc: StoredDoc, download = false): Promise<string | null> {
  const sb = supabase();
  if (!sb || !doc.storagePath) return null;
  const { data, error } = await sb.storage.from("documents").createSignedUrl(doc.storagePath, 300, download ? { download: doc.file } : undefined);
  if (error) return null;
  return data.signedUrl;
}

/** Signed URL for previewing a stored file (null while loading or when the doc has no file). */
export function useSignedDocUrl(doc: StoredDoc | null) {
  const [url, setUrl] = useState<string | null>(null);
  const path = doc?.storagePath;
  useEffect(() => {
    let alive = true;
    if (!doc || !path) return;
    void signedDocUrl(doc).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
      setUrl(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);
  return url;
}
