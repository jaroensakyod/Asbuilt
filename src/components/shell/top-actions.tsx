"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, ChevronDown, Search, LogOut, Settings, UserRound } from "lucide-react";
import { cx, Keycap } from "@/components/ui";
import { openSearch } from "./sidebar";
import { SyncBadge } from "./pwa";
import { useHydrated } from "@/components/ops/bits";
import { useMe } from "@/lib/use-me";
import { signOut, switchCompany } from "@/lib/workspace";
import { setDemoRole } from "@/lib/use-me";
import { ROLE_LABEL, type Role } from "@/lib/data";
import { markRead, useNotifications, useReadIds } from "@/lib/notifications";

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
  const bellRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useOutside(bellRef, () => setBell(false));
  useOutside(menuRef, () => setMenu(false));
  const all = useNotifications();
  const read = useReadIds();
  const list = all.slice(0, 12);
  const me = useMe();
  const hydrated = useHydrated();
  const unread = hydrated ? all.filter((n) => !read.includes(n.id)).length : 0;

  return (
    <div className="flex items-center gap-2">
      <SyncBadge />
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
          {unread > 0 && <span className="num absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 font-mono text-[10px] text-card">{unread > 99 ? "99+" : unread}</span>}
        </button>
        {bell && (
          <div className="enter absolute right-0 top-11 w-[380px] overflow-hidden rounded-[14px] border border-line-strong bg-card shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <p className="font-medium">การแจ้งเตือน{unread > 0 && <span className="ml-2 font-mono text-[12px] text-ink-3">ยังไม่อ่าน {unread}</span>}</p>
              <button type="button" onClick={() => markRead(all.map((n) => n.id))} className="text-[13px] text-ink-2 hover:text-ink">
                อ่านทั้งหมด
              </button>
            </div>
            <ul className="max-h-[420px] overflow-y-auto">
              {list.map((n) => (
                <li key={n.id}>
                  <Link
                    href={n.href}
                    onClick={() => {
                      markRead([n.id]);
                      setBell(false);
                    }}
                    className="flex gap-3 border-t border-line px-4 py-3 transition-colors duration-150 first:border-t-0 hover:bg-raised"
                  >
                    <span className={cx("mt-2 size-1.5 shrink-0 rounded-full", read.includes(n.id) ? "bg-transparent" : n.tone === "neg" ? "bg-neg" : n.tone === "warn" ? "bg-warn" : n.tone === "accent" ? "bg-accent" : "bg-ink-3")} />
                    <span className="min-w-0">
                      <span className="block text-[14px]">{n.title}</span>
                      <span className="block truncate text-[12px] text-ink-3">{n.sub}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            {list.length === 0 && <p className="px-4 py-6 text-center text-[13px] text-ink-3">ไม่มีเรื่องที่ต้องติดตาม</p>}
            <Link href="/notifications" onClick={() => setBell(false)} className="flex h-10 items-center justify-center border-t border-line text-[13px] text-ink-2 transition-colors duration-150 hover:bg-raised hover:text-ink">
              ดูทั้งหมด {all.length} เรื่อง
            </Link>
          </div>
        )}
      </div>

      <div ref={menuRef} className="relative">
        <button type="button" onClick={() => setMenu((v) => !v)} className="flex h-9 items-center gap-2 rounded-[8px] pl-1 pr-2 transition-colors duration-150 hover:bg-raised" aria-expanded={menu}>
          <span className="flex size-7 items-center justify-center rounded-full bg-raised text-[12px] text-ink-2">{me.initials}</span>
          <span className="hidden max-w-[140px] truncate text-[14px] xl:inline">{me.name.split(" ")[0]}</span>
          <ChevronDown size={14} strokeWidth={1.5} className="text-ink-3" />
        </button>
        {menu && (
          <div className="enter absolute right-0 top-11 w-[240px] overflow-hidden rounded-[12px] border border-line-strong bg-card p-1 shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
            <div className="px-3 py-2.5">
              <p className="truncate">{me.name}</p>
              <p className="truncate text-[12px] text-ink-3">
                {me.roleLabel} · {me.email}
              </p>
              <p className="mt-1 truncate text-[12px] text-ink-2">{me.company}</p>
            </div>
            {!me.live && (
              <>
                <div className="my-1 h-px bg-line" />
                <label className="flex items-center justify-between gap-2 px-3 py-2 text-[12px] text-ink-3">
                  ดูในบทบาท (เดโม)
                  <select
                    value={me.role}
                    onChange={(e) => setDemoRole(e.target.value as Role)}
                    className="h-8 rounded-[6px] border border-line-strong bg-card px-2 text-[13px] text-ink"
                  >
                    {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
            {me.companies.length > 1 && (
              <>
                <div className="my-1 h-px bg-line" />
                <p className="px-3 pb-1 pt-1.5 text-[12px] text-ink-3">สลับบริษัท</p>
                {me.companies.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setMenu(false);
                      if (c.id !== me.companyId) void switchCompany(c.id);
                    }}
                    className="flex h-9 w-full items-center justify-between gap-2 rounded-[8px] px-3 text-left text-ink-2 transition-colors duration-150 hover:bg-raised hover:text-ink"
                  >
                    <span className="truncate">{c.name}</span>
                    {c.id === me.companyId && <span className="size-1.5 rounded-full bg-accent" />}
                  </button>
                ))}
              </>
            )}
            <div className="my-1 h-px bg-line" />
            {[
              { icon: UserRound, label: "โปรไฟล์ของฉัน", href: "/team" },
              { icon: Settings, label: "ตั้งค่า", href: "/settings" },
            ].map((m) => (
              <Link key={m.label} href={m.href} onClick={() => setMenu(false)} className="flex h-9 items-center gap-2.5 rounded-[8px] px-3 text-ink-2 transition-colors duration-150 hover:bg-raised hover:text-ink">
                <m.icon size={16} strokeWidth={1.5} />
                {m.label}
              </Link>
            ))}
            <button
              type="button"
              onClick={() => (me.live ? void signOut() : setMenu(false))}
              title={me.live ? undefined : "โหมดเดโมไม่มีการล็อกอิน"}
              className="flex h-9 w-full items-center gap-2.5 rounded-[8px] px-3 text-ink-2 transition-colors duration-150 hover:bg-raised hover:text-ink"
            >
              <LogOut size={16} strokeWidth={1.5} />
              ออกจากระบบ
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
