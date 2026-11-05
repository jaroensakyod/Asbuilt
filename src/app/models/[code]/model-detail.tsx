"use client";

import Link from "next/link";
import { Box, Map as MapIcon, PenTool } from "lucide-react";
import { HouseThumb } from "@/components/house-thumb";
import { Page } from "@/components/shell/topbar";
import { Button, Card, CardHead, PageHeader, Stat, Status } from "@/components/ui";
import { getHouseModel, MODEL_TYPE_LABEL, projects, STATUS_LABEL, SYSTEM_LABEL, thDate } from "@/lib/data";
import { getModel, type AssetCategory } from "@/lib/house";
import { SymbolSwatch } from "@/components/plan/symbols";
import { priceRange } from "../format";
import { ModelPlans } from "./model-plans";

const ROOF_LABEL = { gable: "หลังคาจั่ว", hip: "หลังคาปั้นหยา", flat: "หลังคาแบน คสล." };

export function ModelDetail({ code }: { code: string }) {
  const spec = getHouseModel(code);
  if (!spec) return null;
  const model = getModel(spec.code);
  const built = projects.filter((p) => p.modelCode === spec.code);
  const first = built.find((p) => p.status === "delivered") ?? built[0];

  const rooms = model.rooms.map((r) => ({ ...r, area: (r.x1 - r.x0) * (r.z1 - r.z0) }));
  const roomArea = rooms.reduce((s, r) => s + r.area, 0);
  const cats = new Map<AssetCategory, { count: number; system: string }>();
  for (const a of model.assets) {
    const c = cats.get(a.category) ?? { count: 0, system: SYSTEM_LABEL[a.system] };
    c.count++;
    cats.set(a.category, c);
  }

  const specs: [string, string][] = [
    ["รหัสแบบ", spec.code],
    ["ประเภท", MODEL_TYPE_LABEL[spec.type]],
    ["สไตล์", spec.style],
    ["จำนวนชั้น", `${spec.floors} ชั้น`],
    ["พื้นที่ใช้สอย", `${spec.area.toLocaleString("en-US")} ตร.ม.`],
    ["ห้องนอน / ห้องน้ำ", `${spec.beds} / ${spec.baths}`],
    ["ที่จอดรถ", `${spec.parking} คัน`],
    ["หลังคา", ROOF_LABEL[spec.roof]],
    ["ขนาดตัวอาคาร", `${spec.W.toFixed(2)} × ${spec.D.toFixed(2)} ม.`],
    ["ที่ดินแนะนำ", spec.land],
    ["ชุดแบบก่อสร้าง", `${spec.sheets} แผ่น`],
  ];

  return (
    <Page trail={[{ label: "แบบบ้าน", href: "/models" }, { label: spec.code }]}>
      <PageHeader
        eyebrow={`${spec.code} · ${MODEL_TYPE_LABEL[spec.type]}`}
        title={spec.name}
        sub={spec.nameTh}
        actions={
          <>
            {first && (
              <Button href={`/structure/${first.id}`}>
                <Box size={16} strokeWidth={1.5} />
                โมเดล 3D
              </Button>
            )}
            <Button href={`/blueprint/${spec.code}`}>
              <MapIcon size={16} strokeWidth={1.5} />
              ชุดแบบ
            </Button>
            <Button href={`/cad/${spec.code}`}>
              <PenTool size={16} strokeWidth={1.5} />
              CAD
            </Button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="ราคาก่อสร้าง" value={`${spec.priceMin.toFixed(1)}–${spec.priceMax.toFixed(1)}`} unit="ล้านบาท" />
        <Stat label="ระยะเวลาก่อสร้าง" value={spec.months} unit="เดือน" />
        <Stat label="สร้างแล้ว" value={built.length} unit="โครงการ" note={`ส่งมอบแล้ว ${built.filter((p) => p.status === "delivered").length}`} />
        <Stat label="อุปกรณ์ในแบบ" value={model.assets.length} unit="รายการ" note={`${cats.size} หมวด · ${model.rooms.length} ห้อง`} />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card className="overflow-hidden">
          <CardHead title="รูปด้านหน้า" meta={priceRange(spec)} />
          <div className="bg-deep">
            <HouseThumb code={spec.code} className="h-[340px] w-full" />
          </div>
        </Card>
        <Card>
          <CardHead title="ข้อมูลแบบ" />
          <dl className="grid grid-cols-[140px_1fr] text-[13px] [&>div:first-child>*]:border-t-0">
            {specs.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="border-t border-line px-5 py-2 text-ink-3">{k}</dt>
                <dd className="border-t border-line py-2 pr-5">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>

      <ModelPlans code={spec.code} />

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHead title="ตารางห้อง" meta={`${rooms.length} ห้อง · ${roomArea.toFixed(1)} ม²`} />
          <div className="max-h-[480px] overflow-y-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="sticky top-0 bg-card text-[12px] text-ink-3">
                <tr className="border-b border-line">
                  <th className="py-2 pl-5 font-normal">รหัส</th>
                  <th className="py-2 font-normal">ห้อง</th>
                  <th className="py-2 font-normal">ชั้น</th>
                  <th className="py-2 pr-5 text-right font-normal">พื้นที่ ม²</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((r) => (
                  <tr key={r.id} className="border-b border-line last:border-b-0">
                    <td className="py-2 pl-5 font-mono text-[12px] text-ink-2">{r.id}</td>
                    <td className="py-2">{r.name}</td>
                    <td className="num py-2 text-ink-2">{r.floor}</td>
                    <td className="num py-2 pr-5 text-right font-mono text-[12px]">{r.area.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card>
          <CardHead title="สรุปอุปกรณ์ตามหมวด" meta={`${model.assets.length} รายการ`} />
          <table className="w-full text-left text-[13px]">
            <thead className="text-[12px] text-ink-3">
              <tr className="border-b border-line">
                <th className="py-2 pl-5 font-normal">หมวด</th>
                <th className="py-2 font-normal">ระบบ</th>
                <th className="py-2 pr-5 text-right font-normal">จำนวน</th>
              </tr>
            </thead>
            <tbody>
              {[...cats].map(([cat, c]) => (
                <tr key={cat} className="border-b border-line last:border-b-0">
                  <td className="py-2 pl-5">
                    <span className="flex items-center gap-2">
                      <SymbolSwatch cat={cat} />
                      {cat}
                    </span>
                  </td>
                  <td className="py-2 text-ink-2">{c.system}</td>
                  <td className="num py-2 pr-5 text-right font-mono text-[12px]">{c.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHead title="โครงการที่สร้างด้วยแบบนี้" meta={`${built.length} โครงการ`} />
        {built.length === 0 ? (
          <p className="px-5 py-4 text-[13px] text-ink-3">ยังไม่มีโครงการที่ใช้แบบนี้</p>
        ) : (
          <ul>
            {built.map((p) => (
              <li key={p.id}>
                <Link href={`/projects/${p.id}`} className="grid grid-cols-[120px_minmax(0,1fr)_140px_140px] items-center gap-3 border-t border-line px-5 py-2.5 text-[13px] transition-colors duration-150 hover:bg-raised">
                  <span className="font-mono text-[12px] text-ink-2">{p.id}</span>
                  <span className="truncate">
                    {p.name} <span className="text-ink-3">· {p.province}</span>
                  </span>
                  <Status tone={p.status === "delivered" ? "pos" : p.status === "planning" ? "neutral" : "warn"}>{STATUS_LABEL[p.status]}</Status>
                  <span className="text-right text-ink-3">{p.handedOver ? `ส่งมอบ ${thDate(p.handedOver)}` : `กำหนดเสร็จ ${thDate(p.finish)}`}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Page>
  );
}
