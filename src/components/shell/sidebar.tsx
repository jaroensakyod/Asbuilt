"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  Building2,
  Home,
  Box,
  Map as MapIcon,
  PencilRuler,
  Zap,
  Droplet,
  Snowflake,
  Package,
  ClipboardCheck,
  TriangleAlert,
  FileCheck2,
  CalendarClock,
  BarChart3,
  FileText,
  Users,
  Search,
  Phone,
  PanelLeftClose,
  PanelLeftOpen,
  Gauge,
  Handshake,
  FileSignature,
  Calculator,
  Tags,
  ShoppingCart,
  Truck,
  Warehouse,
  PiggyBank,
  BookOpen,
  IdCard,
  Wallet,
  CreditCard,
} from "lucide-react";
import { cx, Keycap } from "@/components/ui";
import { COMPANY_INFO } from "@/lib/data";
import { useRepairs } from "@/lib/ops-store";
import { useMe } from "@/lib/use-me";
import { canView, moduleOfPath } from "@/lib/permissions";

type Item = { href: string; label: string; icon: typeof LayoutGrid; count?: number; exact?: boolean };

export const NAV: { label: string; items: Item[] }[] = [
  {
    label: "ภาพรวม",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutGrid, exact: true },
      { href: "/executive", label: "ผู้บริหาร", icon: Gauge },
      { href: "/projects", label: "โครงการ", icon: Building2 },
      { href: "/models", label: "แบบบ้าน", icon: Home },
    ],
  },
  {
    label: "การขาย",
    items: [
      { href: "/sales", label: "ลูกค้า & ลีด", icon: Handshake },
      { href: "/quotes", label: "ใบเสนอราคา", icon: FileSignature },
      { href: "/estimating", label: "ประเมินราคา & BOQ", icon: Calculator },
      { href: "/prices", label: "ราคาวัสดุตลาด", icon: Tags },
    ],
  },
  {
    label: "ดูแบบ",
    items: [
      { href: "/structure", label: "Structure 3D", icon: Box },
      { href: "/blueprint", label: "Blueprint", icon: MapIcon },
      { href: "/cad", label: "CAD Viewer", icon: PencilRuler },
    ],
  },
  {
    label: "งานระบบ & อุปกรณ์",
    items: [
      { href: "/systems/elec", label: "ไฟฟ้า", icon: Zap },
      { href: "/systems/plumb", label: "ประปา & สุขภัณฑ์", icon: Droplet },
      { href: "/systems/hvac", label: "ปรับอากาศ", icon: Snowflake },
      { href: "/assets", label: "อุปกรณ์อาคาร", icon: Package },
    ],
  },
  {
    label: "งานปฏิบัติการ",
    items: [
      { href: "/inspections", label: "การตรวจสอบ", icon: ClipboardCheck },
      { href: "/repairs", label: "แจ้งซ่อม/ปัญหา", icon: TriangleAlert },
      { href: "/work-orders", label: "ใบสั่งงาน", icon: FileCheck2 },
      { href: "/maintenance", label: "บำรุงรักษา", icon: CalendarClock },
    ],
  },
  {
    label: "จัดซื้อ & ต้นทุน",
    items: [
      { href: "/purchasing", label: "จัดซื้อ (PR/PO)", icon: ShoppingCart },
      { href: "/suppliers", label: "ซัพพลายเออร์", icon: Truck },
      { href: "/inventory", label: "คลังวัสดุ", icon: Warehouse },
      { href: "/costs", label: "ต้นทุนโครงการ", icon: PiggyBank },
    ],
  },
  {
    label: "บัญชี & บุคคล",
    items: [
      { href: "/accounting", label: "บัญชี & ภาษี", icon: BookOpen },
      { href: "/hr", label: "พนักงาน", icon: IdCard },
      { href: "/hr/attendance", label: "ลงเวลา & การลา", icon: CalendarClock },
      { href: "/hr/payroll", label: "เงินเดือน & ค่าแรง", icon: Wallet },
    ],
  },
  {
    label: "ข้อมูล",
    items: [
      { href: "/reports", label: "รายงาน", icon: BarChart3 },
      { href: "/documents", label: "เอกสาร", icon: FileText },
    ],
  },
  {
    label: "ผู้ดูแลระบบ",
    items: [
      { href: "/team", label: "ผู้ใช้/ทีมงาน", icon: Users },
      { href: "/billing", label: "แพ็กเกจ & การชำระเงิน", icon: CreditCard },
    ],
  },
];

export function openSearch() {
  window.dispatchEvent(new Event("asbuilt:search"));
}

