"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Settings2 } from "lucide-react";
import { Card } from "@/components/ui";
import { Btn, I, PrintStyle, StatCard } from "@/components/ops/bits";
import { TODAY } from "@/lib/data";
import {
  concreteTests,
  concreteVerdict,
  diffDays,
  inspectionRequests,
  itpTemplates,
  ncrs,
  pileTests,
  rebarLots,
  rebarVerdict,
  setState,
  useEngSettings,
  waitingHold,
} from "@/lib/engineering";
import { Heading, Tabs, useEngPerms } from "./bits";
import type { QFilter } from "./quality-bits";
import { NcrTab } from "./quality-ncr";
import { ItpTab } from "./quality-itp";
import { EngRulesModal, TestsTab } from "./quality-tests";

export type QTab = "ncr" | "itp" | "tests";


export function QualityView() {
  const sp = useSearchParams();
  const t = sp.get("tab");
  const tab: QTab = t === "itp" || t === "tests" ? t : "ncr";
  return <Inner key={sp.toString()} initTab={tab} initQ={sp.get("q") ?? ""} initProject={sp.get("project") ?? ""} />;
}

function Inner({ initTab, initQ, initProject }: { initTab: QTab; initQ: string; initProject: string }) {
  const perms = useEngPerms();
  const s = useEngSettings();
  const nc = ncrs.use();
  const ir = inspectionRequests.use();
  const tp = itpTemplates.use();
  const ct = concreteTests.use();
  const rb = rebarLots.use();
  const pt = pileTests.use();
  const [tab, setTab] = useState<QTab>(initTab);
  const [f, setF] = useState<QFilter>({ project: initProject, q: initQ, status: "", person: "" });
  const [rulesOpen, setRulesOpen] = useState(false);
  const [newKey, setNewKey] = useState(0);

  const stats = useMemo(() => {
    const openNcr = nc.filter((n) => n.status !== "closed");
    const oldNcr = openNcr.filter((n) => diffDays(n.raisedAt, TODAY) > s.ncrOpenDays).length;
    const holds = ir.filter((r) => {
      const tpl = tp.find((x) => x.id === r.templateId);
      return tpl && waitingHold(tpl, r);
    }).length;
    const due = ct.reduce((n, c) => n + c.sets.filter((x) => ["today", "overdue"].includes(setState(x, TODAY))).length, 0);
    const failed = ct.filter((c) => concreteVerdict(c, s.concrete) === "fail").length + rb.filter((l) => rebarVerdict(l, s.rebar) === "fail").length + pt.filter((p) => p.result === "fail" || p.result === "doubt").length;
    return { open: openNcr.length, oldNcr, holds, due, failed };
  }, [nc, ir, tp, ct, rb, pt, s]);

  const go = (t: QTab, status = "") => {
    setTab(t);
    setF((x) => ({ ...x, status }));
  };

  return (
    <>
      <PrintStyle />
      <Heading
        title="คุณภาพ & ผลทดสอบ"
        sub="รายงานงานไม่เป็นไปตามข้อกำหนด (NCR) การขอตรวจงานตามแผนตรวจสอบ (ITP) ที่มี Hold point ให้ผู้ควบคุมงานอนุมัติก่อนทำขั้นต่อไป และทะเบียนผลทดสอบคอนกรีต เหล็กเสริม เสาเข็ม"
        actions={
          <>
            <Btn onClick={() => setRulesOpen(true)}>
              <Settings2 {...I} />
              เกณฑ์การทดสอบ
            </Btn>
            {perms.edit && (
              <Btn primary onClick={() => setNewKey((k) => k + 1)}>
                {tab === "ncr" ? "ออก NCR" : tab === "itp" ? "ขอตรวจงาน" : "บันทึกผลทดสอบ"}
              </Btn>
            )}
          </>
        }
      />

      <div className="ops-noprint mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="NCR ที่ยังไม่ปิด" value={stats.open} note={stats.oldNcr ? `ค้างเกิน ${s.ncrOpenDays} วัน ${stats.oldNcr} ฉบับ` : "ไม่มีรายการค้างนาน"} tone={stats.oldNcr ? "neg" : undefined} active={tab === "ncr" && f.status === "notclosed"} onClick={() => go("ncr", "notclosed")} />
        <StatCard label="Hold point รออนุมัติ" value={stats.holds} note="งานหยุดรอผู้ควบคุมงาน" active={tab === "itp" && f.status === "hold"} onClick={() => go("itp", "hold")} />
        <StatCard label="ทดสอบคอนกรีตถึงกำหนด" value={stats.due} note="วันนี้และเลยกำหนด" active={tab === "tests" && f.status === "due"} onClick={() => go("tests", "due")} />
        <StatCard label="ผลทดสอบไม่ผ่าน" value={stats.failed} note="คอนกรีต เหล็ก เสาเข็ม" tone={stats.failed ? "neg" : undefined} active={tab === "tests" && f.status === "fail"} onClick={() => go("tests", "fail")} />
      </div>

      <Card className="ops-noprint mb-4">
        <Tabs
          value={tab}
          onChange={(t) => go(t)}
          tabs={[
            { key: "ncr", label: "NCR", count: nc.length },
            { key: "itp", label: "ขอตรวจงาน & ITP", count: ir.length },
            { key: "tests", label: "ผลทดสอบวัสดุ", count: ct.length + rb.length + pt.length },
          ]}
        />
      </Card>

      {tab === "ncr" && <NcrTab f={f} setF={setF} newKey={newKey} />}
      {tab === "itp" && <ItpTab f={f} setF={setF} newKey={newKey} />}
      {tab === "tests" && <TestsTab f={f} setF={setF} newKey={newKey} />}

      <EngRulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
    </>
  );
}

