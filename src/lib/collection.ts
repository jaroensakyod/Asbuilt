// Generic record collections for modules added after Phase 2 (sales, purchasing,
// HR, portal, billing …). One API for both modes:
//   demo mode → seed data + browser edits in localStorage
//   live mode → rows of public.records (kind = collection name), RLS per company
//
// Usage:
//   export const leads = createCollection<Lead>("leads", SEED_LEADS);
//   const list = leads.use();            // in a component
//   leads.upsert(lead); leads.remove(id); leads.get(id)

import { useSyncExternalStore } from "react";
import { isLiveReady, onTenantLoad, workspace } from "./workspace";
import { supabase } from "./supabase/client";

type WithId = { id: string; projectId?: string };

export type Collection<T extends WithId> = {
  kind: string;
  all: () => T[];
  get: (id: string) => T | undefined;
  use: () => T[];
  upsert: (item: T) => void;
  upsertMany: (items: T[]) => void;
  remove: (id: string) => void;
  /** next id like "QT-2026-0007" given a prefix, scanning existing ids */
  nextId: (prefix: string, pad?: number) => string;
};

type Local<T> = { up: Record<string, T>; del: string[] };

const registry = new Map<string, Collection<WithId>>();
const seeds = new Map<string, () => WithId[]>();
/** demo seed of every collection, for "ใส่ข้อมูลตัวอย่าง" in a new live company */
export const collectionSeeds = () => [...seeds.entries()].map(([kind, get]) => ({ kind, items: get() }));
/** every collection, so the demo seeder and resets can walk them */
export const collections = () => [...registry.values()];

/** Live rows for all collections, fetched once per company load. */
let liveRows: Map<string, unknown[]> | null = null;
const liveHydrators = new Set<() => void>();

onTenantLoad(() => {
  // the workspace has just loaded a company: fetch every record kind in one query
  void (async () => {
    const sb = supabase();
    const cid = workspace().companyId;
    if (!sb || !cid) return;
    const out = new Map<string, unknown[]>();
    const page = 1000;
    for (let from = 0; ; from += page) {
      const { data, error } = await sb.from("records").select("kind, data").eq("company_id", cid).range(from, from + page - 1);
      if (error) {
        console.error("records:", error.message);
        break;
      }
      for (const r of data ?? []) out.set(r.kind as string, [...(out.get(r.kind as string) ?? []), r.data]);
      if (!data || data.length < page) break;
    }
    liveRows = out;
    liveHydrators.forEach((h) => h());
  })();
});

async function writeRemote(kind: string, items: WithId[]) {
  const sb = supabase();
  const cid = workspace().companyId;
  if (!sb || !cid) return;
  const rows = items.map((d) => ({ company_id: cid, kind, id: d.id, project_id: d.projectId ?? null, data: d }));
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await sb.from("records").upsert(rows.slice(i, i + 500));
    if (error) console.error(`records ${kind}:`, error.message);
  }
}

async function deleteRemote(kind: string, id: string) {
  const sb = supabase();
  const cid = workspace().companyId;
  if (!sb || !cid) return;
  const { error } = await sb.from("records").delete().eq("company_id", cid).eq("kind", kind).eq("id", id);
  if (error) console.error(`records ${kind}:`, error.message);
}

export function createCollection<T extends WithId>(kind: string, seed: T[] | (() => T[])): Collection<T> {
  const key = `asbuilt:col:${kind}`;
  const listeners = new Set<() => void>();
  let seedCache: T[] | null = null;
  const seedList = () => (seedCache ??= typeof seed === "function" ? (seed as () => T[])() : seed);

  // demo state
  let local: Local<T> | null = null;
  // live state
  let live: T[] | null = null;

  let snapshot: T[] | null = null;
  const emit = () => {
    snapshot = null;
    listeners.forEach((l) => l());
  };

  liveHydrators.add(() => {
    live = (liveRows?.get(kind) as T[] | undefined) ?? [];
    emit();
  });
  // created after the company already loaded (lazy route chunk)
  if (liveRows) live = (liveRows.get(kind) as T[] | undefined) ?? [];

  const loadLocal = (): Local<T> => {
    if (local) return local;
    local = { up: {}, del: [] };
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(key);
        if (raw) local = JSON.parse(raw) as Local<T>;
      } catch {
        // ignore broken storage
      }
    }
    return local;
  };
  const saveLocal = () => {
    try {
      window.localStorage.setItem(key, JSON.stringify(local));
    } catch {
      // storage full: keep in memory
    }
  };

  const compute = (): T[] => {
    if (isLiveReady()) return live ?? [];
    const l = loadLocal();
    const del = new Set(l.del);
    const seen = new Set<string>();
    const out: T[] = [];
    for (const x of seedList()) {
      seen.add(x.id);
      if (!del.has(x.id)) out.push(l.up[x.id] ?? x);
    }
    for (const [id, v] of Object.entries(l.up)) if (!seen.has(id) && !del.has(id)) out.push(v);
    return out;
  };

  const all = () => (snapshot ??= compute());
  const serverSnapshot = () => (isLiveReady() ? [] : seedList());

  const col: Collection<T> = {
    kind,
    all,
    get: (id) => all().find((x) => x.id === id),
    use: () =>
      useSyncExternalStore(
        (l) => {
          listeners.add(l);
          return () => listeners.delete(l);
        },
        all,
        serverSnapshot,
      ),
    upsert: (item) => col.upsertMany([item]),
    upsertMany: (items) => {
      if (!items.length) return;
      if (isLiveReady()) {
        const map = new Map((live ?? []).map((x) => [x.id, x]));
        for (const it of items) map.set(it.id, it);
        live = [...map.values()];
        emit();
        void writeRemote(kind, items);
        return;
      }
      const l = loadLocal();
      for (const it of items) {
        l.up[it.id] = it;
        l.del = l.del.filter((d) => d !== it.id);
      }
      saveLocal();
      emit();
    },
    remove: (id) => {
      if (isLiveReady()) {
        live = (live ?? []).filter((x) => x.id !== id);
        emit();
        void deleteRemote(kind, id);
        return;
      }
      const l = loadLocal();
      delete l.up[id];
      if (!l.del.includes(id)) l.del.push(id);
      saveLocal();
      emit();
    },
    nextId: (prefix, pad = 4) => {
      let max = 0;
      for (const x of all()) {
        if (!x.id.startsWith(prefix)) continue;
        const n = Number(x.id.slice(prefix.length).replace(/\D/g, ""));
        if (n > max) max = n;
      }
      return `${prefix}${String(max + 1).padStart(pad, "0")}`;
    },
  };
  registry.set(kind, col as unknown as Collection<WithId>);
  seeds.set(kind, () => seedList() as WithId[]);
  return col;
}

/** Demo-mode helper: forget browser edits of every collection (used by "reset demo data"). */
export function resetLocalCollections() {
  if (typeof window === "undefined") return;
  for (const k of Object.keys(window.localStorage)) if (k.startsWith("asbuilt:col:")) window.localStorage.removeItem(k);
  window.location.reload();
}
