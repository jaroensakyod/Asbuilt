"use client";

import { useMemo, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Cloud, CloudLightning, CloudRain, Minus, Plus, Sun } from "lucide-react";
import { cx } from "@/components/ui";
import { I } from "@/components/ops/bits";
import { qrPath } from "@/components/portal/qr";
import { SyncBadge } from "@/components/shell/pwa";
import { WEATHER_LABEL, type Weather } from "@/lib/biz";
import { promptPayPayload } from "@/lib/field/promptpay";

export const WEATHERS: Weather[] = ["sunny", "cloudy", "rain", "storm"];
export function WeatherIcon({ w, size = 16 }: { w: Weather; size?: number }) {
  const p = { size, strokeWidth: 1.5 };
  return w === "sunny" ? <Sun {...p} /> : w === "cloudy" ? <Cloud {...p} /> : w === "rain" ? <CloudRain {...p} /> : <CloudLightning {...p} />;
}
export function WeatherText({ am, pm }: { am: Weather; pm: Weather }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-ink-2">
      <WeatherIcon w={am} />
      <span>{WEATHER_LABEL[am]}</span>
      <span className="text-ink-3">/</span>
      <WeatherIcon w={pm} />
      <span>{WEATHER_LABEL[pm]}</span>
    </span>
  );
}

/** Big +/− counter for phones */
export function Stepper({ value, onChange, min = 0, label, big }: { value: number; onChange: (v: number) => void; min?: number; label: string; big?: boolean }) {
  const btn = cx("inline-flex items-center justify-center rounded-[10px] border border-line-strong bg-card text-ink active:scale-[0.97] disabled:opacity-40", big ? "size-12" : "size-8");
  return (
    <div className="inline-flex items-center gap-2" role="group" aria-label={label}>
      <button type="button" className={btn} aria-label={`ลด ${label}`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}>
        <Minus {...I} />
      </button>
      <span className={cx("num min-w-8 text-center font-mono", big ? "text-[20px]" : "text-[14px]")}>{value}</span>
      <button type="button" className={btn} aria-label={`เพิ่ม ${label}`} onClick={() => onChange(value + 1)}>
        <Plus {...I} />
      </button>
    </div>
  );
}

/** QR code as SVG */
export function QrSvg({ text, size = 200, className }: { text: string; size?: number; className?: string }) {
  const q = useMemo(() => {
    try {
      return qrPath(text);
    } catch {
      return null;
    }
  }, [text]);
  if (!q) return <p className="text-[13px] text-neg">สร้าง QR ไม่ได้</p>;
  return (
    <svg viewBox={`0 0 ${q.size} ${q.size}`} width={size} height={size} className={className} role="img" aria-label="QR code" shapeRendering="crispEdges">
      <rect width={q.size} height={q.size} fill="#fff" />
      <path d={q.d} fill="#1f1a14" />
    </svg>
  );
}

/** PromptPay QR for an amount, or a note when the company id is not set */
export function PromptPayQr({ id, name, amount, size = 200 }: { id: string; name: string; amount: number; size?: number }) {
  const payload = useMemo(() => {
    try {
      return promptPayPayload(id, amount);
    } catch {
      return null;
    }
  }, [id, amount]);
  if (!payload) return <p className="text-[13px] text-neg">ตั้งค่าพร้อมเพย์ของบริษัทไม่ถูกต้อง (เบอร์ 10 หลัก หรือเลขผู้เสียภาษี 13 หลัก)</p>;
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <p className="text-[13px] font-medium">พร้อมเพย์ · PromptPay</p>
      <QrSvg text={payload} size={size} />
      <p className="text-[13px] text-ink-2">{name}</p>
      <p className="num font-mono text-[18px]">฿{amount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</p>
      <p className="font-mono text-[11px] text-ink-3">{id}</p>
    </div>
  );
}

// ---------- phone shell (/m/*) ----------

export function MShell({ title, back = "/m", children, action }: { title: string; back?: string | null; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mx-auto min-h-screen max-w-[480px] bg-page pb-24">
      <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-line bg-page/95 px-3 backdrop-blur-[2px]">
        {back && (
          <Link href={back} aria-label="กลับ" className="inline-flex size-10 items-center justify-center rounded-[10px] text-ink-2 hover:bg-raised">
            <ArrowLeft size={20} strokeWidth={1.5} />
          </Link>
        )}
        <h1 className="min-w-0 flex-1 truncate text-[17px] font-medium">{title}</h1>
        <SyncBadge />
        {action}
      </header>
      <main className="px-4 py-4">{children}</main>
    </div>
  );
}

/** Large touch button for phones */
export function MBtn({ children, onClick, primary, disabled, danger, type = "button" }: { children: ReactNode; onClick?: () => void; primary?: boolean; disabled?: boolean; danger?: boolean; type?: "button" | "submit" }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "inline-flex h-12 w-full items-center justify-center gap-2 rounded-[12px] text-[15px] font-medium transition-transform duration-150 active:scale-[0.98] disabled:opacity-40",
        primary ? "bg-ink text-card" : danger ? "border border-line-strong bg-card text-neg" : "border border-line-strong bg-card text-ink",
      )}
    >
      {children}
    </button>
  );
}

export const mInput = "h-12 w-full rounded-[12px] border border-line-strong bg-card px-3 text-[16px] text-ink outline-none placeholder:text-ink-3 focus:border-ink-3";
export const mArea = "min-h-[96px] w-full rounded-[12px] border border-line-strong bg-card px-3 py-2.5 text-[16px] text-ink outline-none placeholder:text-ink-3 focus:border-ink-3";

export function MLabel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-[14px] text-ink-2">
      {label}
      {children}
    </label>
  );
}

/** Ask the browser for a GPS fix (resolves undefined when denied / unavailable). */
export function getPosition(timeout = 8000): Promise<{ lat: number; lng: number } | undefined> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(undefined);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: Math.round(p.coords.latitude * 1e6) / 1e6, lng: Math.round(p.coords.longitude * 1e6) / 1e6 }),
      () => resolve(undefined),
      { enableHighAccuracy: true, timeout, maximumAge: 60000 },
    );
  });
}

export const mapsUrl = (lat?: number, lng?: number, q?: string) =>
  lat !== undefined && lng !== undefined ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q ?? "")}`;
