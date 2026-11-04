"use client";

import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { HouseThumb } from "@/components/house-thumb";
import { Card, cx, inputCls } from "@/components/ui";
import { houseModels, MODEL_TYPE_LABEL, projects, type ModelType } from "@/lib/data";
import { priceRange } from "./format";

const TYPES = Object.keys(MODEL_TYPE_LABEL) as ModelType[];
const PRICES: { key: string; label: string; min: number; max: number }[] = [
  { key: "", label: "ทุกช่วงราคา", min: 0, max: Infinity },
  { key: "lt3", label: "ไม่เกิน 3 ล้าน", min: 0, max: 3 },
  { key: "3-5", label: "3–5 ล้าน", min: 3, max: 5 },
  { key: "5-8", label: "5–8 ล้าน", min: 5, max: 8 },
  { key: "8-15", label: "8–15 ล้าน", min: 8, max: 15 },
  { key: "gt15", label: "มากกว่า 15 ล้าน", min: 15, max: Infinity },
];

export function ModelCatalog() {
  const [type, setType] = useState<ModelType | null>(null);
  const [floors, setFloors] = useState("");
  const [price, setPrice] = useState("");
  const [q, setQ] = useState("");

  const band = PRICES.find((p) => p.key === price)!;
  const needle = q.trim().toLowerCase();
  const list = houseModels.filter(
    (m) =>
      (!type || m.type === type) &&
      (!floors || (floors === "3" ? m.floors >= 3 : m.floors === Number(floors))) &&
      m.priceMax >= band.min &&
      m.priceMin <= band.max &&
      (!needle || `${m.code} ${m.name} ${m.nameTh} ${m.style}`.toLowerCase().includes(needle)),
  );

  const sel = cx(inputCls, "pr-8");
  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-0.5 rounded-[10px] bg-raised p-0.5 text-[13px]">
          {[null, ...TYPES].map((t) => (
            <button
              key={t ?? "all"}
              type="button"
              aria-pressed={type === t}
              onClick={() => setType(t)}
              className={cx("h-8 rounded-[8px] px-3 transition-colors duration-150", type === t ? "bg-card text-ink shadow-[0_1px_2px_rgba(0,0,0,0.06)]" : "text-ink-2 hover:text-ink")}
            >
              {t ? MODEL_TYPE_LABEL[t] : "ทุกประเภท"}
              <span className="num ml-1.5 font-mono text-[11px] text-ink-3">{houseModels.filter((m) => !t || m.type === t).length}</span>
            </button>
          ))}
        </div>
        <select aria-label="จำนวนชั้น" value={floors} onChange={(e) => setFloors(e.target.value)} className={sel}>
          <option value="">ทุกจำนวนชั้น</option>
          <option value="1">1 ชั้น</option>
          <option value="2">2 ชั้น</option>
          <option value="3">3 ชั้นขึ้นไป</option>
        </select>
        <select aria-label="ช่วงราคา" value={price} onChange={(e) => setPrice(e.target.value)} className={sel}>
          {PRICES.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </select>
        <label className="relative">
          <Search size={16} strokeWidth={1.5} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหารหัส ชื่อแบบ สไตล์" aria-label="ค้นหาแบบบ้าน" className={cx(inputCls, "w-[260px] pl-9")} />
        </label>
        <span className="ml-auto text-[13px] text-ink-3">
          แสดง <span className="num font-mono text-ink">{list.length}</span> จาก {houseModels.length} แบบ
        </span>
      </div>

      {list.length === 0 ? (
        <Card className="px-5 py-10 text-center text-ink-3">ไม่พบแบบบ้านตามตัวกรอง</Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {list.map((m) => {
            const built = projects.filter((p) => p.modelCode === m.code).length;
            return (
              <Link key={m.code} href={`/models/${m.code}`} className="group">
                <Card className="overflow-hidden transition-[border-color,transform] duration-150 group-hover:border-line-strong group-active:scale-[0.99]">
                  <div className="border-b border-line bg-deep">
                    <HouseThumb code={m.code} className="h-[160px] w-full" />
                  </div>
                  <div className="px-5 py-4">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-mono text-[12px] text-ink-3">{m.code}</span>
                      <span className="text-[12px] text-ink-3">{MODEL_TYPE_LABEL[m.type]}</span>
                    </div>
                    <p className="mt-1 text-[16px] font-medium">{m.name}</p>
                    <p className="truncate text-[13px] text-ink-2">{m.nameTh}</p>
                    <p className="mt-3 text-[13px] text-ink-2">
                      <span className="num">{m.floors}</span> ชั้น · <span className="num">{m.area.toLocaleString("en-US")}</span> ตร.ม. · <span className="num">{m.beds}</span> นอน · <span className="num">{m.baths}</span> น้ำ · จอดรถ <span className="num">{m.parking}</span>
                    </p>
                    <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-line pt-3">
                      <span className="num text-[15px] font-medium">{priceRange(m)}</span>
                      <span className="text-[12px] text-ink-3">
                        {m.months} เดือน · สร้างแล้ว <span className="num font-mono text-ink">{built}</span> หลัง
                      </span>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