export function Sidebar() {
  const path = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const openRepairs = useRepairs().filter((r) => r.status !== "closed").length;
  const me = useMe();

  useEffect(() => {
    const saved = window.localStorage.getItem("asbuilt:nav");
    // viewers with a full-height canvas start collapsed, like a drawing app
    const wide = /^\/(structure|cad|blueprint)\/./.test(path);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCollapsed(wide ? true : saved === "1");
  }, [path]);

  const toggle = () => {
    setCollapsed((v) => {
      window.localStorage.setItem("asbuilt:nav", v ? "0" : "1");
      return !v;
    });
  };

  const isActive = (it: Item) => {
    if (it.exact) return path === it.href;
    const hit = path === it.href || path.startsWith(it.href + "/");
    // a more specific sibling (e.g. /hr/payroll under /hr) wins
    return hit && !NAV.some((g) => g.items.some((o) => o.href !== it.href && o.href.startsWith(it.href + "/") && (path === o.href || path.startsWith(o.href + "/"))));
  };

  return (
    <aside data-shell className={cx("sticky top-0 z-30 flex h-screen shrink-0 flex-col border-r border-line bg-deep transition-[width] duration-200", collapsed ? "w-[60px]" : "w-[248px]")}>
      <div className={cx("flex h-14 items-center gap-2.5", collapsed ? "justify-center px-0" : "px-5")}>
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden className="shrink-0">
          <path d="M2 9.5 10 3l8 6.5V17H2z" fill="none" stroke="var(--text)" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M7 17v-5h6v5" fill="none" stroke="var(--accent)" strokeWidth="1.5" />
        </svg>
        {!collapsed && (
          <>
            <span className="text-[17px] font-medium leading-none">Asbuilt</span>
            <span className="text-[13px] leading-none text-ink-3">แฟ้มบ้าน</span>
          </>
        )}
      </div>

      <div className={cx("pb-1", collapsed ? "px-2" : "px-3")}>
        <button
          type="button"
          onClick={openSearch}
          aria-label="ค้นหา"
          className={cx(
            "flex h-9 w-full items-center gap-2 rounded-[8px] border border-line bg-card text-ink-3 transition-colors duration-150 hover:border-line-strong",
            collapsed ? "justify-center" : "px-3",
          )}
        >
          <Search size={16} strokeWidth={1.5} />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">ค้นหา</span>
              <Keycap>Ctrl</Keycap>
              <Keycap>K</Keycap>
            </>
          )}
        </button>
      </div>

      <nav className={cx("flex-1 overflow-y-auto pb-4", collapsed ? "px-2" : "px-3")}>
        {NAV.map((g) => ({ ...g, items: g.items.filter((it) => { const m = moduleOfPath(it.href); return !m || canView(me.role, m); }) })).filter((g) => g.items.length).map((g) => (
          <div key={g.label} className="mt-4">
            {collapsed ? <div className="mx-2 mb-2 h-px bg-line" /> : <p className="mb-1.5 px-2 text-[12px] text-ink-3">{g.label}</p>}
            <ul className="flex flex-col gap-0.5">
              {g.items.map((it) => {
                const active = isActive(it);
                const Icon = it.icon;
                return (
                  <li key={it.href}>
                    <Link
                      href={it.href}
                      title={collapsed ? it.label : undefined}
                      className={cx(
                        "relative flex h-9 items-center gap-2.5 rounded-[8px] transition-colors duration-150",
                        collapsed ? "justify-center" : "px-2",
                        active ? "bg-card text-ink shadow-[inset_0_0_0_1px_var(--line-strong)]" : "text-ink-2 hover:bg-card/60 hover:text-ink",
                      )}
                    >
                      <Icon size={16} strokeWidth={1.5} className={active ? "text-ink" : "text-ink-3"} />
                      {!collapsed && <span className="flex-1 truncate">{it.label}</span>}
                      {(it.href === "/repairs" ? openRepairs : it.count) ? (
                        collapsed ? (
                          <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-accent" />
                        ) : (
                          <span className="num font-mono text-[12px] text-accent-text">{it.href === "/repairs" ? openRepairs : it.count}</span>
                        )
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {!collapsed && (
        <a href={`tel:${COMPANY_INFO.hotline}`} className="mx-3 mb-3 flex items-center gap-2.5 rounded-[10px] border border-line bg-card px-3 py-2.5 transition-colors duration-150 hover:border-line-strong">
          <Phone size={16} strokeWidth={1.5} className="text-ink-3" />
          <span className="text-[13px] text-ink-2">สายด่วนบริการ</span>
          <span className="num ml-auto font-mono text-[13px]">{COMPANY_INFO.hotline}</span>
        </a>
      )}

      <div className={cx("flex items-center border-t border-line py-3", collapsed ? "flex-col gap-2 px-2" : "gap-3 px-4")}>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-card text-[13px] text-ink-2 shadow-[inset_0_0_0_1px_var(--line-strong)]">{me.initials}</span>
        {!collapsed && (
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-[14px]">{me.name}</p>
            <p className="truncate text-[12px] text-ink-3">{me.roleLabel}</p>
          </div>
        )}
        <button type="button" onClick={toggle} aria-label={collapsed ? "ขยายเมนู" : "ย่อเมนู"} className="rounded-[6px] p-1.5 text-ink-3 transition-colors duration-150 hover:bg-card hover:text-ink">
          {collapsed ? <PanelLeftOpen size={16} strokeWidth={1.5} /> : <PanelLeftClose size={16} strokeWidth={1.5} />}
        </button>
      </div>
    </aside>
  );
}
