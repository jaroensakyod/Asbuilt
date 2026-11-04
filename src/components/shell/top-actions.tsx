"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, ChevronDown, Search, LogOut, Settings, UserRound } from "lucide-react";
import { cx, Keycap } from "@/components/ui";
import { openSearch } from "./sidebar";
import { TODAY, getProject, slaText } from "@/lib/data";
import { useInspections, useMaintenance, useRepairs, maintState } from "@/lib/ops-store";

type Note = { id: string; title: string; sub: string; href: string; tone: "neg" | "accent" | "neutral" };

function useNotes(): Note[] {
  const repairs = useRepairs();
  const inspections = useInspections();
  const maintenance = useMaintenance();
  const out: Note[] = [];
  for (const r of repairs.filter((x) => x.status !== "closed" && x.slaHours < 0))
    out.push({ id: r.id, title: `แจ้งซ่อมเกิน SLA · ${r.title}`, sub: `${r.asset} · ${getProject(r.projectId)?.name ?? r.projectId} · ${slaText(r.slaHours)}`, href: `/repairs?q=${r.id}`, tone: "neg" });
  for (const i of inspections.filter((x) => x.date === TODAY && x.result === "scheduled"))
    out.push({ id: i.id, title: `นัดตรวจวันนี้ ${i.time} น.`, sub: `${i.title} · ${i.inspector}`, href: `/inspections/${i.id}`, tone: "accent" });
  for (const m of maintenance.filter((x) => maintState(x) === "overdue").slice(0, 3))
    out.push({ id: m.id, title: `บำรุงรักษาเลยกำหนด · ${m.task}`, sub: `${m.owner} · ${m.projectId}`, href: "/maintenance", tone: "neutral" });
  return out;
}

function useOutside(ref: React.RefObject<HTMLElement | null>, close: () => void) {
  useEffect(() => {
    const on = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", on);
    return () => document.removeEventListener("mousedown", on);
  }, [ref, close]);
}

export function TopActions() {
  const [bell, setBell] = useState(false);
  const [menu, setMenu] = useState(false);
  const [read, setRead] = useState<string[]>([]);
  const bellRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useOutside(bellRef, () => setBell(false));
  useOutside(menuRef, () => setMenu(false));
  const list = useNotes();
  const unread = list.filter((n) => !read.includes(n.id)).length;

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={openSearch}
        className="hidden h-9 w-[300px] items-center gap-2 rounded-[8px] border border-line bg-card px-3 text-ink-3 transition-colors duration-150 hover:border-line-strong lg:flex"
      >
        <Search size={16} strokeWidth={1.5} />
        <span className="flex-1 text-left">ค้นหาโครงการ แจ้งซ่อม รหัสอุปกรณ์</span>
        <Keycap>Ctrl K</Keycap>
      </button>

      <div ref={bellRef} className="relative">
        <button
          type="button"
          onClick={() => setBell((v) => !v)}
          className="relative rounded-[8px] p-2 text-ink-2 transition-colors duration-150 hover:bg-raised hover:text-ink"
          aria-label={`การแจ้งเตือน ${unread} รายการ`}
          aria-expanded={bell}
        >
          <Bell size={18} strokeWidth={1.5} />
          {unread > 0 && <span className="num absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 font-mono text-[10px] text-card">{unread}</span>}
        </button>
        {bell && (
          <div className="enter absolute right-0 top-11 w-[380px] overflow-hidden rounded-[14px] border border-line-strong bg-card shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <p className="font-medium">การแจ้งเตือน</p>
              <button type="button" onClick={() => setRead(list.map((n) => n.id))} className="text-[13px] text-ink-2 hover:text-ink">
                อ่านทั้งหมด
              </button>
            </div>
            <ul className="max-h-[420px] overflow-y-auto">
              {list.map((n) => (
                <li key={n.id}>
                  <Link
                    href={n.href}
                    onClick={() => {
                      setRead((r) => [...r, n.id]);
                      setBell(false);
                    }}
                    className="flex gap-3 border-t border-line px-4 py-3 transition-colors duration-150 first:border-t-0 hover:bg-raised"
                  >
                    <span className={cx("mt-2 size-1.5 shrink-0 rounded-full", read.includes(n.id) ? "bg-transparent" : n.tone === "neg" ? "bg-neg" : n.tone === "accent" ? "bg-accent" : "bg-ink-3")} />
                    <span className="min-w-0">
                      <span className="block text-[14px]">{n.title}</span>
                      <span className="block truncate text-[12px] text-ink-3">{n.sub}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div ref={menuRef} className="relative">
        <button type="button" onClick={() => setMenu((v) => !v)} className="flex h-9 items-center gap-2 rounded-[8px] pl-1 pr-2 transition-colors duration-150 hover:bg-raised" aria-expanded={menu}>
          <span className="flex size-7 items-center justify-center rounded-full bg-raised text-[12px] text-ink-2">ศพ</span>
          <span className="hidden text-[14px] xl:inline">ศิริพร</span>
          <ChevronDown size={14} strokeWidth={1.5} className="text-ink-3" />
        </button>
        {menu && (
          <div className="enter absolute right-0 top-11 w-[240px] overflow-hidden rounded-[12px] border border-line-strong bg-card p-1 shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
            <div className="px-3 py-2.5">
              <p>ศิริพร ตั้งเจริญ</p>
              <p className="text-[12px] text-ink-3">ผู้จัดการโครงการ · siriporn@example.co.th</p>
            </div>
            <div className="my-1 h-px bg-line" />
            {[
              { icon: UserRound, label: "โปรไฟล์ของฉัน", href: "/team" },
              { icon: Settings, label: "ตั้งค่าบริษัท", href: "/team" },
            ].map((m) => (
              <Link key={m.label} href={m.href} onClick={() => setMenu(false)} className="flex h-9 items-center gap-2.5 rounded-[8px] px-3 text-ink-2 transition-colors duration-150 hover:bg-raised hover:text-ink">
                <m.icon size={16} strokeWidth={1.5} />
                {m.label}
              </Link>
            ))}
            <button type="button" className="flex h-9 w-full items-center gap-2.5 rounded-[8px] px-3 text-ink-2 transition-colors duration-150 hover:bg-raised hover:text-ink">
              <LogOut size={16} strokeWidth={1.5} />
              ออกจากระบบ
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
