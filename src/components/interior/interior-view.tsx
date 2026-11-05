"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Pencil, Plus, Search } from "lucide-react";
import { Card, cx, Field, inputCls } from "@/components/ui";
import { Btn, Empty, FilterField, I, Meter, Modal, Pill, Select, StatCard, areaCls } from "@/components/ops/bits";
import { MediaField } from "@/components/media/media-field";
import { TODAY } from "@/lib/data";
import { suppliers } from "@/lib/procurement/store";
import {
  DESIGNERS,
  INT_STATUS_LABEL,
  PRODUCT_CAT_LABEL,
  defaultFeeSchedule,
  ffeItems,
  ffeSell,
  interiorProjects,
  isFfeLate,
  isSampleOverdue,
  marginPct,
  priceFromMarkup,
  products,
  punchItems,
  roomBudgets,
  samples,
  useInteriorSettings,
  type InteriorProject,
  type InteriorStatus,
  type Product,
  type ProductCat,
} from "@/lib/interior";
import { Amt, Header, NumInput, ProjectSelect, Swatch, Tabs, dateOr, rowCls, td, th, thR, useAllProjects, usePerms } from "@/components/design/bits";

const INT_TONE: Record<InteriorStatus, "neutral" | "accent" | "warn" | "pos"> = { design: "accent", procurement: "warn", install: "warn", handover: "accent", closed: "pos" };

export function InteriorView() {
  const sp = useSearchParams();
  const router = useRouter();
  const tab = sp.get("tab") === "catalogue" ? "catalogue" : "projects";
  return (
    <>
      <Header eyebrow="ตกแต่งภายใน" title="งานตกแต่งภายใน" sub="โครงการตกแต่งภายในทั้งบ้านที่บริษัทสร้างและลูกค้าภายนอก แคตตาล็อกสินค้า บอร์ดแต่ละห้อง ตารางเฟอร์นิเจอร์ (FF&E) งบรายห้อง ตัวอย่างวัสดุ การติดตั้ง และรายการแก้ไขก่อนส่งมอบ" />
      <Tabs
        value={tab}
        onChange={(t) => router.replace(t === "catalogue" ? "/interior?tab=catalogue" : "/interior")}
        tabs={[
          { key: "projects", label: "โครงการ" },
          { key: "catalogue", label: "แคตตาล็อกสินค้า" },
        ]}
      />
      {tab === "projects" ? <Projects /> : <Catalogue />}
    </>
  );
}

