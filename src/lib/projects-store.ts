// Browser-only stores kept in localStorage. SSR-safe: the server snapshot is
// always the fallback value, the client reads localStorage after hydration
// through useSyncExternalStore.

import { useSyncExternalStore } from "react";
import { getHouseModel, TODAY, projects, type Project } from "./data";
import { isLiveReady, onTenantLoad, upsertRow, deleteRow, type TenantRows } from "./workspace";

export type LocalStore<T> = {
  get: () => T;
  set: (next: T | ((prev: T) => T)) => void;
  subscribe: (fn: () => void) => () => void;
  use: () => T;
};

/**
 * Live-mode sync: when a company is loaded the store is filled by `hydrate`
 * (in memory only) and every change is passed to `onChange` to persist it.
 */
export type StoreSync<T> = {
  hydrate: (rows: TenantRows) => T;
  onChange: (prev: T, next: T) => void;
};

export function createLocalStore<T>(key: string, fallback: T, sync?: StoreSync<T>): LocalStore<T> {
  const listeners = new Set<() => void>();
  let raw: string | null | undefined;
  let cache: T = fallback;
  let live: { value: T } | null = null;

  if (sync)
    onTenantLoad((rows) => {
      live = { value: sync.hydrate(rows) };
      listeners.forEach((fn) => fn());
    });

  const read = (): T => {
    if (typeof window === "undefined") return fallback;
    if (isLiveReady() || live) return live ? live.value : fallback;
    let next: string | null = null;
    try {
      next = window.localStorage.getItem(key);
    } catch {
      next = null;
    }
    if (next !== raw) {
      raw = next;
      try {
        cache = next ? (JSON.parse(next) as T) : fallback;
      } catch {
        cache = fallback;
      }
    }
    return cache;
  };

  const emit = () => listeners.forEach((fn) => fn());

  const set = (v: T | ((prev: T) => T)) => {
    const value = typeof v === "function" ? (v as (prev: T) => T)(read()) : v;
    if (isLiveReady()) {
      const prev = read();
      live = { value };
      sync?.onChange(prev, value);
      emit();
      return;
    }
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // storage full or disabled: keep the in-memory value for this session
      raw = JSON.stringify(value);
      cache = value;
    }
    emit();
  };

  const subscribe = (fn: () => void) => {
    listeners.add(fn);
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) fn();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(fn);
      window.removeEventListener("storage", onStorage);
    };
  };

  const getServer = () => fallback;

  return {
    get: read,
    set,
    subscribe,
    use: () => useSyncExternalStore(subscribe, read, getServer),
  };
}

// ---------- projects created in the browser ----------

export type NewProjectInput = {
  owner: string;
  phone: string;
  modelCode: string;
  province: string;
  address: string;
  start: string;
  value: number;
  pm: string;
};

const EMPTY: Project[] = [];
/** Persist array items by id: upsert changed or new items, delete removed ones. */
export function syncById<T extends { id: string }>(table: Parameters<typeof upsertRow>[0], toRow: (item: T) => Record<string, unknown>): StoreSync<T[]>["onChange"] {
  return (prev, next) => {
    const before = new Map(prev.map((x) => [x.id, x]));
    const after = new Set(next.map((x) => x.id));
    for (const item of next) if (before.get(item.id) !== item) void upsertRow(table, toRow(item));
    for (const id of before.keys()) if (!after.has(id)) void deleteRow(table, id);
  };
}

export const projectRow = (p: Project) => ({ id: p.id, status: p.status, model_code: p.modelCode, data: p });

// Live mode: tenant projects live in the shared `projects` array (filled from the DB);
// projects created in this session are kept here and written to the projects table.
export const localProjects = createLocalStore<Project[]>("asbuilt.projects.v1", EMPTY, {
  hydrate: () => [],
  onChange: syncById<Project>("projects", projectRow),
});

/** Update a stored project record in either mode. */
export function saveProject(p: Project) {
  const i = projects.findIndex((x) => x.id === p.id);
  if (i >= 0) {
    projects[i] = p;
    if (isLiveReady()) void upsertRow("projects", projectRow(p));
    return;
  }
  localProjects.set((prev) => prev.map((x) => (x.id === p.id ? p : x)));
}

export function useLocalProjects() {
  return localProjects.use();
}

const PROVINCE_LL: Record<string, [number, number]> = {
  "กรุงเทพฯ": [13.79, 100.6],
  "นนทบุรี": [13.87, 100.47],
  "ปทุมธานี": [14.0, 100.6],
  "สมุทรปราการ": [13.6, 100.63],
  "นครปฐม": [13.82, 100.2],
  "ชลบุรี": [13.15, 100.95],
  "เชียงใหม่": [18.79, 98.98],
  "ขอนแก่น": [16.43, 102.83],
  "อยุธยา": [14.35, 100.57],
};
export const PROVINCES = Object.keys(PROVINCE_LL);

export function addProject(input: NewProjectInput, existingIds: string[]): Project {
  const m = getHouseModel(input.modelCode);
  const year = Number(input.start.slice(0, 4)) || 2026;
  const taken = new Set([...existingIds, ...localProjects.get().map((p) => p.id)]);
  let n = 21;
  while (taken.has(`HC-${year}-${String(n).padStart(2, "0")}`)) n++;
  const id = `HC-${year}-${String(n).padStart(2, "0")}`;
  const months = m?.months ?? 10;
  const finish = new Date(Date.parse(input.start) + months * 30.4 * 86400000).toISOString().slice(0, 10);
  const base = PROVINCE_LL[input.province] ?? PROVINCE_LL["กรุงเทพฯ"];
  const jitter = (id.charCodeAt(id.length - 1) % 10) / 100 - 0.05;
  const first = input.owner.trim().split(/\s+/)[0] ?? input.owner;
  const p: Project = {
    id,
    name: `บ้านคุณ${first}`,
    owner: input.owner.trim(),
    model: m?.name ?? input.modelCode,
    modelCode: input.modelCode,
    province: input.province,
    pm: input.pm,
    status: "planning",
    actual: 0,
    plan: 0,
    phase: "ขออนุญาต",
    start: input.start,
    finish,
    value: input.value,
    floors: m?.floors ?? 2,
    area: m?.area ?? 0,
    openRepairs: 0,
    lat: Math.round((base[0] + jitter) * 10000) / 10000,
    lng: Math.round((base[1] - jitter) * 10000) / 10000,
    contractDate: TODAY,
    address: input.address,
    phone: input.phone,
  };
  localProjects.set((prev) => [p, ...prev]);
  return p;
}

export function removeLocalProject(id: string) {
  localProjects.set((prev) => prev.filter((p) => p.id !== id));
}
