"use client";

import type { ReactNode } from "react";
import { AssetTag, Card, CardHead, Status, cx } from "@/components/ui";
import { thDate, TODAY, daysBetween } from "@/lib/data";
import type { BuildingModel } from "@/lib/house";
import { locationOf, type ProjectAsset } from "@/lib/asset-status";
import type { Kind } from "./kinds";

const DF = 0.4;
const V = 230;

function Tile({ label, value, unit, note }: { label: string; value: ReactNode; unit?: string; note?: string }) {
  return (
    <div className="rounded-[10px] bg-raised px-3.5 py-3">
      <p className="text-[12px] text-ink-2">{label}</p>
      <p className="mt-1 flex items-baseline gap-1">
        <span className="num text-[20px] font-medium leading-none">{value}</span>
        {unit && <span className="text-[12px] text-ink-3">{unit}</span>}
      </p>
      {note && <p className="mt-1 text-[12px] text-ink-3">{note}</p>}
    </div>
  );
}

const count = (list: ProjectAsset[], cat: ProjectAsset["category"]) => list.filter((a) => a.category === cat).length;

export function SystemSummary({ kind, model, list, all }: { kind: Kind; model: BuildingModel; list: ProjectAsset[]; all: ProjectAsset[] }) {
  if (kind === "elec") {
    const loadW = model.circuits.reduce((s, c) => s + c.loadW, 0);
    const amps = (loadW * DF) / V;
    const dbs = count(list, "ตู้ควบคุมไฟฟ้า");
    return (
      <Card>
        <CardHead title="สรุประบบไฟฟ้า" meta="1 เฟส 230 V" />
        <div className="grid grid-cols-2 gap-2 p-4">
          <Tile label="โหลดติดตั้งรวม" value={(loadW / 1000).toFixed(1)} unit="kW" note={`ใช้งานจริง ≈ ${Math.round(amps)} A (DF ${DF})`} />
          <Tile label="ตู้ไฟ / วงจร" value={`${dbs} · ${model.circuits.length}`} unit="ตู้ · วงจร" />
          <Tile label="โคมไฟ/แสงสว่าง" value={count(list, "โคมดาวน์ไลท์ LED")} unit="จุด" />
          <Tile label="สวิตช์/เต้ารับ" value={count(list, "สวิตช์ไฟ") + count(list, "เต้ารับคู่มีกราวด์")} unit="จุด" note={`สวิตช์ ${count(list, "สวิตช์ไฟ")} · เต้ารับ ${count(list, "เต้ารับคู่มีกราวด์")}`} />
        </div>
      </Card>
    );
  }
  if (kind === "plumb") {
    const baths = model.rooms.filter((r) => r.kind === "bath").length;
    const kitchens = model.rooms.filter((r) => r.kind === "kitchen").length;
    const fixtures = count(list, "สุขภัณฑ์ (ชักโครก)") + count(list, "อ่างล้างหน้า") + count(list, "ซิงค์ล้างจาน");
    return (
      <Card>
        <CardHead title="สรุประบบสุขาภิบาล" />
        <div className="grid grid-cols-2 gap-2 p-4">
          <Tile label="ห้องน้ำ" value={baths} unit="ห้อง" />
          <Tile label="สุขภัณฑ์/อ่าง/ซิงค์" value={fixtures} unit="ชิ้น" />
          <Tile label="เครื่องทำน้ำอุ่น" value={count(all, "เครื่องทำน้ำอุ่น")} unit="เครื่อง" note="อยู่ในระบบไฟฟ้า" />
          <Tile label="ท่อระบายพื้น" value={baths + kitchens} unit="จุด" note="ห้องน้ำละ 1 จุด และครัว" />
          <Tile label="ถังเก็บน้ำ/ปั๊ม" value={`${count(list, "ถังเก็บน้ำ")} · ${count(list, "ปั๊มน้ำอัตโนมัติ")}`} unit="ถัง · ชุด" />
          <Tile label="ถังบำบัดน้ำเสีย" value={count(list, "ถังบำบัดน้ำเสีย")} unit="ถัง" />
        </div>
      </Card>
    );
  }
  const units = list.filter((a) => a.category === "เครื่องปรับอากาศติดผนัง (Fan Coil)");
  const btu = units.reduce((s, a) => s + (a.btu ?? 0), 0);
  const due45 = units.filter((a) => a.dueIn !== undefined && a.dueIn <= 45).length;
  return (
    <Card>
      <CardHead title="สรุประบบปรับอากาศ" />
      <div className="grid grid-cols-2 gap-2 p-4">
        <Tile label="เครื่องปรับอากาศ" value={units.length} unit="เครื่อง" />
        <Tile label="ขนาดรวม" value={btu.toLocaleString("en-US")} unit="BTU" note={`≈ ${(btu / 12000).toFixed(1)} ตัน`} />
        <Tile label="คอยล์ร้อน" value={count(list, "คอยล์ร้อน (Condensing Unit)")} unit="ชุด" />
        <Tile label="ถึงรอบล้างภายใน 45 วัน" value={due45} unit="เครื่อง" note="รอบล้างทุก 6 เดือน" />
      </div>
    </Card>
  );
}

