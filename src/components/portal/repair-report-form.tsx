"use client";

import { useState, type FormEvent } from "react";
import { Check } from "lucide-react";
import { Field, inputCls, cx } from "@/components/ui";
import { SYSTEM_LABEL, type SystemKey } from "@/lib/data";
import { addRepair } from "@/lib/ops-store";
import { SLA_HOURS, TECH_BY_SYSTEM } from "@/components/ops/seed";
import { PORTAL_LIVE, repairTitle, reportRepairLive, severityOf, type PortalRepairInput } from "@/lib/portal";

const CATEGORIES: SystemKey[] = ["arch", "elec", "plumb", "hvac", "struct", "ext"];
const EMPTY: PortalRepairInput = { system: "arch", location: "", detail: "", urgent: false, name: "", phone: "" };

/** Customer repair report. Demo: added to this browser's repair list. Live: portal_report_repair RPC. */
export function RepairReportForm({ token, projectId, onDone }: { token: string; projectId: string; onDone?: () => void }) {
  const [f, setF] = useState<PortalRepairInput>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const set = <K extends keyof PortalRepairInput>(k: K, v: PortalRepairInput[K]) => setF((p) => ({ ...p, [k]: v }));

  const phoneOk = /^[0-9+\-\s]{9,15}$/.test(f.phone.trim());
  const valid = f.location.trim().length > 1 && f.detail.trim().length > 4 && f.name.trim().length > 1 && phoneOk;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const severity = severityOf(f.urgent);
      if (PORTAL_LIVE) {
        const id = await reportRepairLive(token, f, SLA_HOURS[severity]);
        setSent(id);
      } else {
        const r = addRepair({
          title: repairTitle(f.detail),
          detail: f.detail.trim(),
          asset: "",
          assetName: "แจ้งผ่านพอร์ทัลลูกค้า",
          projectId,
          location: f.location.trim(),
          system: f.system,
          severity,
          source: "customer",
          assignee: TECH_BY_SYSTEM[f.system],
          reporter: `${f.name.trim()} · ${f.phone.trim()}`,
        });
        setSent(r.id);
      }
      setF(EMPTY);
      onDone?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ส่งไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  if (sent)
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="flex items-center gap-2 text-[15px]">
          <Check size={16} strokeWidth={1.5} className="text-pos" />
          รับเรื่องแล้ว เลขที่ <span className="num font-mono">{sent}</span>
        </p>
        <p className="text-[13px] text-ink-2">เจ้าหน้าที่จะติดต่อกลับเพื่อนัดเข้าตรวจ ติดตามสถานะได้ในรายการแจ้งซ่อมด้านบน</p>
        <button type="button" onClick={() => setSent(null)} className="h-9 rounded-[8px] border border-line-strong bg-card px-4 text-[14px] transition-colors duration-150 hover:bg-raised">
          แจ้งเรื่องอื่น
        </button>
      </div>
    );

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <Field label="หมวดปัญหา">
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => set("system", c)}
              aria-pressed={f.system === c}
              className={cx(
                "h-8 rounded-[8px] border px-3 text-[13px] transition-colors duration-150",
                f.system === c ? "border-ink bg-ink text-card" : "border-line-strong bg-card text-ink hover:bg-raised",
              )}
            >
              {SYSTEM_LABEL[c]}
            </button>
          ))}
        </div>
      </Field>
      <Field label="ตำแหน่ง">
        <input className={inputCls} value={f.location} onChange={(e) => set("location", e.target.value)} placeholder="เช่น ชั้น 2 · ห้องน้ำห้องนอนใหญ่" maxLength={80} />
      </Field>
      <Field label="รายละเอียด">
        <textarea
          className={cx(inputCls, "h-24 py-2")}
          value={f.detail}
          onChange={(e) => set("detail", e.target.value)}
          placeholder="อาการที่พบ เริ่มเป็นเมื่อไร"
          maxLength={600}
        />
      </Field>
      <label className="flex items-center gap-2 text-[14px] text-ink-2">
        <input type="checkbox" checked={f.urgent} onChange={(e) => set("urgent", e.target.checked)} className="size-4 accent-[var(--accent)]" />
        เร่งด่วน (น้ำรั่ว ไฟฟ้าช็อต หรือกระทบความปลอดภัย)
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="ชื่อผู้ติดต่อ">
          <input className={inputCls} value={f.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" maxLength={60} />
        </Field>
        <Field label="เบอร์โทร">
          <input className={inputCls} value={f.phone} onChange={(e) => set("phone", e.target.value)} inputMode="tel" autoComplete="tel" placeholder="08x-xxx-xxxx" maxLength={15} />
        </Field>
      </div>
      {error && <p className="text-[13px] text-neg">ส่งไม่สำเร็จ: {error}</p>}
      <div>
        <button
          type="submit"
          disabled={!valid || busy}
          className="h-10 rounded-[8px] bg-ink px-5 text-[14px] font-medium text-card transition-[background-color,transform] duration-150 hover:bg-[#253d5c] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "กำลังส่ง" : "ส่งเรื่องแจ้งซ่อม"}
        </button>
      </div>
    </form>
  );
}