function Projects() {
  const { edit } = usePerms("interior");
  const list = interiorProjects.use();
  const items = ffeItems.use();
  const smp = samples.use();
  const punch = punchItems.use();
  const st = useInteriorSettings();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [creating, setCreating] = useState(false);

  const rows = useMemo(() => {
    const n = q.trim().toLowerCase();
    return list
      .filter((p) => (!status ? p.status !== "closed" || !q : status === "all" || p.status === status))
      .filter((p) => !n || `${p.id} ${p.name} ${p.client} ${p.designer} ${p.projectId ?? ""}`.toLowerCase().includes(n))
      .map((p) => {
        const its = items.filter((i) => i.interiorId === p.id);
        const budget = roomBudgets(p.rooms, its);
        const allowance = budget.reduce((t, r) => t + r.allowance, 0);
        const committed = budget.reduce((t, r) => t + r.committed, 0);
        const installed = its.filter((i) => i.status === "installed").length;
        return { p, its, allowance, committed, installed, late: its.filter((i) => isFfeLate(i, TODAY)).length, openPunch: punch.filter((x) => x.interiorId === p.id && x.status !== "verified").length };
      });
  }, [list, items, punch, q, status]);

  const active = list.filter((p) => p.status !== "closed");
  const late = items.filter((i) => isFfeLate(i, TODAY));
  const overdue = smp.filter((s) => isSampleOverdue(s, TODAY, st.sampleReturnDays));
  const openPunch = punch.filter((x) => x.status !== "verified");
  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="โครงการที่ดำเนินการ" value={active.length} unit="โครงการ" note={`ลูกค้าภายนอก ${active.filter((p) => !p.projectId).length}`} />
        <StatCard label="ของส่งช้ากว่ากำหนด" value={late.length} unit="รายการ" tone={late.length ? "neg" : undefined} note={`จากที่สั่งแล้ว ${items.filter((i) => i.status !== "specified" && i.status !== "installed").length} รายการ`} />
        <StatCard label="ตัวอย่างยังไม่คืน" value={overdue.length} unit="ชิ้น" note={`เกิน ${st.sampleReturnDays} วันหลังได้รับ/ให้ลูกค้าดู`} />
        <StatCard label="รายการแก้ไขก่อนส่งมอบ" value={openPunch.length} unit="รายการ" note={`แก้แล้วรอตรวจ ${openPunch.filter((x) => x.status === "fixed").length}`} />
      </div>
      <Card className="mb-4">
        <div className="grid grid-cols-2 items-end gap-3 px-4 py-3 lg:grid-cols-5">
          <FilterField label="ค้นหา" className="col-span-2">
            <div className="relative">
              <Search {...I} className="pointer-events-none absolute left-2.5 top-2.5 text-ink-3" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ชื่อ ลูกค้า มัณฑนากร" className={cx(inputCls, "w-full pl-8")} />
            </div>
          </FilterField>
          <FilterField label="สถานะ">
            <Select label="สถานะ" value={status} onChange={setStatus}>
              <option value="">ที่ยังไม่ปิด</option>
              <option value="all">ทั้งหมด</option>
              {Object.entries(INT_STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </FilterField>
          <div className="col-span-2 flex justify-end">
            {edit && (
              <Btn primary onClick={() => setCreating(true)}>
                <Plus {...I} />
                โครงการตกแต่ง
              </Btn>
            )}
          </div>
        </div>
      </Card>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left">
            <thead>
              <tr>
                <th className={cx(th, "px-5")}>โครงการ</th>
                <th className={th}>ลูกค้า</th>
                <th className={th}>มัณฑนากร</th>
                <th className={th}>สถานะ</th>
                <th className={cx(th, "w-[150px]")}>ติดตั้งแล้ว</th>
                <th className={thR}>งบห้อง</th>
                <th className={thR}>สั่งแล้ว</th>
                <th className={th}>กำหนดเสร็จ</th>
                <th className={cx(th, "pr-5")}>ต้องติดตาม</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ p, its, allowance, committed, installed, late, openPunch }) => (
                <tr key={p.id} className={rowCls}>
                  <td className={cx(td, "px-5")}>
                    <Link href={`/interior/${p.id}`} className="block hover:underline">
                      {p.name}
                    </Link>
                    <span className="font-mono text-[12px] text-ink-3">
                      {p.id}
                      {p.projectId ? ` · ${p.projectId}` : " · ลูกค้าภายนอก"}
                    </span>
                  </td>
                  <td className={td}>{p.client}</td>
                  <td className={td}>{p.designer}</td>
                  <td className={td}>
                    <Pill tone={INT_TONE[p.status]}>{INT_STATUS_LABEL[p.status]}</Pill>
                  </td>
                  <td className={td}>
                    <div className="flex items-center gap-2">
                      <Meter value={its.length ? (installed / its.length) * 100 : 0} />
                      <span className="num shrink-0 font-mono text-[12px] text-ink-2">
                        {installed}/{its.length}
                      </span>
                    </div>
                  </td>
                  <td className={cx(td, "text-right")}>
                    <Amt n={allowance} />
                  </td>
                  <td className={cx(td, "text-right")}>
                    <Amt n={committed} className={committed > allowance ? "text-neg" : undefined} />
                  </td>
                  <td className={td}>{dateOr(p.due)}</td>
                  <td className={cx(td, "pr-5 text-[12px]")}>
                    {late > 0 && <span className="block text-neg">ส่งช้า {late} รายการ</span>}
                    {openPunch > 0 && <span className="block text-warn">แก้ไขค้าง {openPunch}</span>}
                    {!late && !openPunch && <span className="text-ink-3">–</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && <Empty>ไม่พบโครงการตกแต่ง</Empty>}
      </Card>
      {creating && <NewInterior onClose={() => setCreating(false)} />}
    </>
  );
}