export function SystemSchedule({ kind, model, list, onSelect, selected }: { kind: Kind; model: BuildingModel; list: ProjectAsset[]; onSelect: (code: string) => void; selected: string | null }) {
  if (kind === "elec") {
    const dbs = [...new Set(model.circuits.map((c) => c.db))];
    return (
      <div className={cx("mt-4 grid gap-4", dbs.length > 1 ? "lg:grid-cols-2" : "")}>
        {dbs.map((db) => {
          const cs = model.circuits.filter((c) => c.db === db);
          const total = cs.reduce((s, c) => s + c.loadW, 0);
          const dbAsset = list.find((a) => a.code === db);
          return (
            <Card key={db}>
              <CardHead title={`ตารางโหลด ${db}`} meta={dbAsset ? locationOf(dbAsset, model) : undefined} />
              <table className="w-full text-left text-[13px]">
                <thead className="text-[12px] text-ink-3">
                  <tr className="border-b border-line">
                    <th className="py-2 pl-5 font-normal">เบรกเกอร์</th>
                    <th className="py-2 font-normal">วงจร</th>
                    <th className="py-2 font-normal">ขนาด</th>
                    <th className="py-2 text-right font-normal">โหลด</th>
                    <th className="py-2 pr-5 text-right font-normal">กระแส</th>
                  </tr>
                </thead>
                <tbody>
                  {cs.map((c) => {
                    const a = list.find((q) => q.code === c.breaker);
                    const bad = a && a.state !== "normal";
                    return (
                      <tr
                        key={c.id}
                        onClick={() => onSelect(c.breaker)}
                        className={cx("cursor-pointer border-b border-line transition-colors duration-150", selected === c.breaker ? "bg-raised" : "hover:bg-raised/60")}
                      >
                        <td className="py-2 pl-5">
                          <AssetTag code={c.breaker} />
                        </td>
                        <td className="py-2">
                          {c.name}
                          {bad && (
                            <span className="ml-2">
                              <Status tone="accent">แจ้งซ่อม</Status>
                            </span>
                          )}
                        </td>
                        <td className="py-2 font-mono text-[12px] text-ink-2">{c.rating}</td>
                        <td className="num py-2 text-right font-mono text-[12px]">{c.loadW.toLocaleString("en-US")} W</td>
                        <td className="num py-2 pr-5 text-right font-mono text-[12px] text-ink-2">{(c.loadW / V).toFixed(1)} A</td>
                      </tr>
                    );
                  })}
                  <tr>
                    <td className="py-2.5 pl-5" />
                    <td className="py-2.5 text-ink-2" colSpan={2}>
                      โหลดรวม · ใช้งานจริง DF {DF}
                    </td>
                    <td className="num py-2.5 text-right font-mono text-[12px]">{total.toLocaleString("en-US")} W</td>
                    <td className="num py-2.5 pr-5 text-right font-mono text-[12px]">{((total * DF) / V).toFixed(1)} A</td>
                  </tr>
                </tbody>
              </table>
            </Card>
          );
        })}
      </div>
    );
  }

  if (kind === "hvac") {
    const units = list.filter((a) => a.category === "เครื่องปรับอากาศติดผนัง (Fan Coil)");
    return (
      <Card className="mt-4">
        <CardHead title="ตารางเครื่องปรับอากาศ" meta={`${units.length} เครื่อง · ล้างทุก 6 เดือน`} />
        <table className="w-full text-left text-[13px]">
          <thead className="text-[12px] text-ink-3">
            <tr className="border-b border-line">
              <th className="py-2 pl-5 font-normal">รหัส</th>
              <th className="py-2 font-normal">ห้อง</th>
              <th className="py-2 text-right font-normal">BTU</th>
              <th className="py-2 pl-6 font-normal">ยี่ห้อ / รุ่น</th>
              <th className="py-2 font-normal">ล้างล่าสุด</th>
              <th className="py-2 pr-5 font-normal">ล้างครั้งถัดไป</th>
            </tr>
          </thead>
          <tbody>
            {units.map((a) => (
              <tr key={a.code} onClick={() => onSelect(a.code)} className={cx("cursor-pointer border-b border-line transition-colors duration-150 last:border-b-0", selected === a.code ? "bg-raised" : "hover:bg-raised/60")}>
                <td className="py-2 pl-5">
                  <AssetTag code={a.code} />
                </td>
                <td className="py-2">{locationOf(a, model)}</td>
                <td className="num py-2 text-right font-mono text-[12px]">{a.btu?.toLocaleString("en-US")}</td>
                <td className="py-2 pl-6 text-ink-2">{a.brand}</td>
                <td className="py-2 text-ink-2">{a.lastService ? thDate(a.lastService) : "—"}</td>
                <td className="py-2 pr-5">
                  {a.nextService ? (
                    <Status tone={a.dueIn! <= 45 ? "warn" : "neutral"}>
                      {thDate(a.nextService)} <span className="text-ink-3">· อีก {daysBetween(TODAY, a.nextService)} วัน</span>
                    </Status>
                  ) : (
                    <span className="text-ink-3">หลังส่งมอบ</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    );
  }

  // plumbing: fixtures per wet room
  const wet = model.rooms.filter((r) => r.kind === "bath" || r.kind === "kitchen");
  return (
    <Card className="mt-4">
      <CardHead title="ตารางสุขภัณฑ์ตามห้อง" meta={`${wet.length} ห้อง`} />
      <table className="w-full text-left text-[13px]">
        <thead className="text-[12px] text-ink-3">
          <tr className="border-b border-line">
            <th className="py-2 pl-5 font-normal">ห้อง</th>
            <th className="py-2 font-normal">ชั้น</th>
            <th className="py-2 font-normal">อุปกรณ์</th>
            <th className="py-2 pr-5 text-right font-normal">ท่อระบายพื้น</th>
          </tr>
        </thead>
        <tbody>
          {wet.map((r) => {
            const items = list.filter((a) => a.room === r.id);
            return (
              <tr key={r.id} className="border-b border-line last:border-b-0">
                <td className="py-2 pl-5">
                  {r.name} <span className="font-mono text-[12px] text-ink-3">{r.id}</span>
                </td>
                <td className="py-2 text-ink-2">{r.floor}</td>
                <td className="py-2">
                  <span className="flex flex-wrap gap-1.5">
                    {items.map((a) => (
                      <button key={a.code} type="button" onClick={() => onSelect(a.code)} className={cx("rounded-[4px] transition-opacity duration-150 hover:opacity-70", a.state !== "normal" && "ring-1 ring-accent")}>
                        <AssetTag code={a.code} />
                      </button>
                    ))}
                  </span>
                </td>
                <td className="num py-2 pr-5 text-right font-mono text-[12px]">1</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}
