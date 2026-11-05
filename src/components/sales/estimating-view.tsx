"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Calculator, FilePlus2, Printer, Save } from "lucide-react";
import { Card, CardHead, cx, Field, inputCls, PageHeader } from "@/components/ui";
import { Btn, Pill, PrintStyle, useHydrated } from "@/components/ops/bits";
import { DocHeader, Signatures } from "@/components/ops/doc";
import { COST_CODES } from "@/lib/biz";
import { getHouseModel, houseModels, projects as seedProjects, thDate, TODAY } from "@/lib/data";
import { useLocalProjects } from "@/lib/projects-store";
import { computeBoq, DEFAULT_MARGIN, DEFAULT_OVERHEAD, finish, type BoqLine } from "@/lib/sales/boq";
import { createQuote, estimateFromBoq, estimates, leads } from "@/lib/sales/crm";
import { BOOK_LABEL, competitorPerM2, competitorPrices, SOURCE_SHORT, usePriceBook, type BookChoice } from "@/lib/sales/prices";
import { I, mb, n0, pct, price, qty, SampleTag, Td, Th, theadCls } from "./common";
import { AiButton } from "@/components/ai-sales/bits";
import { EstimateAssistant } from "@/components/ai-sales/estimate-assistant";

const CHOICES: BookChoice[] = ["cgd", "moc", "supplier", "lowest"];

