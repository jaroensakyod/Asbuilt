"use client";

// Small phone-screen kit shared by /m/clock and /m/toolbox (375 px, big touch targets).
import Link from "next/link";
import { useSyncExternalStore, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { cx } from "@/components/ui";
import { ACTIVE_SITES } from "@/lib/hr/seed";

export function PhoneShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto min-h-screen max-w-[480px] bg-page pb-24">
      <header className="sticky top-0 z-20 border-b border-line bg-page px-3">
        <div className="flex h-14 items-center gap-2">
          <Link href="/m" className="inline-flex h-10 items-center gap-1.5 rounded-[10px] px-2 text-[14px] text-ink-2 hover:bg-raised">
            <ArrowLeft size={20} strokeWidth={1.5} />
            แอปหน้างาน
          </Link>
        </div>
        <h1 className="pb-3 text-[20px] font-normal leading-tight">{title}</h1>
      </header>
      <main className="flex flex-col gap-4 px-4 py-4">{children}</main>
    </div>
  );
}

export function PhoneBtn({ children, onClick, primary, disabled, className }: { children: ReactNode; onClick?: () => void; primary?: boolean; disabled?: boolean; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "inline-flex h-12 w-full items-center justify-center gap-2 rounded-[12px] text-[16px] font-medium transition-transform duration-150 active:scale-[0.98] disabled:opacity-40",
        primary ? "bg-ink text-card" : "border border-line-strong bg-card text-ink",
        className,
      )}
    >
      {children}
    </button>
  );
}

export const phoneInput = "h-12 w-full rounded-[12px] border border-line-strong bg-card px-3 text-[16px] text-ink outline-none placeholder:text-ink-3 focus:border-ink-3";

export function PhoneLabel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-[14px] text-ink-2">
      {label}
      {children}
    </label>
  );
}

export function PhoneCard({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cx("rounded-[14px] border border-line bg-card p-4", className)}>{children}</section>;
}

// ---------- remembered site (localStorage, read through useSyncExternalStore) ----------

const SITE_KEY = "asbuilt:phoneSite";
const siteListeners = new Set<() => void>();
const readSite = () => {
  const v = window.localStorage.getItem(SITE_KEY) ?? "";
  return ACTIVE_SITES.some((p) => p.id === v) ? v : (ACTIVE_SITES[0]?.id ?? "");
};
export function useRememberedSite(): [string, (id: string) => void] {
  const site = useSyncExternalStore(
    (l) => {
      siteListeners.add(l);
      return () => siteListeners.delete(l);
    },
    readSite,
    () => ACTIVE_SITES[0]?.id ?? "",
  );
  const set = (id: string) => {
    window.localStorage.setItem(SITE_KEY, id);
    siteListeners.forEach((l) => l());
  };
  return [site, set];
}

export function PhoneSiteSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <PhoneLabel label="หน้างาน">
      <select className={phoneInput} value={value} onChange={(e) => onChange(e.target.value)}>
        {ACTIVE_SITES.map((p) => (
          <option key={p.id} value={p.id}>
            {p.id} · {p.name}
          </option>
        ))}
      </select>
    </PhoneLabel>
  );
}

/** current GPS fix, or undefined when denied / unavailable / timed out */
export function getFix(timeout = 10000): Promise<{ lat: number; lng: number; acc: number } | undefined> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(undefined);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, acc: Math.round(p.coords.accuracy) }),
      () => resolve(undefined),
      { enableHighAccuracy: true, timeout, maximumAge: 30000 },
    );
  });
}
