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

// ---------- offline outbox (live mode) ----------
// Writes made while the phone has no signal are kept in localStorage and replayed
// in order when the browser comes back online or the company is loaded again.

type OutOp = { op: "up"; cid: string; kind: string; items: WithId[] } | { op: "del"; cid: string; kind: string; id: string };
const OUTBOX = "asbuilt:outbox";
const outboxListeners = new Set<() => void>();
const readOutbox = (): OutOp[] => {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(OUTBOX) ?? "[]") as OutOp[];
  } catch {
    return [];
  }
};
const writeOutbox = (ops: OutOp[]) => {
  try {
    window.localStorage.setItem(OUTBOX, JSON.stringify(ops));
  } catch {
    // storage full: changes stay in memory for this session
  }
  outboxListeners.forEach((l) => l());
};
const enqueue = (op: OutOp) => writeOutbox([...readOutbox(), op]);
/** number of changes waiting to sync (for the offline badge) */
export const pendingSync = () => readOutbox().length;
export function usePendingSync() {
  return useSyncExternalStore(
    (l) => {
      outboxListeners.add(l);
      return () => outboxListeners.delete(l);
    },
    pendingSync,
    () => 0,
  );
}

type Sb = NonNullable<ReturnType<typeof supabase>>;
async function sendUp(sb: Sb, cid: string, kind: string, items: WithId[]) {
  const rows = items.map((d) => ({ company_id: cid, kind, id: d.id, project_id: d.projectId ?? null, data: d }));
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await sb.from("records").upsert(rows.slice(i, i + 500));
    if (error) throw new Error(error.message);
  }
}
async function sendDel(sb: Sb, cid: string, kind: string, id: string) {
  const { error } = await sb.from("records").delete().eq("company_id", cid).eq("kind", kind).eq("id", id);
  if (error) throw new Error(error.message);
}
const offline = () => typeof navigator !== "undefined" && navigator.onLine === false;
const isNetworkError = (e: unknown) => offline() || (e instanceof TypeError && /fetch|network/i.test(e.message));

let flushing = false;
export async function flushOutbox() {
  const sb = supabase();
  if (!sb || flushing || offline()) return;
  flushing = true;
  try {
    while (readOutbox().length) {
      const op = readOutbox()[0];
      try {
        if (op.op === "up") await sendUp(sb, op.cid, op.kind, op.items);
        else await sendDel(sb, op.cid, op.kind, op.id);
      } catch (e) {
        if (isNetworkError(e)) break; // still offline: try again later
        console.error(`outbox ${op.kind}:`, (e as Error).message); // rejected by the server: drop it
      }
      writeOutbox(readOutbox().slice(1));
    }
  } finally {
    flushing = false;
  }
}
if (typeof window !== "undefined") window.addEventListener("online", () => void flushOutbox());
onTenantLoad(() => void flushOutbox());

async function writeRemote(kind: string, items: WithId[]) {
  const sb = supabase();
  const cid = workspace().companyId;
  if (!sb || !cid) return;
  if (offline() || pendingSync()) return enqueue({ op: "up", cid, kind, items }); // keep order behind queued ops
  try {
    await sendUp(sb, cid, kind, items);
  } catch (e) {
    if (isNetworkError(e)) enqueue({ op: "up", cid, kind, items });
    else console.error(`records ${kind}:`, (e as Error).message);
  }
}

async function deleteRemote(kind: string, id: string) {
  const sb = supabase();
  const cid = workspace().companyId;
  if (!sb || !cid) return;
  if (offline() || pendingSync()) return enqueue({ op: "del", cid, kind, id });
  try {
    await sendDel(sb, cid, kind, id);
  } catch (e) {
    if (isNetworkError(e)) enqueue({ op: "del", cid, kind, id });
    else console.error(`records ${kind}:`, (e as Error).message);
  }
}

// ---------- audit trail ----------
// Every change made through a collection is logged (who, when, what).
// Read it with auditLog.use(); shown on /settings → ประวัติการแก้ไข.

export type AuditEntry = { id: string; at: string; by: string; kind: string; action: "create" | "update" | "delete"; recId: string; label: string; projectId?: string };
const AUDIT_KIND = "audit_log";
const AUDIT_KEEP = 3000; // demo mode keeps the latest N in this browser
let auditSeq = 0;
let auditCol: Collection<AuditEntry> | null = null;
let auditPending: AuditEntry[] = [];
const auditFlushSoon = () =>
  queueMicrotask(() => {
    if (!auditCol || !auditPending.length) return;
    const batch = auditPending;
    auditPending = [];
    auditCol.upsertMany(batch);
  });
const actorName = () => {
  const w = workspace();
  if (isLiveReady()) return w.displayName ?? w.email ?? "ผู้ใช้";
  let role = "admin";
  try {
    role = window.localStorage.getItem("asbuilt:demoRole") ?? "admin";
  } catch {
    // no storage
  }
  return `ผู้ใช้เดโม (${role})`;
};
const labelOf = (x: Record<string, unknown>) => String(x.title ?? x.name ?? x.subject ?? x.description ?? x.task ?? x.id).slice(0, 120);
function audit(kind: string, action: AuditEntry["action"], rec: WithId) {
  if (kind === AUDIT_KIND || kind === "ai_chats" || typeof window === "undefined") return;
  auditPending.push({
    id: `AUD-${Date.now().toString(36)}-${(auditSeq++).toString(36)}`,
    at: new Date().toISOString(),
    by: actorName(),
    kind,
    action,
    recId: rec.id,
    label: labelOf(rec as unknown as Record<string, unknown>),
    projectId: rec.projectId,
  });
  auditFlushSoon();
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
      if (kind !== AUDIT_KIND) {
        const before = new Set(all().map((x) => x.id));
        for (const it of items) audit(kind, before.has(it.id) ? "update" : "create", it);
      }
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
      if (kind === AUDIT_KIND) {
        // cap the demo audit trail
        const ids = Object.keys(l.up);
        if (ids.length > AUDIT_KEEP) for (const old of ids.slice(0, ids.length - AUDIT_KEEP)) delete l.up[old];
      }
      saveLocal();
      emit();
    },
    remove: (id) => {
      const gone = all().find((x) => x.id === id);
      if (gone) audit(kind, "delete", gone);
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

auditCol = createCollection<AuditEntry>(AUDIT_KIND, []);
export const auditLog = auditCol;

/** Demo-mode helper: forget browser edits of every collection (used by "reset demo data"). */
export function resetLocalCollections() {
  if (typeof window === "undefined") return;
  for (const k of Object.keys(window.localStorage)) if (k.startsWith("asbuilt:col:")) window.localStorage.removeItem(k);
  window.location.reload();
}
