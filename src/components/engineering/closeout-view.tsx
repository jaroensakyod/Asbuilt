"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Play, X } from "lucide-react";
import { Card, cx } from "@/components/ui";
import { Btn, Empty, FilterField, I, Meter, Pill, Select, StatCard } from "@/components/ops/bits";
import { STATUS_LABEL, thDate, TODAY, type Project } from "@/lib/data";
import { addDays, closeoutPct, closeouts, defaultCloseoutItems, type Closeout } from "@/lib/engineering";
import { rowCls, SearchBox, td, th, useActiveProjects, useEngPerms } from "./bits";

/** อ.6-type certificate usually applies to larger / commercial buildings */
export const needsCertificate = (p?: Project) => !!p && (p.floors >= 4 || p.area >= 1000 || p.modelCode.startsWith("CD") || p.modelCode.startsWith("HO"));

export function startCloseout(p: Project): Closeout {
  const c: Closeout = { id: `CO-${p.id}`, projectId: p.id, items: defaultCloseoutItems({ needsCertificate: needsCertificate(p) }) };
  closeouts.upsert(c);
  return c;
}

type State = "none" | "progress" | "ready" | "handed";
const STATE_LABEL: Record<State, string> = { none: "ยังไม่เริ่ม", progress: "กำลังรวบรวม", ready: "พร้อมส่งมอบ", handed: "ลงนามรับมอบแล้ว" };
const STATE_TONE = { none: "neutral", progress: "warn", ready: "accent", handed: "pos" } as const;