function NewInterior({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const all = useAllProjects();
  const [linked, setLinked] = useState(true);
  const [projectId, setProjectId] = useState(all.find((p) => p.status === "building")?.id ?? all[0]?.id ?? "");
  const proj = all.find((p) => p.id === projectId);
  const [name, setName] = useState("");
  const [client, setClient] = useState("");
  const [phone, setPhone] = useState("");
  const [designer, setDesigner] = useState(DESIGNERS[0]);
  const [start, setStart] = useState(TODAY);
  const [due, setDue] = useState(new Date(Date.parse(TODAY) + 120 * 86400000).toISOString().slice(0, 10));
  const [fee, setFee] = useState(80000);
  const [rooms, setRooms] = useState("ห้องนั่งเล่น, ห้องครัว, ห้องนอนใหญ่");
  const save = () => {
    const id = interiorProjects.nextId(`INT-${TODAY.slice(0, 4)}-`, 2);
    const p: InteriorProject = {
      id,
      name: name.trim() || (linked && proj ? `ตกแต่งภายใน ${proj.name}` : `งานตกแต่ง ${client}`),
      projectId: linked ? projectId : undefined,
      client: linked && proj ? proj.owner : client.trim(),
      phone: linked && proj ? proj.phone : phone.trim() || undefined,
      address: linked && proj ? proj.address : undefined,
      designer,
      status: "design",
      start,
      due,
      rooms: rooms.split(",").map((r) => r.trim()).filter(Boolean).map((r) => ({ name: r, budget: 0 })),
      designFee: fee,
      fees: defaultFeeSchedule(fee, start, due),
    };
    interiorProjects.upsert(p);
    onClose();
    router.push(`/interior/${id}`);
  };
  const valid = (linked ? !!projectId : client.trim().length > 1) && due > start;
  return (
    <Modal
      open
      onClose={onClose}
      title="โครงการตกแต่งภายในใหม่"
      width={640}
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary disabled={!valid} onClick={save}>
            สร้าง
          </Btn>
        </>
      }
    >
      <div className="mb-3 flex gap-4 text-[13px]">
        <label className="flex items-center gap-2">
          <input type="radio" checked={linked} onChange={() => setLinked(true)} className="accent-[var(--accent)]" />
          บ้านที่บริษัทสร้าง
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" checked={!linked} onChange={() => setLinked(false)} className="accent-[var(--accent)]" />
          ลูกค้าภายนอก
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {linked ? (
          <div className="sm:col-span-2">
            <Field label="โครงการบ้าน">
              <ProjectSelect value={projectId} onChange={setProjectId} list={all} />
            </Field>
          </div>
        ) : (
          <>
            <Field label="ชื่อลูกค้า">
              <input value={client} onChange={(e) => setClient(e.target.value)} className={inputCls} />
            </Field>
            <Field label="เบอร์โทร">
              <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" className={inputCls} />
            </Field>
          </>
        )}
        <div className="sm:col-span-2">
          <Field label="ชื่องาน (เว้นว่างได้)">
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          </Field>
        </div>
        <Field label="มัณฑนากร">
          <Select label="มัณฑนากร" value={designer} onChange={setDesigner}>
            {DESIGNERS.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </Select>
        </Field>
        <Field label="ค่าออกแบบ (บาท)">
          <NumInput value={fee} onChange={setFee} step={1000} />
        </Field>
        <Field label="เริ่ม">
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={inputCls} />
        </Field>
        <Field label="กำหนดเสร็จ">
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={inputCls} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="ห้อง (คั่นด้วยจุลภาค)">
            <input value={rooms} onChange={(e) => setRooms(e.target.value)} className={inputCls} />
          </Field>
        </div>
      </div>
      <p className="mt-2 text-[12px] text-ink-3">ระบบสร้างงวดค่าออกแบบ มัดจำ 30% · อนุมัติแบบ 40% · ติดตั้งเสร็จ 30% แก้ไขได้ภายหลัง</p>
    </Modal>
  );
}

// ---------- catalogue ----------

function Catalogue() {
  const { edit } = usePerms("interior");
  const list = products.use();
  const sups = suppliers.use();
  const items = ffeItems.use();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [form, setForm] = useState<{ p?: Product } | null>(null);
  const supName = (p: Product) => (p.supplierId ? (sups.find((s) => s.id === p.supplierId)?.name ?? p.supplierId) : (p.supplierName ?? "–"));
  const rows = list.filter((p) => (!cat || p.category === cat) && (!q.trim() || `${p.sku} ${p.name} ${p.finish ?? ""} ${p.colour ?? ""} ${supName(p)}`.toLowerCase().includes(q.trim().toLowerCase())));
  const used = (id: string) => items.filter((i) => i.productId === id).reduce((t, i) => t + ffeSell(i), 0);
  return (
    <>
      <Card className="mb-4">
        <div className="grid grid-cols-2 items-end gap-3 px-4 py-3 lg:grid-cols-5">
          <FilterField label="ค้นหา" className="col-span-2">
            <div className="relative">
              <Search {...I} className="pointer-events-none absolute left-2.5 top-2.5 text-ink-3" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="SKU ชื่อ วัสดุ สี ผู้ขาย" className={cx(inputCls, "w-full pl-8")} />
            </div>
          </FilterField>
          <FilterField label="หมวด">
            <Select label="หมวด" value={cat} onChange={setCat}>
              <option value="">ทุกหมวด</option>
              {Object.entries(PRODUCT_CAT_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </FilterField>
          <div className="col-span-2 flex justify-end">
            {edit && (
              <Btn primary onClick={() => setForm({})}>
                <Plus {...I} />
                เพิ่มสินค้า
              </Btn>
            )}
          </div>
        </div>
      </Card>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-left">
            <thead>
              <tr>
                <th className={cx(th, "px-5")}>สินค้า</th>
                <th className={th}>หมวด</th>
                <th className={th}>ขนาด / วัสดุ</th>
                <th className={th}>ผู้ขาย</th>
                <th className={thR}>รอของ</th>
                <th className={thR}>ต้นทุน</th>
                <th className={thR}>บวก</th>
                <th className={thR}>ราคาลูกค้า</th>
                <th className={thR}>ใช้ในงาน</th>
                <th className={cx(th, "pr-5")} />
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-t border-line">
                  <td className={cx(td, "px-5")}>
                    <div className="flex items-center gap-3">
                      <Swatch image={p.images[0]} color={p.swatch} label={p.name} className="size-10 shrink-0" />
                      <div>
                        <p>{p.name}</p>
                        <p className="font-mono text-[12px] text-ink-3">{p.sku}</p>
                      </div>
                    </div>
                  </td>
                  <td className={td}>{PRODUCT_CAT_LABEL[p.category]}</td>
                  <td className={cx(td, "text-[12px]")}>
                    <span className="block font-mono">{p.dims ?? "–"}</span>
                    <span className="text-ink-3">
                      {p.finish}
                      {p.colour ? ` · ${p.colour}` : ""}
                    </span>
                  </td>
                  <td className={cx(td, "text-[12px]")}>{supName(p)}</td>
                  <td className={cx(td, "num text-right font-mono")}>{p.leadDays} วัน</td>
                  <td className={cx(td, "text-right")}>
                    <Amt n={p.tradeCost} />
                  </td>
                  <td className={cx(td, "num text-right font-mono")}>{p.markupPct}%</td>
                  <td className={cx(td, "text-right")}>
                    <Amt n={p.clientPrice} />
                    <span className="block text-[12px] text-ink-3">/{p.unit}</span>
                  </td>
                  <td className={cx(td, "text-right")}>{used(p.id) ? <Amt n={used(p.id)} /> : <span className="text-ink-3">–</span>}</td>
                  <td className={cx(td, "pr-5 text-right")}>
                    {edit && (
                      <button type="button" aria-label="แก้ไข" onClick={() => setForm({ p })} className="inline-flex size-8 items-center justify-center rounded-[8px] text-ink-3 hover:bg-raised hover:text-ink">
                        <Pencil {...I} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && <Empty>ไม่พบสินค้า</Empty>}
      </Card>
      {form && <ProductForm initial={form.p} onClose={() => setForm(null)} />}
    </>
  );
}

export function ProductForm({ initial, onClose, onSaved }: { initial?: Product; onClose: () => void; onSaved?: (p: Product) => void }) {
  const sups = suppliers.use();
  const st = useInteriorSettings();
  const [v, setV] = useState<Product>(initial ?? { id: products.nextId("PRD-"), sku: "", name: "", category: "furniture", leadDays: 30, images: [], tradeCost: 0, markupPct: st.defaultMarkup, clientPrice: 0, unit: "ชิ้น" });
  const set = <K extends keyof Product>(k: K, x: Product[K]) => setV((p) => ({ ...p, [k]: x }));
  const setCost = (tradeCost: number) => setV((p) => ({ ...p, tradeCost, clientPrice: priceFromMarkup(tradeCost, p.markupPct) }));
  const setMarkup = (markupPct: number) => setV((p) => ({ ...p, markupPct, clientPrice: priceFromMarkup(p.tradeCost, markupPct) }));
  const valid = v.sku.trim() && v.name.trim() && v.clientPrice >= 0;
  return (
    <Modal
      open
      onClose={onClose}
      title={initial ? `แก้ไข ${initial.sku}` : "เพิ่มสินค้าในแคตตาล็อก"}
      width={760}
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary disabled={!valid} onClick={() => (products.upsert({ ...v, sku: v.sku.trim(), name: v.name.trim() }), onSaved?.(v), onClose())}>
            บันทึก
          </Btn>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="SKU">
          <input value={v.sku} onChange={(e) => set("sku", e.target.value)} className={cx(inputCls, "font-mono")} />
        </Field>
        <div className="sm:col-span-3">
          <Field label="ชื่อสินค้า">
            <input value={v.name} onChange={(e) => set("name", e.target.value)} className={inputCls} />
          </Field>
        </div>
        <Field label="หมวด">
          <Select label="หมวด" value={v.category} onChange={(c) => set("category", c as ProductCat)}>
            {Object.entries(PRODUCT_CAT_LABEL).map(([k, x]) => (
              <option key={k} value={k}>
                {x}
              </option>
            ))}
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="ผู้ขาย (ทะเบียนจัดซื้อ)">
            <Select label="ผู้ขาย" value={v.supplierId ?? ""} onChange={(x) => set("supplierId", x || undefined)}>
              <option value="">– ผู้ผลิตอื่น –</option>
              {sups.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="หรือชื่อผู้ผลิต">
          <input value={v.supplierName ?? ""} disabled={!!v.supplierId} onChange={(e) => set("supplierName", e.target.value || undefined)} className={inputCls} />
        </Field>
        <Field label="ขนาด (ก×ล×ส มม.)">
          <input value={v.dims ?? ""} onChange={(e) => set("dims", e.target.value || undefined)} className={cx(inputCls, "font-mono")} />
        </Field>
        <Field label="วัสดุ/ผิว">
          <input value={v.finish ?? ""} onChange={(e) => set("finish", e.target.value || undefined)} className={inputCls} />
        </Field>
        <Field label="สี">
          <input value={v.colour ?? ""} onChange={(e) => set("colour", e.target.value || undefined)} className={inputCls} />
        </Field>
        <Field label="สีตัวอย่าง">
          <input type="color" value={v.swatch ?? "#e6e1d8"} onChange={(e) => set("swatch", e.target.value)} className={cx(inputCls, "w-full px-1")} />
        </Field>
        <Field label="ระยะรอของ (วัน)">
          <NumInput value={v.leadDays} onChange={(n) => set("leadDays", n)} />
        </Field>
        <Field label="หน่วย">
          <input value={v.unit} onChange={(e) => set("unit", e.target.value)} className={inputCls} />
        </Field>
        <Field label="ต้นทุน (บาท ก่อน VAT)">
          <NumInput value={v.tradeCost} onChange={setCost} />
        </Field>
        <Field label="บวกกำไร (%)">
          <NumInput value={v.markupPct} onChange={setMarkup} step={0.5} />
        </Field>
        <Field label="ราคาลูกค้า">
          <NumInput value={v.clientPrice} onChange={(clientPrice) => set("clientPrice", clientPrice)} />
        </Field>
        <div className="flex items-end pb-2 text-[13px] text-ink-2">
          กำไรขั้นต้น <span className="num ml-1 font-mono">{marginPct(v.tradeCost, v.clientPrice)}%</span>
        </div>
        <div className="sm:col-span-4">
          <MediaField value={v.images} onChange={(images) => set("images", images)} label="รูปสินค้า" photosOnly geotag={false} max={8} />
        </div>
        <div className="sm:col-span-4">
          <Field label="หมายเหตุ">
            <textarea value={v.note ?? ""} onChange={(e) => set("note", e.target.value || undefined)} className={areaCls} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
