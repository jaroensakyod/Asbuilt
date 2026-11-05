// Notification feed for plant & equipment (module "plant").
import { useMemo } from "react";
import { getProject, TODAY } from "../data";
import { registerNotes, type Note } from "../notifications";
import { dueText } from "../safety/now";
import { certStates, doubleBookings } from "./calc";
import { plantBookings, plantCerts, plantMaint, plants, usePlantSettings } from "./store";
import { CERT_KIND_LABEL } from "./types";

const site = (id?: string) => (id ? (getProject(id)?.name ?? id) : "");

function usePlantNotes(): Note[] {
  const list = plants.use();
  const certs = plantCerts.use();
  const bookings = plantBookings.use();
  const maint = plantMaint.use();
  const s = usePlantSettings();
  return useMemo(() => {
    const out: Note[] = [];
    for (const p of list) {
      if (p.status === "off_hired") continue;
      for (const c of certStates(p, certs, TODAY, s)) {
        if (c.state === "ok") continue;
        out.push({
          id: `pct-${p.id}-${c.kind}-${c.cert?.expiry ?? "none"}`,
          cat: "plant",
          tone: c.state === "expiring" ? "warn" : "neg",
          date: c.cert?.expiry ?? TODAY,
          title: `${c.state === "missing" ? "ไม่มีใบรับรอง" : c.state === "expired" ? "ใบรับรองหมดอายุ" : "ใบรับรองใกล้หมดอายุ"} · ${p.name}`,
          sub: `${CERT_KIND_LABEL[c.kind]}${c.daysLeft !== undefined ? ` · ${dueText(c.daysLeft)}` : ""} · ${site(p.projectId)}`,
          href: `/plant/${p.id}`,
        });
      }
    }
    for (const [a, b] of doubleBookings(bookings)) {
      if (b.to < TODAY && a.to < TODAY) continue;
      const p = list.find((x) => x.id === a.plantId);
      out.push({ id: `pb-dup-${a.id}-${b.id}`, cat: "plant", tone: "neg", date: b.from, title: `จองเครื่องจักรซ้อนกัน · ${p?.name ?? a.plantId}`, sub: `${site(a.projectId)} (${a.from}) กับ ${site(b.projectId)} (${b.from})`, href: `/plant?tab=bookings&plant=${a.plantId}` });
    }
    for (const m of maint) {
      if (m.doneAt || m.kind === "service") continue;
      const p = list.find((x) => x.id === m.plantId);
      out.push({ id: `pmt-${m.id}`, cat: "plant", tone: "warn", date: m.date, title: `เครื่องจักรเสีย รอซ่อม · ${p?.name ?? m.plantId}`, sub: `${m.title} · ${site(p?.projectId)}`, href: `/plant/${m.plantId}` });
    }
    return out;
  }, [list, certs, bookings, maint, s]);
}

registerNotes({ cat: "plant", label: "เครื่องจักร", module: "plant", hint: "ใบรับรองปั้นจั่น/นั่งร้านใกล้หมด การจองซ้อน เครื่องจักรเสีย", use: usePlantNotes });
