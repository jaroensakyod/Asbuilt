"use client";

import { useState } from "react";
import { Award, Check, Play, Plus, Printer, Save, Trash2 } from "lucide-react";
import { Card, CardHead, cx, Field, inputCls } from "@/components/ui";
import { Btn, Empty, I, IconBtn, Meter, Pill, PrintStyle, useHydrated } from "@/components/ops/bits";
import { MediaField, MediaStrip } from "@/components/media/media-field";
import { SignaturePad } from "@/components/media/signature-pad";
import { getProject, thDate, TODAY } from "@/lib/data";
import { closeoutPct, closeouts, nowIso, type Closeout, type CloseoutItem, type Handover } from "@/lib/engineering";
import { Area, Back, Check as CheckBox, DocHeader, DocRow, DocSection, SigImg, thDT, useEngPerms } from "./bits";
import { startCloseout } from "./closeout-view";

export function CloseoutDetail({ projectId }: { projectId: string }) {
  const all = closeouts.use();
  const hydrated = useHydrated();
  const perms = useEngPerms();
  const p = getProject(projectId);
  const c = all.find((x) => x.projectId === projectId);
  if (!c) {
    return (
      <Card>
        <Empty>
          {!hydrated ? (
            "กำลังโหลด"
          ) : !p ? (
            `ไม่พบโครงการ ${projectId}`
          ) : (
            <span className="flex flex-col items-center gap-3">
              ยังไม่ได้เริ่มรายการส่งมอบของ {p.name}
              {perms.edit && (
                <Btn primary onClick={() => startCloseout(p)}>
                  <Play {...I} />
                  เริ่มรายการส่งมอบ
                </Btn>
              )}
            </span>
          )}
        </Empty>
      </Card>
    );
  }
  return <Body c={c} />;
}

