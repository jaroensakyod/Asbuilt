"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, CalendarCheck, CreditCard, Tags, Users, Wallet } from "lucide-react";
import { Page } from "@/components/shell/topbar";
import { Card, CardHead, PageHeader, cx, inputCls } from "@/components/ui";
import { Btn, I } from "@/components/ops/bits";
import { CompanyInfoCard } from "@/app/team/company-card";
import { SampleDataCard } from "@/app/team/sample-data-card";
import { CAT_META, CATS, NOTIFY_DEFAULTS, saveNotifySettings, useNotifySettings, type NoteCat, type NotifySettings } from "@/lib/notifications";
import { canView, type ModuleKey } from "@/lib/permissions";
import { useMe } from "@/lib/use-me";

const SECTIONS = [
  { id: "company", label: "ข้อมูลบริษัท" },
  { id: "notify", label: "การแจ้งเตือน" },
  { id: "modules", label: "ตั้งค่าแต่ละระบบ" },
  { id: "data", label: "ข้อมูลตัวอย่าง" },
];

/** Lead-time inputs: which category they belong to and what they control. */
const LEADS: { key: keyof NotifySettings; cat: NoteCat; label: string }[] = [
  { key: "maintDays", cat: "maintenance", label: "เตือนก่อนรอบบำรุงรักษา" },
  { key: "warrantyDays", cat: "warranty", label: "เตือนก่อนประกันบ้านหมด" },
  { key: "billDays", cat: "payables", label: "เตือนก่อนบิลผู้ขายครบกำหนด" },
  { key: "installmentDays", cat: "receivables", label: "เตือนก่อนงวดเงินลูกค้าครบกำหนด" },
  { key: "quoteDays", cat: "sales", label: "เตือนก่อนใบเสนอราคาหมดอายุ" },
  { key: "permitDays", cat: "hr", label: "เตือนก่อนใบอนุญาตทำงานหมด" },
];

const MODULE_LINKS: { href: string; label: string; sub: string; icon: typeof Users; module: ModuleKey }[] = [
  { href: "/team", label: "ผู้ใช้ บทบาท และสิทธิ์", sub: "เชิญทีมงาน กำหนดบทบาท ดูตารางสิทธิ์ต่อโมดูล", icon: Users, module: "admin" },
  { href: "/accounting/accounts", label: "ผังบัญชี", sub: "รหัสบัญชีและหมวดที่ใช้ลงบัญชีอัตโนมัติ", icon: BookOpen, module: "accounting" },
  { href: "/accounting/close", label: "ปิดงวดบัญชี", sub: "ล็อกงวดที่ปิดแล้วไม่ให้แก้เอกสารย้อนหลัง", icon: CalendarCheck, module: "accounting" },
  { href: "/hr/payroll", label: "เงินเดือนและประกันสังคม", sub: "อัตราและเพดานประกันสังคม วันจ่ายเงินเดือน (ปุ่มตั้งค่าในหน้าเงินเดือน)", icon: Wallet, module: "hr" },
  { href: "/prices", label: "แหล่งราคาวัสดุ", sub: "นำเข้าราคาจาก 4 แหล่ง และเลือกแหล่งที่ใช้ประเมินราคา", icon: Tags, module: "costs" },
  { href: "/billing", label: "แพ็กเกจและที่นั่ง", sub: "แพ็กเกจที่ใช้ จำนวนผู้ใช้ และการต่ออายุ", icon: CreditCard, module: "admin" },
];

function Toggle({ on, onChange, label }: { on: boolean; onChange: () => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onChange} className={cx("relative h-5 w-8 shrink-0 rounded-full transition-colors duration-150", on ? "bg-ink" : "bg-line-strong")}>
      <span className={cx("absolute top-0.5 size-4 rounded-full bg-card transition-transform duration-150", on ? "translate-x-3.5" : "translate-x-0.5")} />
    </button>
  );
}

