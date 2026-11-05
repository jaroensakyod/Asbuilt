"use client";

// Shared photo/file store for every module (inspections, repairs, site diary, safety, RFI …).
// Records only keep a MediaRef (small JSON); the bytes live elsewhere:
//   demo mode → IndexedDB in this browser (works offline)
//   live mode → Supabase Storage bucket "documents" under <companyId>/media/
// Images are downscaled before saving (long edge ≤ 1600 px, JPEG) so phones can attach many.

import { useEffect, useState } from "react";
import { isLiveReady, workspace } from "./workspace";
import { supabase } from "./supabase/client";

export type MediaRef = {
  id: string; // MED-<time>-<rand>
  name: string;
  type: string; // mime
  size: number; // bytes after compression
  at: string; // ISO datetime taken/added
  /** live mode: storage path; demo mode: undefined (bytes in IndexedDB under id) */
  path?: string;
  /** optional geotag when the browser allowed it */
  lat?: number;
  lng?: number;
  caption?: string;
};

const DB = "asbuilt-media";
const STORE = "blobs";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbPut(id: string, blob: Blob) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function idbGet(id: string): Promise<Blob | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result as Blob | undefined);
    req.onerror = () => reject(req.error);
  });
}
async function idbDel(id: string) {
  const db = await openDb();
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

/** Downscale an image file to JPEG; other files pass through unchanged. */
export async function compressImage(file: Blob, maxEdge = 1600, quality = 0.82): Promise<Blob> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml" || typeof createImageBitmap === "undefined") return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    const out = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", quality));
    return out && out.size < file.size ? out : file;
  } catch {
    return file;
  }
}

const newId = () => `MED-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

function currentPosition(): Promise<{ lat: number; lng: number } | undefined> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(undefined);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(undefined),
      { timeout: 4000, maximumAge: 60000 },
    );
  });
}

/** Save a file (photo, PDF, DXF …) and return its reference. */
export async function saveMedia(file: File, opts: { geotag?: boolean; caption?: string } = {}): Promise<MediaRef> {
  const blob = await compressImage(file);
  const id = newId();
  const isJpeg = blob !== file && blob.type === "image/jpeg";
  const name = isJpeg ? file.name.replace(/\.[^.]+$/, "") + ".jpg" : file.name;
  const pos = opts.geotag ? await currentPosition() : undefined;
  const ref: MediaRef = { id, name, type: blob.type || file.type || "application/octet-stream", size: blob.size, at: new Date().toISOString(), caption: opts.caption, ...pos };

  const sb = supabase();
  const cid = workspace().companyId;
  if (isLiveReady() && sb && cid && navigator.onLine) {
    const path = `${cid}/media/${id}-${name.replace(/[^\w.-]+/g, "_")}`;
    const { error } = await sb.storage.from("documents").upload(path, blob, { contentType: ref.type, upsert: false });
    if (!error) return { ...ref, path };
    console.error("media upload:", error.message);
  }
  // demo mode, offline, or upload failed: keep the bytes locally
  await idbPut(id, blob);
  return ref;
}

export async function deleteMedia(ref: MediaRef) {
  await idbDel(ref.id);
  const sb = supabase();
  if (ref.path && sb) await sb.storage.from("documents").remove([ref.path]);
}

const urlCache = new Map<string, string>();

/** Resolve a displayable URL (object URL or signed URL). */
export async function mediaUrl(ref: MediaRef): Promise<string | undefined> {
  const hit = urlCache.get(ref.id);
  if (hit) return hit;
  let url: string | undefined;
  if (ref.path) {
    const sb = supabase();
    const { data } = (await sb?.storage.from("documents").createSignedUrl(ref.path, 3600)) ?? { data: null };
    url = data?.signedUrl;
  }
  if (!url) {
    const blob = await idbGet(ref.id).catch(() => undefined);
    if (blob) url = URL.createObjectURL(blob);
  }
  if (url) urlCache.set(ref.id, url);
  return url;
}

export function useMediaUrl(ref?: MediaRef) {
  const [url, setUrl] = useState<string | undefined>(ref ? urlCache.get(ref.id) : undefined);
  useEffect(() => {
    let on = true;
    if (ref) void mediaUrl(ref).then((u) => on && setUrl(u));
    return () => {
      on = false;
    };
  }, [ref]);
  return url;
}

export const isImage = (ref: MediaRef) => ref.type.startsWith("image/");
export const fileSize = (n: number) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`);