export function CloseoutView() {
  const router = useRouter();
  const perms = useEngPerms();
  const projects = useActiveProjects();
  const cos = closeouts.use();
  const [q, setQ] = useState("");
  const [state, setState] = useState("");

  const rows = useMemo(() => {
    const byProject = new Map(cos.map((c) => [c.projectId, c]));
    return projects
      .filter((p) => byProject.has(p.id) || p.status === "handover" || (p.status === "delivered" && !!p.handedOver && p.handedOver >= addDays(TODAY, -365)) || (p.status === "building" && p.actual >= 80))
      .map((p) => {
        const c = byProject.get(p.id);
        const pct = c ? closeoutPct(c) : undefined;
        const st: State = !c ? "none" : c.handover?.signedAt ? "handed" : pct && pct.pct === 100 ? "ready" : "progress";
        return { p, c, pct, st };
      })
      .sort((a, b) => ["progress", "ready", "none", "handed"].indexOf(a.st) - ["progress", "ready", "none", "handed"].indexOf(b.st) || (b.p.finish ?? "").localeCompare(a.p.finish ?? ""));
  }, [projects, cos]);
  const needle = q.trim().toLowerCase();
  const shown = rows.filter((r) => (!state || r.st === state) && (!needle || `${r.p.id} ${r.p.name} ${r.p.owner} ${r.p.pm}`.toLowerCase().includes(needle)));
  const count = (s: State) => rows.filter((r) => r.st === s).length;
  const openItems = rows.reduce((s, r) => s + (r.pct && r.st !== "handed" ? r.pct.total - r.pct.done : 0), 0);

  const start = (p: Project) => {
    startCloseout(p);
    router.push(`/closeout/${p.id}`);
  };

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4 pb-6">
        <div>
          <p className="mb-1 text-[13px] text-ink-3">วิศวกรรม & คุณภาพ</p>
          <h1 className="text-[30px] font-normal leading-[1.15]">ส่งมอบงาน</h1>
          <p className="mt-2 max-w-[48rem] text-ink-2">รายการเอกสารและงานที่ต้องครบก่อนส่งมอบ แบบก่อสร้างจริง คู่มือ หนังสือรับประกัน ผลทดสอบ กุญแจ และใบรับมอบงานที่ลูกค้ากับบริษัทลงนาม</p>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="กำลังรวบรวม" value={count("progress")} note={`รายการค้าง ${openItems} รายการ`} active={state === "progress"} onClick={() => setState(state === "progress" ? "" : "progress")} />
        <StatCard label="พร้อมส่งมอบ" value={count("ready")} note="เอกสารครบ รอลงนาม" active={state === "ready"} onClick={() => setState(state === "ready" ? "" : "ready")} />
        <StatCard label="ยังไม่เริ่ม" value={count("none")} note="ใกล้เสร็จหรือรอตรวจรับ" active={state === "none"} onClick={() => setState(state === "none" ? "" : "none")} />
        <StatCard label="ลงนามรับมอบแล้ว" value={count("handed")} active={state === "handed"} onClick={() => setState(state === "handed" ? "" : "handed")} />
      </div>

      <Card className="mb-4">
        <div className="grid grid-cols-2 gap-3 px-4 py-3 lg:grid-cols-4">
          <SearchBox value={q} onChange={setQ} placeholder="โครงการ เจ้าของ ผู้จัดการโครงการ" className="col-span-2" />
          <FilterField label="สถานะ">
            <Select label="สถานะ" value={state} onChange={setState}>
              <option value="">ทุกสถานะ</option>
              {(Object.keys(STATE_LABEL) as State[]).map((k) => (
                <option key={k} value={k}>
                  {STATE_LABEL[k]}
                </option>
              ))}
            </Select>
          </FilterField>
        </div>
        <div className="flex items-center gap-3 border-t border-line px-4 py-2 text-[13px] text-ink-3">
          <span className="num font-mono text-[12px]">{shown.length} โครงการ</span>
          {(q || state) && (
            <button type="button" onClick={() => (setQ(""), setState(""))} className="inline-flex items-center gap-1 text-ink-2 hover:text-ink">
              <X {...I} />
              ล้างตัวกรอง
            </button>
          )}
        </div>
      </Card>

      <Card>
        {shown.length === 0 ? (
          <Empty>ไม่มีโครงการตามตัวกรอง</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px]">
              <thead>
                <tr>
                  <th className={th}>โครงการ</th>
                  <th className={th}>สถานะโครงการ</th>
                  <th className={th}>กำหนดเสร็จ</th>
                  <th className={cx(th, "w-[220px]")}>ความครบถ้วน</th>
                  <th className={th}>ใบรับมอบงาน</th>
                  <th className={th} />
                </tr>
              </thead>
              <tbody>
                {shown.map(({ p, c, pct, st }) => (
                  <tr key={p.id} className={c ? rowCls : "border-t border-line"} onClick={c ? () => router.push(`/closeout/${p.id}`) : undefined}>
                    <td className={td}>
                      <span className="block">{p.name}</span>
                      <span className="block font-mono text-[11px] text-ink-3">
                        {p.id} · {p.owner}
                      </span>
                    </td>
                    <td className={cx(td, "text-[13px] text-ink-2")}>
                      {STATUS_LABEL[p.status]}
                      <span className="num block font-mono text-[12px] text-ink-3">งาน {p.actual}%</span>
                    </td>
                    <td className={cx(td, "num font-mono text-[13px] text-ink-2")}>{thDate(p.handedOver ?? p.finish)}</td>
                    <td className={td}>
                      {pct ? (
                        <>
                          <div className="flex items-center justify-between text-[12px] text-ink-3">
                            <span>
                              {pct.done}/{pct.total} รายการ
                            </span>
                            <span className="num font-mono text-ink">{pct.pct}%</span>
                          </div>
                          <div className="mt-1.5">
                            <Meter value={pct.pct} />
                          </div>
                        </>
                      ) : (
                        <span className="text-[13px] text-ink-3">–</span>
                      )}
                    </td>
                    <td className={td}>
                      <Pill tone={STATE_TONE[st]}>{STATE_LABEL[st]}</Pill>
                      {c?.handover?.signedAt && <span className="num block font-mono text-[12px] text-ink-3">{thDate(c.handover.date)}</span>}
                    </td>
                    <td className={cx(td, "text-right")}>
                      {!c && perms.edit && (
                        <Btn small onClick={() => start(p)}>
                          <Play {...I} />
                          เริ่มรายการส่งมอบ
                        </Btn>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