function Body({ c }: { c: Closeout }) {
  const perms = useEngPerms();
  const hydrated = useHydrated();
  const p = getProject(c.projectId);
  const pct = closeoutPct(c);
  const ro = !perms.edit;
  const [custom, setCustom] = useState({ label: "", group: "เอกสารส่งมอบ" });
  const groups = [...new Set(c.items.map((i) => i.group))];

  const saveItems = (items: CloseoutItem[]) => closeouts.upsert({ ...c, items });
  const patch = (key: string, x: Partial<CloseoutItem>) => saveItems(c.items.map((i) => (i.key === key ? { ...i, ...x } : i)));
  const toggleDone = (it: CloseoutItem, done: boolean) => patch(it.key, { done, na: done ? undefined : it.na, doneBy: done ? perms.me.name : undefined, doneAt: done ? TODAY : undefined });
  const addCustom = () => {
    if (!custom.label.trim()) return;
    saveItems([...c.items, { key: `X${Date.now().toString(36)}`, label: custom.label.trim(), group: custom.group.trim() || "อื่น ๆ", done: false, files: [] }]);
    setCustom({ ...custom, label: "" });
  };
  const signed = !!c.handover?.signedAt;

  return (
    <>
      <PrintStyle />
      <div className="ops-noprint">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-5">
          <div className="flex flex-wrap items-center gap-2">
            <Back href="/closeout" />
            <Pill mono>{c.id}</Pill>
            {signed ? <Pill tone="pos">ลงนามรับมอบแล้ว</Pill> : pct.pct === 100 ? <Pill tone="accent">พร้อมส่งมอบ</Pill> : <Pill tone="warn">กำลังรวบรวม</Pill>}
          </div>
          <Btn onClick={() => window.print()}>
            <Printer {...I} />
            พิมพ์ใบรับมอบงาน
          </Btn>
        </div>
        <h1 className="text-[26px] font-normal leading-[1.2]">ส่งมอบงาน · {p?.name ?? c.projectId}</h1>
        <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 pb-6 text-[13px] text-ink-2">
          <span className="font-mono text-[12px]">{c.projectId}</span>
          <span>เจ้าของ {p?.owner}</span>
          <span>ผู้จัดการโครงการ {p?.pm}</span>
          {p && <span>กำหนดเสร็จ {thDate(p.finish)}</span>}
        </p>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_400px]">
          <div className="flex flex-col gap-4">
            <Card className="px-5 py-4">
              <div className="flex items-baseline justify-between">
                <p className="text-[13px] text-ink-2">ความครบถ้วน</p>
                <p className="num font-mono text-[13px] text-ink-3">
                  {pct.done}/{pct.total} รายการ
                </p>
              </div>
              <p className="num mt-2 text-[30px] font-medium leading-none">{pct.pct}%</p>
              <div className="mt-3">
                <Meter value={pct.pct} />
              </div>
            </Card>
            {groups.map((g) => (
              <Card key={g}>
                <CardHead title={g} meta={`${c.items.filter((i) => i.group === g && i.done).length}/${c.items.filter((i) => i.group === g && !i.na).length}`} />
                <ul>
                  {c.items
                    .filter((i) => i.group === g)
                    .map((it) => (
                      <li key={it.key} className={cx("border-t border-line px-5 py-3.5 first:border-t-0", it.na && "opacity-60")}>
                        <div className="flex flex-wrap items-start gap-3">
                          <button
                            type="button"
                            disabled={ro || it.na}
                            onClick={() => toggleDone(it, !it.done)}
                            aria-pressed={it.done}
                            aria-label={`${it.label} เสร็จแล้ว`}
                            className={cx("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-[5px] border transition-colors duration-150", it.done ? "border-pos bg-pos text-card" : "border-line-strong bg-card")}
                          >
                            {it.done && <Check size={14} strokeWidth={2} />}
                          </button>
                          <div className="min-w-0 flex-1">
                            <p className={cx("text-[14px]", it.na && "line-through")}>{it.label}</p>
                            <p className="text-[12px] text-ink-3">
                              {it.na ? "ไม่เกี่ยวข้องกับโครงการนี้" : it.done ? `เสร็จ ${it.doneAt ? thDate(it.doneAt) : ""} · ${it.doneBy ?? ""}` : "ยังไม่ครบ"}
                              {it.files.length > 0 && ` · ไฟล์ ${it.files.length}`}
                            </p>
                          </div>
                          {!ro && (
                            <div className="flex items-center gap-2">
                              <CheckBox checked={!!it.na} onChange={(v) => patch(it.key, { na: v || undefined, done: v ? false : it.done })}>
                                ไม่เกี่ยวข้อง
                              </CheckBox>
                              {it.key.startsWith("X") && (
                                <IconBtn label={`ลบ ${it.label}`} danger onClick={() => saveItems(c.items.filter((x) => x.key !== it.key))}>
                                  <Trash2 {...I} />
                                </IconBtn>
                              )}
                            </div>
                          )}
                        </div>
                        {!it.na && (
                          <div className="mt-2.5 flex flex-col gap-2 pl-8">
                            {ro ? (
                              <>
                                {it.note && <p className="text-[13px] text-ink-2">{it.note}</p>}
                                <MediaStrip refs={it.files} />
                              </>
                            ) : (
                              <>
                                <input
                                  defaultValue={it.note ?? ""}
                                  onBlur={(e) => e.target.value !== (it.note ?? "") && patch(it.key, { note: e.target.value || undefined })}
                                  placeholder="หมายเหตุ เช่น จำนวนชุด ผู้รับ เลขที่เอกสาร"
                                  className={cx(inputCls, "h-8 w-full text-[13px]")}
                                />
                                <MediaField value={it.files} onChange={(files) => patch(it.key, { files })} label="ไฟล์แนบ" geotag={false} />
                              </>
                            )}
                          </div>
                        )}
                      </li>
                    ))}
                </ul>
              </Card>
            ))}
            {!ro && (
              <Card className="px-5 py-4">
                <p className="mb-2 text-[13px] text-ink-2">เพิ่มรายการเอง</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_200px_auto]">
                  <input value={custom.label} onChange={(e) => setCustom({ ...custom, label: e.target.value })} placeholder="เช่น ใบรับรองระบบป้องกันฟ้าผ่า" className={inputCls} />
                  <input value={custom.group} onChange={(e) => setCustom({ ...custom, group: e.target.value })} list="co-groups" placeholder="หมวด" className={inputCls} />
                  <datalist id="co-groups">
                    {groups.map((g) => (
                      <option key={g} value={g} />
                    ))}
                  </datalist>
                  <Btn onClick={addCustom} disabled={!custom.label.trim()}>
                    <Plus {...I} />
                    เพิ่ม
                  </Btn>
                </div>
              </Card>
            )}
          </div>

          <HandoverCard key={c.handover?.signedAt ?? "new"} c={c} ro={ro} hydrated={hydrated} ready={pct.pct === 100} />
        </div>
      </div>

      {/* printable handover certificate */}
      <article className="ops-print hidden bg-white text-ink print:block">
        <DocHeader
          title="ใบรับมอบงาน"
          titleEn="CERTIFICATE OF HANDOVER"
          code={c.id}
          meta={
            <>
              <p>วันที่ส่งมอบ {c.handover?.date ? thDate(c.handover.date) : "........................"}</p>
              <p>ความครบถ้วน {pct.pct}%</p>
            </>
          }
        />
        <DocSection n={1} title="ข้อมูลโครงการ" en="PROJECT">
          <div className="grid grid-cols-2 gap-x-6">
            <DocRow k="โครงการ">
              {c.projectId} · {p?.name}
            </DocRow>
            <DocRow k="ผู้ว่าจ้าง">{p?.owner}</DocRow>
            <DocRow k="แบบ">
              {p?.modelCode} {p?.model}
            </DocRow>
            <DocRow k="ที่ตั้ง">{p?.address ?? p?.province}</DocRow>
            <DocRow k="พื้นที่">{p ? `${p.area} ตร.ม. · ${p.floors} ชั้น` : ""}</DocRow>
            <DocRow k="ผู้จัดการโครงการ">{p?.pm}</DocRow>
          </div>
        </DocSection>
        <DocSection n={2} title="รายการส่งมอบ" en="CLOSEOUT CHECKLIST">
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="border-b border-ink-3 text-ink-3">
                <th className="w-8 py-1 font-normal">ที่</th>
                <th className="py-1 font-normal">รายการ</th>
                <th className="py-1 font-normal">หมวด</th>
                <th className="w-24 py-1 font-normal">สถานะ</th>
                <th className="py-1 font-normal">หมายเหตุ</th>
              </tr>
            </thead>
            <tbody>
              {c.items.map((it, i) => (
                <tr key={it.key} className="border-b border-line align-top">
                  <td className="py-1 font-mono">{i + 1}</td>
                  <td className="py-1">{it.label}</td>
                  <td className="py-1 text-ink-2">{it.group}</td>
                  <td className={cx("py-1", !it.done && !it.na && "text-neg")}>{it.na ? "ไม่เกี่ยวข้อง" : it.done ? "ส่งมอบแล้ว" : "ค้าง"}</td>
                  <td className="py-1 text-ink-2">{it.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DocSection>
        <DocSection n={3} title="รายละเอียดการส่งมอบ" en="HANDOVER">
          <DocRow k="กุญแจ/รีโมท">{c.handover?.keys ?? "–"}</DocRow>
          <DocRow k="เลขมิเตอร์">{c.handover?.meters ?? "–"}</DocRow>
          <DocRow k="หมายเหตุ">{c.handover?.remarks ?? "–"}</DocRow>
          <p className="mt-3 text-[12px] leading-[20px]">
            ผู้ว่าจ้างได้ตรวจรับงานก่อสร้างตามสัญญาแล้ว และรับมอบอาคารพร้อมเอกสารและอุปกรณ์ตามรายการข้างต้น ระยะเวลารับประกันผลงานเริ่มนับตั้งแต่วันที่ส่งมอบ รายการที่ยังค้าง (ถ้ามี) บริษัทจะดำเนินการให้แล้วเสร็จตามที่ตกลงร่วมกัน
          </p>
        </DocSection>
        <div className="avoid-break mt-10 grid grid-cols-2 gap-8">
          <SigImg role="ผู้ว่าจ้าง / ผู้รับมอบ" name={c.handover?.customerName ?? p?.owner} sig={c.handover?.customerSig} date={c.handover?.signedAt ?? c.handover?.date} />
          <SigImg role="ผู้แทนบริษัท / ผู้ส่งมอบ" name={c.handover?.companyName ?? p?.pm} sig={c.handover?.companySig} date={c.handover?.signedAt ?? c.handover?.date} />
        </div>
      </article>
    </>
  );
}

function HandoverCard({ c, ro, hydrated, ready }: { c: Closeout; ro: boolean; hydrated: boolean; ready: boolean }) {
  const p = getProject(c.projectId);
  const init: Handover = c.handover ?? { date: TODAY, customerName: p?.owner ?? "", companyName: p?.pm ?? "" };
  const [h, setH] = useState<Handover>(init);
  const [dirty, setDirty] = useState(false);
  const set = (x: Partial<Handover>) => {
    setH((v) => ({ ...v, ...x }));
    setDirty(true);
  };
  const persist = (x: Partial<Handover> = {}) => {
    const next = { ...h, ...x };
    setH(next);
    closeouts.upsert({ ...c, handover: next });
    setDirty(false);
  };
  const bothSigned = !!h.customerSig && !!h.companySig;
  const signed = !!h.signedAt;

  return (
    <Card className="self-start">
      <CardHead title="ใบรับมอบงาน" meta={signed ? "ลงนามแล้ว" : undefined} />
      <div className="flex flex-col gap-3 px-5 py-4">
        {!ready && !signed && <p className="rounded-[8px] bg-warn-soft px-3 py-2 text-[13px] text-warn">ยังมีรายการส่งมอบค้าง ใบรับมอบจะแสดงรายการค้างไว้ด้วย</p>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="วันที่ส่งมอบ">
            <input type="date" disabled={ro || signed} value={h.date} onChange={(e) => set({ date: e.target.value })} className={cx(inputCls, "font-mono")} />
          </Field>
          <Field label="ผู้รับมอบ (ลูกค้า)">
            <input disabled={ro || signed} value={h.customerName} onChange={(e) => set({ customerName: e.target.value })} className={inputCls} />
          </Field>
          <div className="col-span-2">
            <Field label="ผู้ส่งมอบ (บริษัท)">
              <input disabled={ro || signed} value={h.companyName} onChange={(e) => set({ companyName: e.target.value })} className={inputCls} />
            </Field>
          </div>
          <div className="col-span-2">
            <Field label="กุญแจ / รีโมท / บัตร">
              <input disabled={ro || signed} value={h.keys ?? ""} onChange={(e) => set({ keys: e.target.value || undefined })} placeholder="กุญแจบ้าน 3 ชุด รีโมทประตูรั้ว 2 ตัว" className={inputCls} />
            </Field>
          </div>
          <div className="col-span-2">
            <Field label="เลขมิเตอร์ ณ วันส่งมอบ">
              <input disabled={ro || signed} value={h.meters ?? ""} onChange={(e) => set({ meters: e.target.value || undefined })} placeholder="ไฟฟ้า ……… · ประปา ………" className={inputCls} />
            </Field>
          </div>
          <div className="col-span-2">
            <Field label="หมายเหตุ">
              <Area value={h.remarks ?? ""} onChange={(v) => !(ro || signed) && set({ remarks: v || undefined })} rows={2} />
            </Field>
          </div>
        </div>
        {!ro && !signed && dirty && (
          <Btn onClick={() => persist()}>
            <Save {...I} />
            บันทึกข้อมูลส่งมอบ
          </Btn>
        )}

        <div className="border-t border-line pt-3">
          <p className="mb-2 text-[13px] text-ink-2">ลายมือชื่อผู้รับมอบ (ลูกค้า)</p>
          {h.customerSig ? (
            <MediaStrip refs={[h.customerSig]} size={96} />
          ) : ro || signed ? (
            <p className="text-[13px] text-ink-3">ยังไม่ได้ลงนาม</p>
          ) : (
            <SignaturePad nameLabel="ชื่อผู้รับมอบ" onSave={(ref, signer) => persist({ customerSig: ref, customerName: signer || h.customerName })} />
          )}
        </div>
        <div className="border-t border-line pt-3">
          <p className="mb-2 text-[13px] text-ink-2">ลายมือชื่อผู้แทนบริษัท</p>
          {h.companySig ? (
            <MediaStrip refs={[h.companySig]} size={96} />
          ) : ro || signed ? (
            <p className="text-[13px] text-ink-3">ยังไม่ได้ลงนาม</p>
          ) : (
            <SignaturePad nameLabel="ชื่อผู้แทนบริษัท" onSave={(ref, signer) => persist({ companySig: ref, companyName: signer || h.companyName })} />
          )}
        </div>
        {signed ? (
          <p className="flex items-center gap-2 text-[13px] text-pos">
            <Award {...I} />
            ลงนามรับมอบงานแล้ว {hydrated && h.signedAt ? thDT(h.signedAt) : thDate(h.date)}
          </p>
        ) : (
          !ro && (
            <Btn primary disabled={!bothSigned} onClick={() => window.confirm("ยืนยันการส่งมอบงาน ข้อมูลใบรับมอบจะถูกล็อก") && persist({ signedAt: nowIso() })}>
              <Award {...I} />
              ยืนยันการส่งมอบงาน
            </Btn>
          )
        )}
        {!signed && !bothSigned && !ro && <p className="text-center text-[12px] text-ink-3">ต้องมีลายมือชื่อทั้งสองฝ่ายก่อนยืนยัน</p>}
      </div>
    </Card>
  );
}
