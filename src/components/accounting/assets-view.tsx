"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Card, CardHead, cx, inputCls } from "@/components/ui";
import { ASSET_CLASSES, accumulatedAt, depreciationSchedule } from "@/lib/accounting/assets";
import { accountName } from "@/lib/accounting/coa";
import { BOOKS_START, fmt, periodLabel, periodOf, r2, thDateSlash } from "@/lib/accounting/money";
import { ACC_TODAY, assetsCol, isLockedDate, LOCKED_MSG, useAccess, useBooks } from "@/lib/accounting/store";
import type { FixedAsset } from "@/lib/accounting/types";
import { Btn, CsvButton, Empty, I, Labeled, Modal, Num, numInput, Pill, tableCls, td, tdR, th, thR, Toolbar } from "./bits";

export function AssetsView() {
  const { accounts, projects, locks } = useBooks();
  const list = assetsCol.use();
  const { edit } = useAccess();
  const [sel, setSel] = useState<string | null>(null);
  const [form, setForm] = useState<FixedAsset | "new" | null>(null);
  const period = periodOf(ACC_TODAY);
  const rows = useMemo(
    () =>
      [...list]
        .sort((a, b) => a.account.localeCompare(b.account) || a.id.localeCompare(b.id))
        .map((a) => {
          const sch = depreciationSchedule(a);
          const accum = accumulatedAt(a, period);
          const thisYear = sch.filter((r) => r.period.startsWith(period.slice(0, 4)) && r.period <= period).reduce((s, r) => s + r.amount, 0);
          return { a, accum, nbv: r2(a.cost - accum), thisYear: r2(thisYear), monthly: sch.find((r) => r.period === period)?.amount ?? 0 };
        }),
    [list, period],
  );
  const selected = list.find((a) => a.id === sel);
  const schedule = selected ? depreciationSchedule(selected) : [];

  return (
    <div className="flex flex-col gap-5">
      <Toolbar>
        <div className="ml-auto flex gap-2">
          <CsvButton
            name={`fixed-assets-${ACC_TODAY}`}
            rows={() => [["รหัส", "รายการ", "บัญชี", "วันที่เริ่มใช้", "ราคาทุน", "ซาก", "อายุ (ปี)", "ค่าเสื่อมสะสม", "มูลค่าสุทธิ", "ค่าเสื่อมปีนี้", "จำหน่าย"], ...rows.map((r) => [r.a.id, r.a.name, r.a.account, r.a.startDate, r.a.cost, r.a.salvage, r.a.lifeYears, r.accum, r.nbv, r.thisYear, r.a.disposedDate ?? ""])]}
          />
          {edit && (
            <Btn small primary onClick={() => setForm("new")}>
              <Plus {...I} />
              เพิ่มสินทรัพย์
            </Btn>
          )}
        </div>
      </Toolbar>
      <Card>
        <CardHead title="ทะเบียนสินทรัพย์ถาวร" meta={`${list.length} รายการ · ค่าเสื่อมราคาวิธีเส้นตรง`} />
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className={tableCls}>
              <thead>
                <tr>
                  <th className={th}>รหัส</th>
                  <th className={th}>รายการ</th>
                  <th className={th}>เริ่มใช้</th>
                  <th className={thR}>อายุ</th>
                  <th className={thR}>ราคาทุน</th>
                  <th className={thR}>ค่าเสื่อม/เดือน</th>
                  <th className={thR}>ค่าเสื่อมปีนี้</th>
                  <th className={thR}>ค่าเสื่อมสะสม</th>
                  <th className={thR}>มูลค่าสุทธิ</th>
                  <th className={th} />
                </tr>
              </thead>
              <tbody>
                {rows.map(({ a, accum, nbv, thisYear, monthly }) => (
                  <tr key={a.id} className={cx("cursor-pointer hover:bg-raised/40", sel === a.id && "bg-raised/60")} onClick={() => setSel(a.id === sel ? null : a.id)}>
                    <td className={td}>
                      <span className="font-mono">{a.id}</span>
                    </td>
                    <td className={td}>
                      {a.name}
                      <span className="block text-[12px] text-ink-3">
                        {a.account} {accountName(accounts, a.account)}
                        {a.site ? " · ใช้หน้างาน" : ""}
                      </span>
                    </td>
                    <td className={td}>
                      <span className="num font-mono">{thDateSlash(a.startDate)}</span>
                    </td>
                    <td className={tdR}>{a.lifeYears ? `${a.lifeYears} ปี` : "ไม่คิด"}</td>
                    <td className={tdR}>
                      <Num v={a.cost} />
                    </td>
                    <td className={tdR}>
                      <Num v={monthly} acc />
                    </td>
                    <td className={tdR}>
                      <Num v={thisYear} acc />
                    </td>
                    <td className={tdR}>
                      <Num v={accum} acc />
                    </td>
                    <td className={tdR}>
                      <Num v={nbv} strong />
                    </td>
                    <td className={td}>{a.disposedDate ? <Pill>จำหน่าย {thDateSlash(a.disposedDate)}</Pill> : nbv <= a.salvage && a.lifeYears ? <Pill tone="neutral">ตัดค่าเสื่อมครบ</Pill> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>ยังไม่มีสินทรัพย์</Empty>
        )}
      </Card>

      {selected && (
        <Card>
          <CardHead
            title={`ตารางค่าเสื่อมราคา · ${selected.name}`}
            meta={`${schedule.length} เดือน`}
            action={
              <div className="flex gap-2">
                <CsvButton name={`depreciation-${selected.id}`} rows={() => [["งวด", "ค่าเสื่อมราคา", "ค่าเสื่อมสะสม", "มูลค่าสุทธิ"], ...schedule.map((r) => [r.period, r.amount, r.accum, r.nbv])]} />
                {edit && (
                  <Btn small onClick={() => setForm(selected)}>
                    แก้ไข / จำหน่าย
                  </Btn>
                )}
              </div>
            }
          />
          <div className="max-h-[420px] overflow-y-auto">
            <table className={tableCls}>
              <thead>
                <tr>
                  <th className={th}>งวด</th>
                  <th className={thR}>ค่าเสื่อมราคา</th>
                  <th className={thR}>ค่าเสื่อมสะสม</th>
                  <th className={thR}>มูลค่าสุทธิ</th>
                  <th className={th} />
                </tr>
              </thead>
              <tbody>
                {schedule.map((r) => (
                  <tr key={r.period}>
                    <td className={td}>{periodLabel(r.period)}</td>
                    <td className={tdR}>
                      <Num v={r.amount} />
                    </td>
                    <td className={tdR}>
                      <Num v={r.accum} />
                    </td>
                    <td className={tdR}>
                      <Num v={r.nbv} />
                    </td>
                    <td className={td}>{r.period < periodOf(BOOKS_START) ? <span className="text-[12px] text-ink-3">ในยอดยกมา</span> : r.period > period ? <span className="text-[12px] text-ink-3">ประมาณการ</span> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {form && <AssetForm initial={form === "new" ? undefined : form} onClose={() => setForm(null)} locks={locks} projects={projects} />}
    </div>
  );
}

function AssetForm({ initial, onClose, locks, projects }: { initial?: FixedAsset; onClose: () => void; locks: ReturnType<typeof useBooks>["locks"]; projects: { id: string; name: string }[] }) {
  const [a, setA] = useState<FixedAsset>(
    () => initial ?? { id: "", name: "", account: "1220", cost: 0, vat: 0, salvage: 1, lifeYears: 5, startDate: ACC_TODAY, site: true, paidFrom: "1112" },
  );
  const set = <K extends keyof FixedAsset>(k: K, v: FixedAsset[K]) => setA((x) => ({ ...x, [k]: v }));
  const opening = a.paidFrom === "opening";
  // an asset already depreciated in a closed month must not change its schedule
  const touchesLocked = initial && locks.some((l) => l.id >= periodOf(initial.startDate) && (!initial.disposedDate || l.id <= periodOf(initial.disposedDate)));
  const scheduleChanged = initial && (initial.cost !== a.cost || initial.salvage !== a.salvage || initial.lifeYears !== a.lifeYears || initial.startDate !== a.startDate || initial.account !== a.account);
  const err = !a.name.trim()
    ? "กรอกชื่อสินทรัพย์"
    : a.cost <= 0
      ? "กรอกราคาทุน"
      : touchesLocked && scheduleChanged
        ? "สินทรัพย์นี้มีค่าเสื่อมราคาในงวดที่ปิดแล้ว แก้ราคาทุน/อายุ/วันที่ไม่ได้"
        : !opening && a.startDate < BOOKS_START
          ? "สินทรัพย์ที่ซื้อก่อนเริ่มระบบให้เลือก 'อยู่ในยอดยกมา'"
          : isLockedDate(a.startDate, locks) && (!initial || initial.startDate !== a.startDate) && !opening
            ? LOCKED_MSG
            : a.disposedDate && isLockedDate(a.disposedDate, locks) && a.disposedDate !== initial?.disposedDate
              ? LOCKED_MSG
              : "";
  const save = () => {
    if (err) return;
    assetsCol.upsert({ ...a, id: a.id || assetsCol.nextId("FA-"), name: a.name.trim(), vat: opening ? undefined : r2(a.vat || 0) });
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      width={760}
      title={initial ? `แก้ไข ${initial.id}` : "เพิ่มสินทรัพย์ถาวร"}
      footer={
        <>
          {err && <span className="mr-auto text-[13px] text-neg">{err}</span>}
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary disabled={!!err} onClick={save}>
            บันทึก
          </Btn>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Labeled label="ชื่อสินทรัพย์" className="col-span-2">
          <input className={inputCls} value={a.name} onChange={(e) => set("name", e.target.value)} />
        </Labeled>
        <Labeled label="เลขที่เอกสาร/ทะเบียน">
          <input className={inputCls} value={a.serial ?? ""} onChange={(e) => set("serial", e.target.value || undefined)} />
        </Labeled>
        <Labeled label="ประเภท">
          <select
            className={inputCls}
            value={a.account}
            onChange={(e) => {
              const c = ASSET_CLASSES.find((x) => x.account === e.target.value);
              setA((x) => ({ ...x, account: e.target.value, lifeYears: c?.life ?? x.lifeYears, salvage: c?.life ? x.salvage : 0 }));
            }}
          >
            {ASSET_CLASSES.map((c) => (
              <option key={c.account} value={c.account}>
                {c.account} {c.name}
              </option>
            ))}
          </select>
        </Labeled>
        <Labeled label="วันที่เริ่มใช้งาน">
          <input type="date" className={inputCls} value={a.startDate} onChange={(e) => set("startDate", e.target.value)} />
        </Labeled>
        <Labeled label="อายุการใช้งาน (ปี)">
          <input className={numInput} inputMode="numeric" value={a.lifeYears} onChange={(e) => set("lifeYears", Number(e.target.value) || 0)} />
        </Labeled>
        <Labeled label="ราคาทุน (ไม่รวม VAT)">
          <input className={numInput} inputMode="decimal" value={a.cost || ""} onChange={(e) => set("cost", Number(e.target.value) || 0)} />
        </Labeled>
        <Labeled label="มูลค่าซาก">
          <input className={numInput} inputMode="decimal" value={a.salvage} onChange={(e) => set("salvage", Number(e.target.value) || 0)} />
        </Labeled>
        <Labeled label="การได้มา">
          <select className={inputCls} value={a.paidFrom} onChange={(e) => set("paidFrom", e.target.value as FixedAsset["paidFrom"])}>
            <option value="1112">ซื้อ จ่ายจากธนาคาร</option>
            <option value="2111">ซื้อเชื่อ (ตั้งเจ้าหนี้)</option>
            <option value="opening">อยู่ในยอดยกมาแล้ว</option>
          </select>
        </Labeled>
        {!opening && (
          <Labeled label="ภาษีซื้อ 7%">
            <input className={numInput} inputMode="decimal" value={a.vat ?? 0} onChange={(e) => set("vat", Number(e.target.value) || 0)} />
          </Labeled>
        )}
        <Labeled label="ใช้งาน">
          <select className={inputCls} value={a.site ? "site" : "office"} onChange={(e) => set("site", e.target.value === "site")}>
            <option value="site">หน้างานก่อสร้าง (ต้นทุน 5180)</option>
            <option value="office">สำนักงาน (ค่าใช้จ่าย 5250)</option>
          </select>
        </Labeled>
        <Labeled label="ผูกโครงการ (ถ้ามี)">
          <select className={inputCls} value={a.projectId ?? ""} onChange={(e) => set("projectId", e.target.value || undefined)}>
            <option value="">–</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id} {p.name}
              </option>
            ))}
          </select>
        </Labeled>
        {initial && (
          <>
            <Labeled label="วันที่จำหน่าย/ตัดบัญชี">
              <input type="date" className={inputCls} value={a.disposedDate ?? ""} onChange={(e) => set("disposedDate", e.target.value || undefined)} />
            </Labeled>
            <Labeled label="ราคาขาย (ไม่รวม VAT)">
              <input className={numInput} inputMode="decimal" value={a.proceeds ?? 0} onChange={(e) => set("proceeds", Number(e.target.value) || 0)} />
            </Labeled>
          </>
        )}
      </div>
      {a.lifeYears > 0 && a.cost > 0 && (
        <p className="mt-3 text-[13px] text-ink-2">
          ค่าเสื่อมราคาเดือนละประมาณ <Num v={(a.cost - a.salvage) / (a.lifeYears * 12)} /> บาท ({fmt((100 / a.lifeYears))}% ต่อปี) เดือนแรกคิดตามจำนวนวันที่ใช้งาน
        </p>
      )}
    </Modal>
  );
}
