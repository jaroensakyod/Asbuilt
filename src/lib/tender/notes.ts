// Tender notifications: deadlines within 7 days, bond expiry, ค่า K claim window, late completion.

import { useMemo } from "react";
import { TODAY } from "@/lib/data";
import { registerNotes, type Note } from "@/lib/notifications";
import { daysLate, kAdjustment, kClaimDeadline, kValue } from "./calc";
import { tenders, useTenderSettings } from "./store";

const DAY = 86400000;
const diff = (iso: string) => Math.round((Date.parse(iso) - Date.parse(TODAY)) / DAY);
const due = (d: number) => (d === 0 ? "วันนี้" : `อีก ${d} วัน`);

function useTenderNotes(): Note[] {
  const list = tenders.use();
  const s = useTenderSettings();
  return useMemo(() => {
    const out: Note[] = [];
    for (const t of list) {
      const href = `/tenders/${t.id}`;
      if (t.status === "prospect" || t.status === "preparing") {
        const marks: [string | undefined, string][] = [
          [t.siteVisit, "ดูสถานที่"],
          [t.questionsDue, "ส่งคำถาม/ขอคำชี้แจง"],
          [t.submitDue, "ยื่นซองประมูล"],
        ];
        for (const [date, label] of marks) {
          if (!date) continue;
          const d = diff(date);
          if (d >= 0 && d <= 7) out.push({ id: `tdr-${t.id}-${label}-${date}`, cat: "tender", tone: d <= 2 ? "warn" : "accent", date, title: `${label} ${due(d)} · ${t.title}`, sub: `${t.id} · ${t.client}`, href });
        }
      }
      for (const [b, label] of [
        [t.bidBond, "หลักประกันซอง"],
        [t.award?.perfBond, "หลักประกันสัญญา"],
      ] as const) {
        if (!b?.expiry || b.returned) continue;
        const d = diff(b.expiry);
        if (d >= 0 && d <= 30) out.push({ id: `tdr-bond-${t.id}-${label}-${b.expiry}`, cat: "tender", tone: "warn", date: b.expiry, title: `${label}ใกล้หมดอายุ · ${t.title}`, sub: `${t.id} · ${b.bank ?? ""} ${b.ref ?? ""} · ${due(d)}`, href });
      }
      const a = t.award;
      if (!a) continue;
      if (!a.actualFinish && a.finish < TODAY) {
        const late = daysLate(a.finish, TODAY);
        out.push({ id: `tdr-late-${t.id}`, cat: "tender", tone: "neg", date: a.finish, title: `เกินกำหนดสัญญา ${late} วัน · ${t.title}`, sub: `${a.contractNo} · มีค่าปรับรายวัน ตรวจสอบการขยายเวลา`, href });
      }
      if (a.adjustable) {
        const f = s.kFormulas.find((x) => x.id === a.kFormulaId);
        if (!f) continue;
        for (const i of a.installments) {
          if (!i.paidDate || i.claimedDate) continue;
          const k = kValue(f, s.indices[i.month], s.indices[a.kBaseMonth], s.kDecimals);
          if (k.missing.length) continue;
          const adj = kAdjustment(k.k, i.amount, s.kThresholdPct);
          if (adj.applies && adj.amount > 0)
            out.push({ id: `tdr-k-${t.id}-${i.no}`, cat: "tender", tone: "accent", date: i.paidDate, title: `ยื่นขอเงินค่า K งวดที่ ${i.no} · ${t.title}`, sub: `K = ${k.k.toFixed(3)} · ประมาณ ฿${Math.round(adj.amount).toLocaleString("th-TH")} · ผู้รับจ้างต้องยื่นคำขอเอง`, href: `${href}?tab=k` });
        }
        const last = a.installments[a.installments.length - 1];
        if (last?.paidDate) {
          const end = kClaimDeadline(last.paidDate, s.kClaimDays);
          const d = diff(end);
          if (d >= 0 && d <= 30) out.push({ id: `tdr-kend-${t.id}`, cat: "tender", tone: "warn", date: end, title: `ใกล้หมดเวลายื่นค่า K · ${t.title}`, sub: `ภายใน ${s.kClaimDays} วันหลังรับเงินงวดสุดท้าย · ${due(d)}`, href: `${href}?tab=k` });
        }
      }
    }
    return out;
  }, [list, s]);
}

export function registerTenderNotes() {
  registerNotes({ cat: "tender", label: "ประมูลงาน", module: "tender", hint: "กำหนดยื่นซองใน 7 วัน หลักประกันใกล้หมด ค่า K ที่ยื่นขอได้ งานเกินกำหนดสัญญา", use: useTenderNotes });
}
