"use client";

import { useEffect, useSyncExternalStore } from "react";
import { CloudOff, RefreshCw } from "lucide-react";
import { flushOutbox, usePendingSync } from "@/lib/collection";

/** Registers the service worker (production builds only, so dev hot-reload is not cached). */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);
  return null;
}

const subscribeOnline = (cb: () => void) => {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
};
export const useOnline = () =>
  useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );

/** Small status chip for the top bar: offline, or changes waiting to sync. */
export function SyncBadge() {
  const online = useOnline();
  const pending = usePendingSync();
  if (online && !pending) return null;
  return online ? (
    <button
      type="button"
      onClick={() => void flushOutbox()}
      title="มีรายการที่ยังไม่ได้ส่งขึ้นระบบ กดเพื่อส่งตอนนี้"
      className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-line-strong bg-card px-2.5 text-[12px] text-ink-2 hover:bg-raised"
    >
      <RefreshCw size={14} strokeWidth={1.5} />
      รอซิงก์ <span className="font-mono">{pending}</span>
    </button>
  ) : (
    <span title="ไม่มีสัญญาณ บันทึกได้ตามปกติ ระบบจะส่งขึ้นเมื่อกลับมาออนไลน์" className="inline-flex h-8 items-center gap-1.5 rounded-[8px] bg-warn-soft px-2.5 text-[12px] text-warn">
      <CloudOff size={14} strokeWidth={1.5} />
      ออฟไลน์{pending ? ` · ${pending}` : ""}
    </span>
  );
}
