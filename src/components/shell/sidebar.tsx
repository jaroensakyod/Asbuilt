"use client";

import { BrandMark } from "@/components/brand";
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
  Ruler,
  Tags,
  ShoppingCart,
  Truck,
  Warehouse,
  PiggyBank,
  BookOpen,
  IdCard,
  Wallet,
  CreditCard,
  Bell,
  Settings,
  ChartGantt,
  FileDiff,
  HardHat,
  Forklift,
  MessageCircleQuestion,
  FileCheck,
  FlaskConical,
  Stamp,
  FolderGit2,
  UsersRound,
  PackageCheck,
  Sofa,
  Palette,
  NotebookPen,
  Smartphone,
  Route,
  ShieldCheck,
  Gavel,
  Landmark,
  Award,
  Tent,
  Coins,
  Layers,
  ScrollText,
  Banknote,
  ChevronDown,
} from "lucide-react";
import { cx, Keycap } from "@/components/ui";
import { COMPANY_INFO } from "@/lib/data";
import { useRepairs } from "@/lib/ops-store";
import { useNotifications, useReadIds } from "@/lib/notifications";
import { useMe } from "@/lib/use-me";
import { canView, moduleOfPath } from "@/lib/permissions";
import { useHydrated } from "@/components/ops/bits";

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
    label: "การขาย & ประมูล",
    items: [
      { href: "/sales", label: "ลูกค้า & ลีด", icon: Handshake },
      { href: "/quotes", label: "ใบเสนอราคา", icon: FileSignature },
      { href: "/estimating", label: "ประเมินราคา & BOQ", icon: Calculator },
      { href: "/takeoff", label: "ถอดปริมาณงาน", icon: Ruler },
      { href: "/prices", label: "ราคาวัสดุตลาด", icon: Tags },
      { href: "/tenders", label: "ประมูลงาน & งานราชการ", icon: Landmark },
    ],
  },
  {
    label: "แผนงาน & สัญญา",
    items: [
      { href: "/schedule", label: "แผนงาน (Gantt)", icon: ChartGantt },
      { href: "/contracts", label: "สัญญา & เบิกงวด", icon: ScrollText },
      { href: "/contracts/variations", label: "งานเปลี่ยนแปลง", icon: FileDiff },
      { href: "/subcontractors", label: "ผู้รับเหมาช่วง", icon: UsersRound },
      { href: "/cashflow", label: "กระแสเงินสดโครงการ", icon: Banknote },
    ],
  },
  {
    label: "หน้างาน",
    items: [
      { href: "/diary", label: "รายงานประจำวัน", icon: NotebookPen },
      { href: "/safety", label: "ความปลอดภัย", icon: HardHat },
      { href: "/plant", label: "เครื่องจักร", icon: Forklift },
      { href: "/m", label: "แอปหน้างาน (มือถือ)", icon: Smartphone },
    ],
  },
  {
    label: "ออกแบบ",
    items: [
      { href: "/design-stages", label: "ขั้นตอนออกแบบ", icon: Layers },
      { href: "/permits", label: "ขออนุญาตก่อสร้าง", icon: Stamp },
      { href: "/specs", label: "รายการประกอบแบบ", icon: FileCheck },
      { href: "/structure", label: "Structure 3D", icon: Box },
      { href: "/blueprint", label: "Blueprint", icon: MapIcon },
      { href: "/cad", label: "CAD Viewer", icon: PencilRuler },
    ],
  },
  {
    label: "วิศวกรรม & คุณภาพ",
    items: [
      { href: "/rfi", label: "RFI (ถาม-ตอบแบบ)", icon: MessageCircleQuestion },
      { href: "/submittals", label: "ส่งอนุมัติวัสดุ", icon: PackageCheck },
      { href: "/quality", label: "คุณภาพ & ผลทดสอบ", icon: FlaskConical },
      { href: "/supervision", label: "ควบคุมงาน & ใบอนุญาต", icon: ShieldCheck },
      { href: "/doc-control", label: "ทะเบียนแบบ & เอกสาร", icon: FolderGit2 },
      { href: "/meetings", label: "ประชุม", icon: Users },
      { href: "/closeout", label: "ส่งมอบงาน", icon: Award },
    ],
  },
  {
    label: "ตกแต่งภายใน",
    items: [
      { href: "/interior", label: "งานตกแต่งภายใน", icon: Sofa },
      { href: "/selections", label: "ลูกค้าเลือกวัสดุ", icon: Palette },
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
    label: "งานปฏิบัติการ & บริการ",
    items: [
      { href: "/inspections", label: "การตรวจสอบ", icon: ClipboardCheck },
      { href: "/repairs", label: "แจ้งซ่อม/ปัญหา", icon: TriangleAlert },
      { href: "/work-orders", label: "ใบสั่งงาน", icon: FileCheck2 },
      { href: "/dispatch", label: "กระดานจ่ายงานช่าง", icon: Route },
      { href: "/maintenance", label: "บำรุงรักษา", icon: CalendarClock },
      { href: "/service-contracts", label: "สัญญาบริการ", icon: Gavel },
      { href: "/warranty", label: "ทะเบียนประกัน", icon: ShieldCheck },
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
      { href: "/hr/crew", label: "ค่าแรงเหมา & เบิกล่วงหน้า", icon: Coins },
      { href: "/hr/skills", label: "ทักษะ & ใบรับรอง", icon: Award },
      { href: "/hr/camps", label: "แคมป์คนงาน", icon: Tent },
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
      { href: "/notifications", label: "การแจ้งเตือน", icon: Bell },
      { href: "/settings", label: "ตั้งค่า", icon: Settings },
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
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    const open = () => { setCollapsed(false); setMobileOpen(v => !v); };
    const escape = (e: KeyboardEvent) => { if (e.key === "Escape") setMobileOpen(false); };
    window.addEventListener("asbuilt:mobile-nav", open);
    window.addEventListener("keydown", escape);
    return () => { window.removeEventListener("asbuilt:mobile-nav", open); window.removeEventListener("keydown", escape); };
  }, []);
  const openRepairs = useRepairs().filter((r) => r.status !== "closed").length;
  const notes = useNotifications();
  const readIds = useReadIds();
  const unreadNotes = notes.filter((n) => !readIds.includes(n.id)).length;
  // counts depend on browser-only state (localStorage read marks, local edits): show them after hydration
  const hydrated = useHydrated();
  const countOf = (it: Item) => (!hydrated ? undefined : it.href === "/repairs" ? openRepairs : it.href === "/notifications" ? unreadNotes : it.count);
  const me = useMe();

  useEffect(() => {
    const saved = window.localStorage.getItem("asbuilt:nav");
    // viewers with a full-height canvas start collapsed, like a drawing app
    const wide = /^\/(structure|cad|blueprint)\/./.test(path);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCollapsed(wide ? true : saved === "1");
  }, [path]);

  // groups folded by the user (expanded automatically when they contain the current page)
  const [folded, setFolded] = useState<string[]>([]);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFolded(JSON.parse(window.localStorage.getItem("asbuilt:navFolded") ?? "[]") as string[]);
    } catch {
      // ignore
    }
  }, []);
  const fold = (label: string) =>
    setFolded((f) => {
      const next = f.includes(label) ? f.filter((x) => x !== label) : [...f, label];
      window.localStorage.setItem("asbuilt:navFolded", JSON.stringify(next));
      return next;
    });

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
    <>
      {mobileOpen && <button type="button" className="mobile-nav-backdrop" aria-label="ปิดเมนูหลัก" onClick={() => setMobileOpen(false)} />}
    <aside data-shell className={cx(mobileOpen && "mobile-open","app-sidebar sticky top-0 z-30 flex h-screen shrink-0 flex-col border-r border-line bg-deep transition-[width] duration-200", collapsed ? "w-[60px]" : "w-[248px]")}>
      <div className={cx("flex h-[82px] items-center gap-3", collapsed ? "justify-center px-0" : "px-5")}>
        <Link href="/" aria-label="หน้าหลัก Asbuilt"><BrandMark className="shrink-0" /></Link>
        {!collapsed && (
          <>
            <span className="sidebar-expanded text-[21px] font-semibold tracking-tight leading-none">Asbuilt<span className="block mt-1.5 text-[9px] font-normal tracking-[.17em] text-ink-3">BUILD WITH CLARITY</span></span>

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
            {collapsed ? (
              <div className="mx-2 mb-2 h-px bg-line" />
            ) : (
              <button
                type="button"
                onClick={() => fold(g.label)}
                aria-expanded={!folded.includes(g.label) || g.items.some(isActive)}
                className="group/h mb-1.5 flex w-full items-center justify-between px-2 text-left text-[12px] text-ink-3 hover:text-ink-2"
              >
                {g.label}
                <ChevronDown size={14} strokeWidth={1.5} className={cx("opacity-0 transition-[transform,opacity] duration-150 group-hover/h:opacity-100", folded.includes(g.label) && !g.items.some(isActive) && "-rotate-90 opacity-100")} />
              </button>
            )}
            <ul className={cx("flex flex-col gap-0.5", !collapsed && folded.includes(g.label) && !g.items.some(isActive) && "hidden")}>
              {g.items.map((it) => {
                const active = isActive(it);
                const Icon = it.icon;
                return (
                  <li key={it.href}>
                    <Link
                      href={it.href}
                      onClick={() => setMobileOpen(false)}
                      title={it.label}
                      aria-label={it.label}
                      aria-current={active ? "page" : undefined}
                      className={cx(
                        "relative flex h-9 items-center gap-2.5 rounded-[8px] transition-colors duration-150",
                        collapsed ? "justify-center" : "px-2",
                        active ? "nav-active" : "text-ink-2 hover:bg-card/60 hover:text-ink",
                      )}
                    >
                      <Icon size={16} strokeWidth={1.5} className={active ? "text-ink" : "text-ink-3"} />
                      {!collapsed && <span className="flex-1 truncate">{it.label}</span>}
                      {countOf(it) ? (
                        collapsed ? (
                          <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-accent" />
                        ) : (
                          <span className="num font-mono text-[12px] text-accent-text">{countOf(it)}</span>
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
        <a href={`tel:${COMPANY_INFO.hotline}`} className="sidebar-expanded mx-3 mb-3 flex items-center gap-2.5 rounded-[10px] border border-line bg-card px-3 py-2.5 transition-colors duration-150 hover:border-line-strong">
          <Phone size={16} strokeWidth={1.5} className="text-ink-3" />
          <span className="text-[13px] text-ink-2">สายด่วนบริการ</span>
          <span className="num ml-auto font-mono text-[13px]">{COMPANY_INFO.hotline}</span>
        </a>
      )}

      <div className={cx("flex items-center border-t border-line py-3", collapsed ? "flex-col gap-2 px-2" : "gap-3 px-4")}>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-card text-[13px] text-ink-2 shadow-[inset_0_0_0_1px_var(--line-strong)]">{me.initials}</span>
        {!collapsed && (
          <div className="sidebar-expanded min-w-0 flex-1 leading-tight">
            <p className="truncate text-[14px]">{me.name}</p>
            <p className="truncate text-[12px] text-ink-3">{me.roleLabel}</p>
          </div>
        )}
        <button type="button" onClick={toggle} aria-label={collapsed ? "ขยายเมนู" : "ย่อเมนู"} className="sidebar-collapse rounded-[6px] p-1.5 text-ink-3 transition-colors duration-150 hover:bg-card hover:text-ink">
          {collapsed ? <PanelLeftOpen size={16} strokeWidth={1.5} /> : <PanelLeftClose size={16} strokeWidth={1.5} />}
        </button>
      </div>
    </aside></>
  );
}
