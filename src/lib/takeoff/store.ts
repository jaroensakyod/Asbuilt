// Per-project takeoff settings (block type, waste, sample prices, rules). Stored like every other
// module record: localStorage in demo mode, public.records in live mode.

import { createCollection } from "@/lib/collection";
import { DEFAULT_SETTINGS, type AddedOpening, type TakeoffEdits, type TakeoffSettings, type WallEdit } from "./types";

export const takeoffSettings = createCollection<TakeoffSettings>("takeoff_settings", []);

export function settingsFor(list: TakeoffSettings[], projectId: string): TakeoffSettings {
  const s = list.find((x) => x.projectId === projectId);
  return {
    id: `TO-${projectId}`,
    projectId,
    ...DEFAULT_SETTINGS,
    ...s,
    waste: { ...DEFAULT_SETTINGS.waste, ...s?.waste },
    price: { ...DEFAULT_SETTINGS.price, ...s?.price },
    labour: { ...DEFAULT_SETTINGS.labour, ...s?.labour },
  };
}

export const saveSettings = (s: TakeoffSettings) => takeoffSettings.upsert(s);
export const resetSettings = (projectId: string) => takeoffSettings.remove(`TO-${projectId}`);

// ---------- wall edits (per project + source) ----------

export const takeoffEdits = createCollection<TakeoffEdits>("takeoff_edits", []);

const editId = (projectId: string, source: string) => `TE-${projectId}-${source}`;

export function editsFor(list: TakeoffEdits[], projectId: string, source: string): TakeoffEdits {
  return list.find((x) => x.id === editId(projectId, source)) ?? { id: editId(projectId, source), projectId, source, walls: {}, removed: [], added: [] };
}

const save = (e: TakeoffEdits) => takeoffEdits.upsert(e);

export function editWall(e: TakeoffEdits, wallId: string, patch: WallEdit) {
  const cur = { ...e.walls[wallId], ...patch };
  const clean = Object.fromEntries(Object.entries(cur).filter(([, v]) => v !== undefined && v !== false)) as WallEdit;
  const walls = { ...e.walls };
  if (Object.keys(clean).length) walls[wallId] = clean;
  else delete walls[wallId];
  save({ ...e, walls });
}

export function removeOpening(e: TakeoffEdits, wallId: string, openingId: string) {
  const added = e.added.filter((a) => !(a.wallId === wallId && a.id === openingId));
  if (added.length !== e.added.length) return save({ ...e, added });
  save({ ...e, removed: [...new Set([...e.removed, `${wallId}:${openingId}`])] });
}

export function restoreOpening(e: TakeoffEdits, key: string) {
  save({ ...e, removed: e.removed.filter((k) => k !== key) });
}

export function addOpening(e: TakeoffEdits, a: Omit<AddedOpening, "id">) {
  const prefix = `${a.kind === "door" ? "D" : "W"}-N`;
  const n = Math.max(0, ...e.added.filter((x) => x.id.startsWith(prefix)).map((x) => Number(x.id.slice(prefix.length)) || 0)) + 1;
  const id = `${prefix}${n}`;
  save({ ...e, added: [...e.added, { ...a, id }] });
}

/** Undo every edit on one wall. */
export function resetWall(e: TakeoffEdits, wallId: string) {
  const walls = { ...e.walls };
  delete walls[wallId];
  save({ ...e, walls, removed: e.removed.filter((k) => !k.startsWith(`${wallId}:`)), added: e.added.filter((a) => a.wallId !== wallId) });
}

export const resetEdits = (e: TakeoffEdits) => takeoffEdits.remove(e.id);