export function EstimatingView() {
  const sp = useSearchParams();
  const router = useRouter();
  const hydrated = useHydrated();
  const local = useLocalProjects();
  const allProjects = useMemo(() => [...local, ...seedProjects], [local]);
  const leadList = leads.use();
  const saved = estimates.use();
  const comps = competitorPrices.use();

  const initProject = sp.get("project") ?? "";
  const initLead = sp.get("lead") ?? "";
  const leadOf = leadList.find((l) => l.id === initLead);
  const [projectId, setProjectId] = useState(initProject);
  const [leadId, setLeadId] = useState(initLead);
  const [model, setModel] = useState(sp.get("model") ?? allProjects.find((p) => p.id === initProject)?.modelCode ?? leadOf?.models[0] ?? "HM-17");
  const [choice, setChoice] = useState<BookChoice>((sp.get("source") as BookChoice) || "cgd");
  const [oh, setOh] = useState(Number(sp.get("oh")) || DEFAULT_OVERHEAD);
  const [mg, setMg] = useState(Number(sp.get("margin")) || DEFAULT_MARGIN);
  const [grade, setGrade] = useState<number | null>(Number(sp.get("grade")) || null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState(false);

  const project = allProjects.find((p) => p.id === projectId);
  const lead = leadList.find((l) => l.id === leadId);
  const province = project?.province ?? lead?.province;
  const book = usePriceBook(choice, province);
  const base = useMemo(() => computeBoq(model, book, DEFAULT_OVERHEAD, DEFAULT_MARGIN, grade ?? undefined), [model, book, grade]);
  const r = useMemo(() => finish(base, oh, mg), [base, oh, mg]);
  const spec = getHouseModel(model);
  const comp = competitorPerM2(comps, r.q.area, spec?.floors);
  const catMin = (spec?.priceMin ?? 0) * 1e6;
  const catMax = (spec?.priceMax ?? 0) * 1e6;
  const vsCatalog = catMin ? r.selling / ((catMin + catMax) / 2) - 1 : undefined;

  const groups = useMemo(() => r.byCode.map((c) => ({ ...c, lines: r.lines.filter((l) => l.costCode === c.costCode) })), [r]);

  const save = () => {
    const id = estimates.nextId(`EST-${TODAY.slice(0, 4)}-`);
    const name = `${spec?.name ?? model}${lead ? ` · ${lead.name}` : project ? ` · ${project.owner}` : ""}`;
    estimates.upsert(estimateFromBoq(r, { id, name, date: TODAY, by: "ฝ่ายประมาณราคา", projectId: project?.id, leadId: lead?.id, province }));
    setSavedId(id);
    return id;
  };

  const toQuote = () => {
    const id = savedId ?? save();
    const est = estimates.get(id);
    const q = createQuote({ lead, modelCode: model, estimate: est, owner: lead?.owner ?? "ฝ่ายขาย" });
    router.push(`/quotes/${q.id}`);
  };

  const changed = () => setSavedId(null);

  return (
    <>
      <PrintStyle />
      <div className="ops-noprint">
        <PageHeader
          title="ประเมินราคา & BOQ"
          sub="ถอดปริมาณงานจากโมเดลบ้าน 3 มิติ คิดราคาวัสดุและค่าแรงจากฐานข้อมูลราคา แล้วบวกค่าดำเนินการและกำไรเป็นราคาขาย"
          actions={
            <>
              <AiButton small={false} onClick={() => setAiOpen(true)} disabled={aiOpen}>
                ประเมินงานต่อเติมด้วย AI
              </AiButton>
              <Btn onClick={() => window.print()}>
                <Printer {...I} />
                พิมพ์ BOQ
              </Btn>
              <Btn onClick={save} disabled={!!savedId}>
                <Save {...I} />
                {savedId ? `บันทึกแล้ว ${savedId}` : "บันทึกประมาณการ"}
              </Btn>
              <Btn primary onClick={toQuote}>
                <FilePlus2 {...I} />
                สร้างใบเสนอราคา
              </Btn>
            </>
          }
        />

        <Card className="px-5 py-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
            <Field label="แบบบ้าน">
              <select
                className={inputCls}
                value={model}
                onChange={(e) => {
                  setModel(e.target.value);
                  setGrade(null);
                  changed();
                }}
              >
                {houseModels.map((m) => (
                  <option key={m.code} value={m.code}>
                    {m.code} · {m.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="โครงการ (ถ้ามี)">
              <select
                className={inputCls}
                value={projectId}
                onChange={(e) => {
                  const p = allProjects.find((x) => x.id === e.target.value);
                  setProjectId(e.target.value);
                  if (p) {
                    setModel(p.modelCode);
                    setGrade(null);
                  }
                  changed();
                }}
              >
                <option value="">ไม่ระบุ</option>
                {allProjects
                  .filter((p) => p.status !== "delivered")
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.id} · {p.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="ลูกค้ามุ่งหวัง (ถ้ามี)">
              <select
                className={inputCls}
                value={leadId}
                onChange={(e) => {
                  const l = leadList.find((x) => x.id === e.target.value);
                  setLeadId(e.target.value);
                  if (l?.models[0]) {
                    setModel(l.models[0]);
                    setGrade(null);
                  }
                  changed();
                }}
              >
                <option value="">ไม่ระบุ</option>
                {leadList
                  .filter((l) => l.stage !== "won" && l.stage !== "lost")
                  .map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.id} · {l.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="แหล่งราคา">
              <select
                className={inputCls}
                value={choice}
                onChange={(e) => {
                  setChoice(e.target.value as BookChoice);
                  changed();
                }}
              >
                {CHOICES.map((c) => (
                  <option key={c} value={c}>
                    {BOOK_LABEL[c]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="ค่าดำเนินการ (%)">
              <input
                type="number"
                min={0}
                max={40}
                step={0.5}
                className={cx(inputCls, "font-mono")}
                value={oh}
                onChange={(e) => {
                  setOh(Math.max(0, Number(e.target.value)));
                  changed();
                }}
              />
            </Field>
            <Field label="กำไร (% ของราคาขาย)">
              <input
                type="number"
                min={0}
                max={60}
                step={0.5}
                className={cx(inputCls, "font-mono")}
                value={mg}
                onChange={(e) => {
                  setMg(Math.min(60, Math.max(0, Number(e.target.value))));
                  changed();
                }}
              />
            </Field>
            <Field label="เกรดวัสดุตกแต่ง (×)">
              <input
                type="number"
                min={0.5}
                max={3}
                step={0.05}
                className={cx(inputCls, "font-mono")}
                value={grade ?? r.grade}
                onChange={(e) => {
                  setGrade(Math.min(3, Math.max(0.5, Number(e.target.value) || 1)));
                  changed();
                }}
              />
            </Field>
          </div>
          <p className="mt-3 text-[12px] text-ink-3">
            เกรดวัสดุตกแต่งตั้งต้นจากระดับราคาแค็ตตาล็อกของแบบ (มาตรฐาน 1.00 ≈ {n0(24000)} บ./ตร.ม.) ใช้กับหมวด 08–12 เต็มอัตรา และหมวดโครงสร้าง/ระบบครึ่งหนึ่ง{province ? ` · ราคากระทรวงพาณิชย์เลือกจังหวัด${province}ก่อนถ้ามี` : ""}
          </p>
        </Card>

        {aiOpen && <EstimateAssistant choice={choice} province={province} overheadPct={oh} marginPct={mg} onClose={() => setAiOpen(false)} />}

        <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_360px]">
          <Card>
            <CardHead title="บัญชีแสดงปริมาณวัสดุและราคา (BOQ)" meta={`${r.lines.length} รายการ · ${spec?.name ?? model}`} action={hydrated && r.sampleShare > 0 ? <SampleTag /> : undefined} />
            <BoqTable groups={groups} direct={r.direct} />
          </Card>

          <div className="flex flex-col gap-4">
            <Card>
              <CardHead title="สรุปราคา" meta={BOOK_LABEL[choice]} />
              <dl className="px-5 py-3 text-[13px]">
                <Row k="ค่าวัสดุ" v={n0(r.byCode.reduce((s, c) => s + c.material, 0))} />
                <Row k="ค่าแรง" v={n0(r.byCode.reduce((s, c) => s + c.labour, 0))} />
                <Row k="ต้นทุนทางตรง" v={n0(r.direct)} strong />
                <Row k={`ค่าดำเนินการ ${oh}%`} v={n0(r.overhead)} />
                <Row k="ต้นทุนรวม" v={n0(r.cost)} strong />
                <Row k={`กำไร ${mg}% ของราคาขาย`} v={n0(r.margin)} />
                <div className="mt-2 flex items-baseline justify-between border-t border-line pt-3">
                  <dt className="text-ink">ราคาขาย (ก่อน VAT)</dt>
                  <dd className="num font-mono text-[22px] text-ink">{n0(r.selling)}</dd>
                </div>
                <Row k="รวม VAT 7%" v={n0(r.selling * 1.07)} />
                <Row k="ราคาต่อ ตร.ม." v={`${n0(r.perM2)} บ.`} />
                <Row k="Markup บนต้นทุน" v={pct(r.selling / r.cost - 1)} />
              </dl>
            </Card>
            <Card>
              <CardHead title="เทียบราคา" />
              <div className="px-5 py-3 text-[13px]">
                <Compare label="ราคาแค็ตตาล็อก" range={catMin ? `${mb(catMin)} – ${mb(catMax)}` : "–"} per={catMin ? `${n0((catMin + catMax) / 2 / r.q.area)} บ./ตร.ม.` : ""} delta={vsCatalog} />
                <Compare label={`คู่แข่งพื้นที่ใกล้เคียง${comp ? ` (${comp.n} แบบ)` : ""}`} range={comp ? `${n0(comp.min)} – ${n0(comp.max)} บ./ตร.ม.` : "–"} per={comp ? `มัธยฐาน ${n0(comp.median)} บ./ตร.ม.` : ""} delta={comp ? r.perM2 / comp.median - 1 : undefined} />
                {catMin > 0 && <RangeBar min={catMin} max={catMax} value={r.selling} />}
                <p className="mt-3 text-[12px] text-ink-3">ส่วนต่างคิดจากราคาขายของประมาณการนี้ บวก = แพงกว่า</p>
              </div>
            </Card>
            <Card>
              <CardHead title="ปริมาณหลักจากโมเดล" meta={`${r.q.area} ตร.ม. · ${r.q.floors} ชั้น`} />
              <dl className="grid grid-cols-2 gap-x-4 px-5 py-3 text-[12px]">
                <QRow k="คอนกรีตรวม" v={`${qty(Math.round(r.q.concTotal * 10) / 10)} ลบ.ม.`} />
                <QRow k="เหล็กเสริม" v={`${n0(r.q.rebar)} กก.`} />
                <QRow k="ผนังสุทธิ" v={`${n0(r.q.wallNet)} ตร.ม.`} />
                <QRow k="ช่องเปิด" v={`${n0(r.q.openings)} ตร.ม.`} />
                <QRow k="ฉาบปูน" v={`${n0(r.q.plaster)} ตร.ม.`} />
                <QRow k="หลังคา" v={`${n0(r.q.roofPitched || r.q.roofFlat)} ตร.ม.`} />
                <QRow k="ประตู / หน้าต่าง" v={`${r.q.doors} / ${r.q.windows}`} />
                <QRow k="สุขภัณฑ์" v={`${r.q.wc} ชุด`} />
                <QRow k="ไฟ/ปลั๊ก/สวิตช์" v={`${r.q.lights}/${r.q.sockets}/${r.q.switches}`} />
                <QRow k="แนวสายไฟ" v={`${n0(r.q.wire)} ม.`} />
                <QRow k="ท่อน้ำดี / ทิ้ง" v={`${n0(r.q.water)} / ${n0(r.q.drain)} ม.`} />
                <QRow
                  k="แอร์"
                  v={Object.entries(r.q.ac)
                    .map(([b, n]) => `${n}×${Number(b) / 1000}k`)
                    .join(" ")}
                />
              </dl>
            </Card>
          </div>
        </div>

        <Card className="mt-4">
          <CardHead title="ประมาณการที่บันทึกไว้" meta={`${saved.length} รายการ`} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-[13px]">
              <thead>
                <tr className={theadCls}>
                  <Th>เลขที่</Th>
                  <Th>ชื่อ</Th>
                  <Th>อ้างอิง</Th>
                  <Th>แหล่งราคา</Th>
                  <Th right>ต้นทุนรวม</Th>
                  <Th right>ราคาขาย</Th>
                  <Th right>บ./ตร.ม.</Th>
                  <Th>วันที่</Th>
                  <Th />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {[...saved]
                  .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
                  .slice(0, 12)
                  .map((e) => (
                    <tr key={e.id} className={e.id === savedId ? "bg-accent-soft/40" : undefined}>
                      <Td mono>{e.id}</Td>
                      <Td>{e.name}</Td>
                      <Td className="text-[12px] text-ink-2">
                        {e.projectId ? (
                          <Link href={`/projects/${e.projectId}`} className="hover:text-ink">
                            {e.projectId}
                          </Link>
                        ) : e.leadId ? (
                          <Link href={`/sales/${e.leadId}`} className="hover:text-ink">
                            {e.leadId}
                          </Link>
                        ) : (
                          "–"
                        )}
                      </Td>
                      <Td className="text-[12px] text-ink-2">{BOOK_LABEL[e.choice]}</Td>
                      <Td right mono>
                        {n0(e.cost)}
                      </Td>
                      <Td right mono>
                        {n0(e.selling)}
                      </Td>
                      <Td right mono>
                        {n0(e.perM2)}
                      </Td>
                      <Td className="whitespace-nowrap text-[12px] text-ink-2">{thDate(e.date)}</Td>
                      <Td right>
                        <Link
                          href={`/estimating?model=${e.modelCode}&source=${e.choice}&oh=${e.overheadPct}&margin=${e.marginPct}&grade=${e.grade}${e.projectId ? `&project=${e.projectId}` : ""}${e.leadId ? `&lead=${e.leadId}` : ""}`}
                          onClick={() => {
                            setModel(e.modelCode);
                            setChoice(e.choice);
                            setOh(e.overheadPct);
                            setMg(e.marginPct);
                            setGrade(e.grade);
                            setProjectId(e.projectId ?? "");
                            setLeadId(e.leadId ?? "");
                            setSavedId(e.id);
                          }}
                          className="inline-flex items-center gap-1 text-[13px] text-ink-2 hover:text-ink"
                        >
                          <Calculator size={14} strokeWidth={1.5} />
                          เปิด
                        </Link>
                      </Td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* A4 print layout */}
      <article className="ops-print hidden bg-white text-ink print:block">
        <DocHeader
          title="บัญชีแสดงปริมาณวัสดุและราคา"
          titleEn="BILL OF QUANTITIES"
          code={savedId ?? "ร่าง"}
          meta={
            <>
              <p>วันที่ {thDate(TODAY)}</p>
              <p>แหล่งราคา {BOOK_LABEL[choice]}</p>
            </>
          }
        />
        <div className="mt-4 grid grid-cols-2 gap-x-8 text-[12px]">
          <p>
            แบบบ้าน <span className="text-ink">{spec ? `${spec.code} ${spec.name}` : model}</span> · พื้นที่ใช้สอย {r.q.area} ตร.ม. · {r.q.floors} ชั้น
          </p>
          <p className="text-right">{project ? `โครงการ ${project.id} ${project.name}` : lead ? `ลูกค้า ${lead.name}` : ""}</p>
        </div>
        <table className="mt-3 w-full text-[11px]">
          <thead>
            <tr className="border-b border-ink text-left">
              <th className="py-1 pr-2 font-medium">ลำดับ</th>
              <th className="py-1 pr-2 font-medium">รายการ</th>
              <th className="py-1 pr-2 text-right font-medium">ปริมาณ</th>
              <th className="py-1 pr-2 font-medium">หน่วย</th>
              <th className="py-1 pr-2 text-right font-medium">ค่าวัสดุ/หน่วย</th>
              <th className="py-1 pr-2 text-right font-medium">ค่าแรง/หน่วย</th>
              <th className="py-1 text-right font-medium">รวมเงิน</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <Fragment key={g.costCode}>
                <tr className="avoid-break border-b border-line bg-raised/60">
                  <td className="py-1 pr-2 font-mono">{g.costCode}</td>
                  <td className="py-1 pr-2 font-medium" colSpan={5}>
                    {COST_CODES[g.costCode]}
                  </td>
                  <td className="py-1 text-right font-mono font-medium">{n0(g.amount)}</td>
                </tr>
                {g.lines.map((l, i) => (
                  <tr key={l.key} className="avoid-break border-b border-line">
                    <td className="py-0.5 pr-2 font-mono text-ink-3">
                      {g.costCode}.{i + 1}
                    </td>
                    <td className="py-0.5 pr-2">{l.name}</td>
                    <td className="py-0.5 pr-2 text-right font-mono">{qty(l.qty)}</td>
                    <td className="py-0.5 pr-2">{l.unit}</td>
                    <td className="py-0.5 pr-2 text-right font-mono">{price(l.material)}</td>
                    <td className="py-0.5 pr-2 text-right font-mono">{price(l.labour)}</td>
                    <td className="py-0.5 text-right font-mono">{n0(l.amount)}</td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
        <table className="avoid-break ml-auto mt-4 w-[300px] text-[12px]">
          <tbody>
            <PRow k="ต้นทุนทางตรง" v={n0(r.direct)} />
            <PRow k={`ค่าดำเนินการ ${oh}%`} v={n0(r.overhead)} />
            <PRow k={`กำไร ${mg}%`} v={n0(r.margin)} />
            <PRow k="ราคาขาย (ก่อน VAT)" v={n0(r.selling)} strong />
            <PRow k="ภาษีมูลค่าเพิ่ม 7%" v={n0(r.selling * 0.07)} />
            <PRow k="รวมทั้งสิ้น" v={n0(r.selling * 1.07)} strong />
          </tbody>
        </table>
        {r.sampleShare > 0 && <p className="mt-3 text-[11px] text-ink-3">หมายเหตุ ราคาวัสดุบางรายการเป็นราคาตัวอย่างในระบบ ไม่ใช่ราคาทางการ ใช้เพื่อการประมาณการภายในเท่านั้น</p>}
        <Signatures roles={[{ role: "ผู้ประมาณราคา" }, { role: "ผู้ตรวจสอบ" }, { role: "ผู้อนุมัติ" }]} />
      </article>
    </>
  );
}

function BoqTable({ groups, direct }: { groups: { costCode: keyof typeof COST_CODES; material: number; labour: number; amount: number; lines: BoqLine[] }[]; direct: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-[13px]">
        <thead>
          <tr className={theadCls}>
            <Th>รายการ</Th>
            <Th right>ปริมาณ</Th>
            <Th>หน่วย</Th>
            <Th right>วัสดุ/หน่วย</Th>
            <Th right>ค่าแรง/หน่วย</Th>
            <Th right>รวม</Th>
            <Th>ราคาจาก</Th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <Fragment key={g.costCode}>
              <tr className="border-y border-line bg-raised/50">
                <Td colSpan={5}>
                  <span className="font-mono text-[12px] text-ink-3">{g.costCode}</span> <span className="font-medium">{COST_CODES[g.costCode]}</span>
                </Td>
                <Td right mono className="text-[13px] text-ink">
                  {n0(g.amount)}
                </Td>
                <Td className="text-[12px] text-ink-3">{direct ? `${((g.amount / direct) * 100).toFixed(1)}%` : ""}</Td>
              </tr>
              {g.lines.map((l) => (
                <tr key={l.key} className="border-b border-line last:border-0">
                  <Td>
                    <span className="text-ink">{l.name}</span>
                    <span className="block text-[12px] text-ink-3">{l.basis}</span>
                  </Td>
                  <Td right mono>
                    {qty(l.qty)}
                  </Td>
                  <Td className="text-ink-2">{l.unit}</Td>
                  <Td right mono>
                    {price(l.material)}
                  </Td>
                  <Td right mono className="text-ink-2">
                    {price(l.labour)}
                  </Td>
                  <Td right mono className="text-ink">
                    {n0(l.amount)}
                  </Td>
                  <Td className="whitespace-nowrap text-[12px] text-ink-3">
                    {l.source === "rate" ? "อัตราบริษัท" : SOURCE_SHORT[l.source]}
                    {l.itemCode && <span className="ml-1 font-mono">{l.itemCode}</span>}
                  </Td>
                </tr>
              ))}
            </Fragment>
          ))}
          <tr className="border-t border-line-strong">
            <Td colSpan={5} className="font-medium">
              ต้นทุนทางตรงรวม
            </Td>
            <Td right mono className="text-[14px] text-ink">
              {n0(direct)}
            </Td>
            <Td />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between py-1">
      <dt className={strong ? "text-ink" : "text-ink-2"}>{k}</dt>
      <dd className={cx("num font-mono", strong ? "text-ink" : "text-ink-2")}>{v}</dd>
    </div>
  );
}
function QRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-line py-1.5">
      <dt className="text-ink-3">{k}</dt>
      <dd className="num truncate font-mono text-ink">{v || "–"}</dd>
    </div>
  );
}
function PRow({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <tr className="border-b border-line">
      <td className={cx("py-1", strong && "font-medium")}>{k}</td>
      <td className={cx("py-1 text-right font-mono", strong && "font-medium")}>{v}</td>
    </tr>
  );
}
function Compare({ label, range, per, delta }: { label: string; range: string; per: string; delta?: number }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line py-2 last:border-0">
      <div>
        <p className="text-ink-2">{label}</p>
        <p className="num font-mono text-[12px] text-ink">{range}</p>
        {per && <p className="text-[12px] text-ink-3">{per}</p>}
      </div>
      {delta !== undefined && <Pill tone={Math.abs(delta) < 0.05 ? "neutral" : delta > 0 ? "warn" : "accent"}>{pct(delta)}</Pill>}
    </div>
  );
}
/** Catalog range with the estimate marked */
function RangeBar({ min, max, value }: { min: number; max: number; value: number }) {
  const lo = Math.min(min, value) * 0.95;
  const hi = Math.max(max, value) * 1.05;
  const x = (v: number) => ((v - lo) / (hi - lo)) * 100;
  return (
    <div className="mt-3">
      <div className="relative h-2 rounded-full bg-raised">
        <div className="absolute inset-y-0 rounded-full bg-deep" style={{ left: `${x(min)}%`, width: `${x(max) - x(min)}%` }} />
        <div className="absolute -top-1 h-4 w-0.5 rounded bg-accent" style={{ left: `${x(value)}%` }} />
      </div>
      <div className="mt-1 flex justify-between font-mono text-[11px] text-ink-3">
        <span>{mb(lo)}</span>
        <span>ประมาณการ {mb(value)}</span>
        <span>{mb(hi)}</span>
      </div>
    </div>
  );
}
