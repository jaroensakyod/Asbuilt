"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ClipboardCheck, Clock, Download, HardHat, LayoutGrid, ListChecks, NotebookPen, Wrench } from "lucide-react";
import { cx } from "@/components/ui";
import { useHydrated } from "@/components/ops/bits";
import { SyncBadge, useOnline } from "@/components/shell/pwa";
import { getProject, projects, thDate, TODAY } from "@/lib/data";
import { useWorkOrders } from "@/lib/ops-store";
import { diaryId } from "@/lib/field/calc";
import { diaries, punchItems } from "@/lib/field/store";
import { mSite, mTech } from "@/lib/field/site";
import { DIARY_STATUS_LABEL } from "@/lib/field/types";
import { useMe } from "@/lib/use-me";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export const SITE_PROJECTS = () => projects.filter((p) => p.status === "building" || p.status === "handover");
const SITE_LIST = SITE_PROJECTS();

/** today's site for the phone app: saved choice, else the first active project */
export function useSite() {
  const saved = mSite.use();
  const list = SITE_LIST;
  const id = saved && getProject(saved) ? saved : (list[0]?.id ?? "");
  return { id, project: getProject(id), set: (v: string) => mSite.set(v), list };
}

export function SitePicker({ big = true }: { big?: boolean }) {
  const site = useSite();
  return (
    <select
      value={site.id}
      onChange={(e) => site.set(e.target.value)}
      aria-label="หน้างานวันนี้"
      className={cx("w-full rounded-[12px] border border-line-strong bg-card px-3 text-ink outline-none focus:border-ink-3", big ? "h-12 text-[16px]" : "h-10 text-[14px]")}
    >
      {site.list.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name} · {p.id}
        </option>
      ))}
    </select>
  );
}

export function MHub() {
  const me = useMe();
  const site = useSite();
  const online = useOnline();
  const hydrated = useHydrated();
  const list = diaries.use();
  const punch = punchItems.use();
  const wos = useWorkOrders();
  const techSaved = mTech.use();
  const tech = techSaved || (me.role === "technician" ? me.name : "");
  const [install, setInstall] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstall(e as InstallEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const standalone = hydrated && (window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
  const ios = hydrated && /iphone|ipad|ipod/i.test(navigator.userAgent);
  const today = list.find((d) => d.id === diaryId(site.id, TODAY));
  const openPunch = punch.filter((x) => x.projectId === site.id && x.status === "open").length;
  const myJobs = wos.filter((w) => (tech ? w.technician === tech : true) && (w.status === "assigned" || w.status === "in_progress" || w.status === "on_hold")).length;

  const tiles = [
    { href: "/m/diary", icon: NotebookPen, label: "รายงานประจำวัน", sub: today ? DIARY_STATUS_LABEL[today.status] : "ยังไม่ได้เขียน", tone: today ? (today.status === "draft" ? "warn" : "pos") : "neg" },
    { href: "/m/clock", icon: Clock, label: "ลงเวลา", sub: "เข้า-ออกงาน", tone: "neutral" },
    { href: "/m/toolbox", icon: HardHat, label: "Toolbox Talk", sub: "ประชุมความปลอดภัย", tone: "neutral" },
    { href: "/m/issue", icon: AlertTriangle, label: "แจ้งปัญหา/แจ้งซ่อม", sub: "ถ่ายรูป ปักหมุด", tone: "neutral" },
    { href: "/m/punch", icon: ListChecks, label: "ตรวจงาน", sub: `ค้างแก้ ${openPunch} รายการ`, tone: openPunch ? "warn" : "neutral" },
    { href: "/m/jobs", icon: Wrench, label: "งานของฉัน", sub: `${myJobs} งานเปิดอยู่`, tone: "neutral" },
  ] as const;

  return (
    <div className="mx-auto min-h-screen max-w-[480px] bg-page pb-16">
      <header className="flex items-center justify-between gap-2 px-4 pb-2 pt-5">
        <div className="min-w-0">
          <p className="text-[13px] text-ink-3">{thDate(TODAY)}</p>
          <h1 className="truncate text-[22px] font-normal leading-tight">สวัสดี {me.name.split(" ")[0]}</h1>
          <p className="text-[13px] text-ink-3">
            {me.roleLabel} · {online ? "ออนไลน์" : "ออฟไลน์ ใช้งานได้ตามปกติ"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SyncBadge />
          <Link href="/" aria-label="เปิดระบบเต็ม" className="inline-flex size-10 items-center justify-center rounded-[10px] border border-line-strong bg-card text-ink-2">
            <LayoutGrid size={18} strokeWidth={1.5} />
          </Link>
        </div>
      </header>

      <main className="flex flex-col gap-4 px-4">
        <section className="rounded-[14px] border border-line bg-card p-4">
          <p className="mb-2 text-[13px] text-ink-3">หน้างานวันนี้</p>
          <SitePicker />
          {site.project && (
            <p className="mt-2 text-[13px] text-ink-2">
              {site.project.phase} · ความคืบหน้า <span className="num font-mono">{site.project.actual}%</span> · PM {site.project.pm}
            </p>
          )}
        </section>

        <div className="grid grid-cols-2 gap-3">
          {tiles.map((t) => (
            <Link key={t.href} href={t.href} className="flex min-h-[116px] flex-col justify-between rounded-[14px] border border-line bg-card p-4 transition-transform active:scale-[0.98]">
              <t.icon size={24} strokeWidth={1.5} className="text-ink-2" />
              <div>
                <p className="text-[15px] font-medium leading-tight">{t.label}</p>
                <p className={cx("mt-1 text-[12px]", t.tone === "neg" ? "text-neg" : t.tone === "warn" ? "text-warn" : t.tone === "pos" ? "text-pos" : "text-ink-3")}>{t.sub}</p>
              </div>
            </Link>
          ))}
        </div>

        {hydrated && !standalone && !installed && (
          <section className="flex items-start gap-3 rounded-[14px] border border-line bg-raised p-4">
            <Download size={20} strokeWidth={1.5} className="mt-0.5 shrink-0 text-ink-2" />
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-medium">ติดตั้งแอปไว้ที่หน้าจอ</p>
              <p className="mt-0.5 text-[13px] text-ink-2">
                {install ? "เปิดได้เร็วจากหน้าจอโฮม ใช้งานได้แม้ไม่มีสัญญาณ" : ios ? "ใน Safari กดปุ่มแชร์ แล้วเลือก “เพิ่มไปยังหน้าจอโฮม”" : "เปิดเมนูของเบราว์เซอร์ แล้วเลือก “ติดตั้งแอป” หรือ “เพิ่มลงในหน้าจอหลัก”"}
              </p>
              {install && (
                <button
                  type="button"
                  onClick={() => {
                    void install.prompt();
                    void install.userChoice.then((c) => {
                      if (c.outcome === "accepted") setInstalled(true);
                      setInstall(null);
                    });
                  }}
                  className="mt-2 inline-flex h-10 items-center rounded-[10px] bg-ink px-4 text-[14px] font-medium text-card"
                >
                  ติดตั้งแอป
                </button>
              )}
            </div>
          </section>
        )}

        <p className="flex items-center gap-2 text-[13px] text-ink-3">
          <ClipboardCheck size={16} strokeWidth={1.5} />
          ข้อมูลบันทึกในเครื่องก่อน แล้วส่งขึ้นระบบเมื่อมีสัญญาณ
        </p>
      </main>
    </div>
  );
}
