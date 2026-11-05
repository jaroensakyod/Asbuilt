// Notification feeds of the design module (registered at import time from ./index).

import { useMemo } from "react";
import { TODAY, getProject } from "../data";
import { registerNotes, type Note } from "../notifications";
import { permitState, waitingDays, isStageLate } from "./calc";
import { isLowScore } from "./satisfaction";
import { designStages, permits, portalMessages, surveys, useDesignSettings } from "./store";
import { ASPECT_LABEL, SURVEY_ASPECTS, STAGE_LABEL } from "./types";

const pname = (id: string) => getProject(id)?.name ?? id;

function useDesignNotes(): Note[] {
  const stages = designStages.use();
  const s = useDesignSettings();
  return useMemo(() => {
    const out: Note[] = [];
    for (const st of stages) {
      const w = waitingDays(st, TODAY);
      if (w !== undefined && w > s.reviewAlertDays)
        out.push({ id: `ds-wait-${st.id}-${st.submittedAt}`, cat: "design", tone: "warn", date: st.submittedAt!, title: `แบบรอลูกค้าอนุมัติ ${w} วัน · ${pname(st.projectId)}`, sub: `ขั้น${STAGE_LABEL[st.key]} · ส่งเมื่อ ${st.submittedAt} · ติดตามลูกค้าผ่านพอร์ทัล`, href: `/design-stages/${st.projectId}` });
      else if (st.status === "changes_requested")
        out.push({ id: `ds-chg-${st.id}-${st.revisions}`, cat: "design", tone: "accent", date: TODAY, title: `ลูกค้าขอแก้ไขแบบ · ${pname(st.projectId)}`, sub: `ขั้น${STAGE_LABEL[st.key]} · แก้ไขครั้งที่ ${st.revisions}`, href: `/design-stages/${st.projectId}` });
      else if (isStageLate(st, TODAY) && st.status === "in_progress")
        out.push({ id: `ds-late-${st.id}`, cat: "design", tone: "neg", date: st.due, title: `งานออกแบบเลยกำหนด · ${pname(st.projectId)}`, sub: `ขั้น${STAGE_LABEL[st.key]} · กำหนด ${st.due} · ${st.architect}`, href: `/design-stages/${st.projectId}` });
    }
    return out;
  }, [stages, s.reviewAlertDays]);
}

function usePermitNotes(): Note[] {
  const list = permits.use();
  const s = useDesignSettings();
  return useMemo(() => {
    const out: Note[] = [];
    for (const p of list) {
      const st = permitState(p, TODAY, s);
      const href = `/permits/${p.projectId}`;
      if (st.flags.includes("expired")) out.push({ id: `pm-exp-${p.id}-${st.expiry}`, cat: "permits", tone: "neg", date: st.expiry!, title: `ใบอนุญาตก่อสร้างหมดอายุ · ${pname(p.projectId)}`, sub: `${p.permitNo ?? p.id} · หมดอายุ ${st.expiry} · ยื่นขอต่ออายุทันที`, href });
      else if (st.flags.includes("expiring")) out.push({ id: `pm-soon-${p.id}-${st.expiry}`, cat: "permits", tone: "warn", date: st.expiry!, title: `ใบอนุญาตก่อสร้างใกล้หมดอายุ · ${pname(p.projectId)}`, sub: `${p.permitNo ?? p.id} · อีก ${st.expiresIn} วัน · ${p.authorityName}`, href });
      if (st.flags.includes("stuck")) out.push({ id: `pm-stuck-${p.id}-${p.submittedAt}`, cat: "permits", tone: "warn", date: p.submittedAt!, title: `ยื่นขออนุญาตแล้ว ${st.pendingDays} วัน ยังไม่ได้รับ · ${pname(p.projectId)}`, sub: `${p.authorityName} · ยื่น ${p.submittedAt}`, href });
      const openQ = p.queries.filter((q) => !q.repliedAt);
      if (openQ.length) out.push({ id: `pm-q-${p.id}-${openQ[0].id}`, cat: "permits", tone: "accent", date: openQ[0].date, title: `เจ้าหน้าที่ขอข้อมูลเพิ่ม · ${pname(p.projectId)}`, sub: openQ[0].text.slice(0, 90), href });
    }
    return out;
  }, [list, s]);
}

function useCustomerNotes(): Note[] {
  const msgs = portalMessages.use();
  const srv = surveys.use();
  return useMemo(() => {
    const out: Note[] = [];
    const unread = new Map<string, { n: number; last: (typeof msgs)[number] }>();
    for (const m of msgs) {
      if (m.side !== "customer" || m.readAt) continue;
      const cur = unread.get(m.projectId);
      unread.set(m.projectId, { n: (cur?.n ?? 0) + 1, last: !cur || m.at > cur.last.at ? m : cur.last });
    }
    for (const [pid, { n, last }] of unread)
      out.push({ id: `msg-${last.id}`, cat: "customer", tone: "accent", date: last.at.slice(0, 10), title: `ข้อความใหม่จากลูกค้า${n > 1 ? ` ${n} ข้อความ` : ""} · ${pname(pid)}`, sub: `${last.author}: ${last.text.slice(0, 80)}`, href: `/projects/${pid}#messages` });
    for (const r of srv) {
      if (!isLowScore(r) || r.followedUp) continue;
      const bad = SURVEY_ASPECTS.filter((a) => (r.scores[a] ?? 5) <= 2).map((a) => ASPECT_LABEL[a]);
      out.push({ id: `srv-low-${r.id}`, cat: "customer", tone: "neg", date: r.at, title: `ลูกค้าให้คะแนนต่ำ · ${pname(r.projectId)}`, sub: `${r.trigger === "repair" ? `หลังปิดงานซ่อม ${r.repairId}` : "หลังส่งมอบบ้าน"} · ${bad.join(", ")} · โทรติดตาม`, href: `/projects/${r.projectId}#messages` });
    }
    return out;
  }, [msgs, srv]);
}

registerNotes({ cat: "design", label: "งานออกแบบ", module: "design", hint: "แบบที่รอลูกค้าอนุมัติเกินกำหนด ลูกค้าขอแก้ไข งานออกแบบเลยกำหนด", use: useDesignNotes });
registerNotes({ cat: "permits", label: "ใบอนุญาตก่อสร้าง", module: "design", hint: "ใบอนุญาตใกล้หมดอายุ ยื่นแล้วรอนานเกินกำหนด เจ้าหน้าที่ขอข้อมูลเพิ่ม", use: usePermitNotes });
registerNotes({ cat: "customer", label: "ข้อความ/ความพึงพอใจลูกค้า", module: "projects", hint: "ข้อความใหม่จากพอร์ทัลลูกค้า และแบบประเมินที่ได้คะแนน 2 หรือต่ำกว่า", use: useCustomerNotes });