function NotifyCard() {
  const saved = useNotifySettings();
  const [draft, setDraft] = useState<NotifySettings | null>(null);
  const s = draft ?? saved;
  const dirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(saved);
  const set = (patch: Partial<NotifySettings>) => setDraft({ ...s, ...patch });
  const toggleCat = (c: NoteCat) => set({ off: s.off.includes(c) ? s.off.filter((x) => x !== c) : [...s.off, c] });

  return (
    <Card>
      <CardHead title="การแจ้งเตือน" meta="ใช้กับกระดิ่งและหน้าการแจ้งเตือน" />
      <div className="grid grid-cols-1 gap-x-8 px-5 py-4 lg:grid-cols-2">
        <div>
          <p className="pb-2 text-[13px] text-ink-3">หมวดที่แจ้งเตือน</p>
          <ul className="divide-y divide-line">
            {CATS.map((c) => (
              <li key={c} className="flex items-center justify-between gap-4 py-2.5">
                <span className="min-w-0">
                  <span className="block text-[14px]">{CAT_META[c].label}</span>
                  <span className="block text-[12px] text-ink-3">{CAT_META[c].hint}</span>
                </span>
                <Toggle on={!s.off.includes(c)} onChange={() => toggleCat(c)} label={`แจ้งเตือน${CAT_META[c].label}`} />
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="pb-2 pt-4 text-[13px] text-ink-3 lg:pt-0">ระยะเวลาเตือนล่วงหน้า</p>
          <ul className="divide-y divide-line">
            {LEADS.map((l) => {
              const off = s.off.includes(l.cat);
              return (
                <li key={l.key} className={cx("flex items-center justify-between gap-4 py-2.5", off && "opacity-50")}>
                  <label htmlFor={`lead-${l.key}`} className="text-[14px]">
                    {l.label}
                  </label>
                  <span className="flex items-center gap-2 text-[13px] text-ink-3">
                    <input
                      id={`lead-${l.key}`}
                      type="number"
                      min={0}
                      max={365}
                      disabled={off}
                      value={s[l.key] as number}
                      onChange={(e) => set({ [l.key]: Math.max(0, Math.min(365, Number(e.target.value) || 0)) })}
                      className={cx(inputCls, "num w-20 text-right font-mono")}
                    />
                    วัน
                  </span>
                </li>
              );
            })}
          </ul>

          <p className="pb-2 pt-5 text-[13px] text-ink-3">ช่องทาง</p>
          <ul className="divide-y divide-line">
            <li className="flex items-center justify-between gap-4 py-2.5">
              <span>
                <span className="block text-[14px]">ในระบบ (กระดิ่งมุมขวาบน)</span>
                <span className="block text-[12px] text-ink-3">ปิดไม่ได้ ใช้หมวดด้านซ้ายเลือกเรื่องที่ต้องการแทน</span>
              </span>
              <span className="text-[12px] text-ink-3">เปิดอยู่</span>
            </li>
            <li className="flex items-center justify-between gap-4 py-2.5">
              <span>
                <span className="block text-[14px]">สรุปทางอีเมลทุกเช้า</span>
                <span className="block text-[12px] text-ink-3">ส่งจริงเมื่อเปิดใช้ระบบล็อกอินและอีเมลของบริษัท</span>
              </span>
              <Toggle on={s.emailDigest} onChange={() => set({ emailDigest: !s.emailDigest })} label="สรุปทางอีเมล" />
            </li>
            <li className="flex items-center justify-between gap-4 py-2.5 opacity-50">
              <span>
                <span className="block text-[14px]">LINE Official Account</span>
                <span className="block text-[12px] text-ink-3">ยังไม่เปิดใช้งาน</span>
              </span>
              <span className="text-[12px] text-ink-3">เร็ว ๆ นี้</span>
            </li>
          </ul>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3">
        <p className="text-[12px] text-ink-3">{dirty ? "มีการแก้ไขที่ยังไม่บันทึก" : "การตั้งค่านี้ใช้กับทุกคนในบริษัท"}</p>
        <div className="flex gap-2">
          <Btn small disabled={JSON.stringify(s) === JSON.stringify(NOTIFY_DEFAULTS)} onClick={() => setDraft({ ...NOTIFY_DEFAULTS })}>
            ค่าเริ่มต้น
          </Btn>
          <Btn small primary disabled={!dirty} onClick={() => (saveNotifySettings(s), setDraft(null))}>
            บันทึก
          </Btn>
        </div>
      </div>
    </Card>
  );
}

export function SettingsView() {
  const me = useMe();
  const links = MODULE_LINKS.filter((l) => canView(me.role, l.module));
  return (
    <Page trail={[{ label: "ผู้ดูแลระบบ" }, { label: "ตั้งค่า" }]}>
      <PageHeader title="ตั้งค่า" sub="ข้อมูลบริษัทที่ใช้บนหัวเอกสาร การแจ้งเตือน และทางลัดไปยังการตั้งค่าของแต่ละระบบ" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
        <nav aria-label="หัวข้อการตั้งค่า" className="h-fit lg:sticky lg:top-20">
          <ul className="flex flex-wrap gap-1 lg:flex-col">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="flex h-9 items-center rounded-[8px] px-3 text-[14px] text-ink-2 transition-colors duration-150 hover:bg-raised hover:text-ink">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex min-w-0 flex-col gap-6">
          <section id="company" className="scroll-mt-20">
            <CompanyInfoCard />
          </section>
          <section id="notify" className="scroll-mt-20">
            <NotifyCard />
          </section>
          <section id="modules" className="scroll-mt-20">
            <Card>
              <CardHead title="ตั้งค่าแต่ละระบบ" meta={`${links.length} รายการ`} />
              <ul className="grid grid-cols-1 gap-px overflow-hidden rounded-b-[14px] bg-line md:grid-cols-2">
                {links.map((l) => (
                  <li key={l.href} className="bg-card">
                    <Link href={l.href} className="group flex items-start gap-3 px-5 py-4 transition-colors duration-150 hover:bg-raised">
                      <l.icon {...I} className="mt-0.5 shrink-0 text-ink-3" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px]">{l.label}</span>
                        <span className="block text-[12px] text-ink-3">{l.sub}</span>
                      </span>
                      <ArrowRight {...I} className="mt-0.5 shrink-0 text-ink-3 transition-transform duration-150 group-hover:translate-x-0.5" />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          </section>
          <section id="data" className="scroll-mt-20">
            <SampleDataCard />
          </section>
        </div>
      </div>
    </Page>
  );
}
