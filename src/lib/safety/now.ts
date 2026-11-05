// Demo clock: the demo date (TODAY) with the browser's time of day, refreshed every minute.
// Server render and hydration use noon so the markup matches.
import { useSyncExternalStore } from "react";
import { TODAY } from "../data";

const sub = (cb: () => void) => {
  const t = window.setInterval(cb, 60_000);
  return () => window.clearInterval(t);
};
export const timeOfDay = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const snap = () => `${TODAY}T${timeOfDay()}`;
/** "2026-11-04T14:05" */
export const useNow = () => useSyncExternalStore(sub, snap, () => `${TODAY}T12:00`);

export const dayDiff = (iso: string) => Math.round((Date.parse(iso.slice(0, 10)) - Date.parse(TODAY)) / 86400000);
export const dueText = (d: number) => (d < 0 ? `เลยกำหนด ${-d} วัน` : d === 0 ? "ครบกำหนดวันนี้" : `อีก ${d} วัน`);
