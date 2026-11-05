"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCheck, Circle, CircleCheck, Settings } from "lucide-react";
import { Page } from "@/components/shell/topbar";
import { Card, PageHeader, cx } from "@/components/ui";
import { Btn, Empty, I, Pill, Segmented, StatCard, useHydrated } from "@/components/ops/bits";
import { allCats, catMeta, daysFrom, markRead, markUnread, useNotifications, useReadIds, type Note, type NoteCat, type NoteTone } from "@/lib/notifications";

const GROUPS: { tone: NoteTone[]; label: string }[] = [
  { tone: ["neg"], label: "ด่วน · เลยกำหนดแล้ว" },
  { tone: ["warn"], label: "ใกล้ถึงกำหนด" },
  { tone: ["accent", "neutral"], label: "รอดำเนินการ / แจ้งให้ทราบ" },
];
const DOT: Record<NoteTone, string> = { neg: "bg-neg", warn: "bg-warn", accent: "bg-accent", neutral: "bg-ink-3" };

function when(n: Note) {
  const d = daysFrom(n.date);
  if (d === 0) return "วันนี้";
  if (d === 1) return "พรุ่งนี้";
  if (d === -1) return "เมื่อวาน";
  return d < 0 ? `${-d} วันก่อน` : `อีก ${d} วัน`;
}

export function NotificationsView() {
  const hydrated = useHydrated();
  const all = useNotifications();
  const read = useReadIds();
  const [cat, setCat] = useState<NoteCat | "all">("all");
  const [show, setShow] = useState<"all" | "unread">("all");

  const isRead = (n: Note) => read.includes(n.id);
  const counts = useMemo(() => {
    const c = new Map<NoteCat, { all: number; unread: number }>();
    for (const n of all) {
      const v = c.get(n.cat) ?? { all: 0, unread: 0 };
      v.all++;
      if (!read.includes(n.id)) v.unread++;
      c.set(n.cat, v);
    }
    return c;
  }, [all, read]);
  const list = all.filter((n) => (cat === "all" || n.cat === cat) && (show === "all" || !isRead(n)));
  const unread = all.filter((n) => !isRead(n)).length;
  const urgent = all.filter((n) => n.tone === "neg").length;
  const today = all.filter((n) => daysFrom(n.date) === 0).length;
  const visibleCats = allCats().filter((c) => counts.has(c));

  return (
    <Page trail={[{ label: "ผู้ดูแลระบบ" }, { label: "การแจ้งเตือน" }]}>
      <PageHeader
        title="การแจ้งเตือน"
        sub="รวมเรื่องที่ต้องติดตามจากทุกฝ่าย ตั้งแต่แจ้งซ่อมเกิน SLA ไปจนถึงบิลใกล้ครบกำหนดจ่าย เห็นเฉพาะเรื่องในโมดูลที่บทบาทของคุณเข้าถึงได้"
        actions={
          <>
            <Link href="/settings#notify" className="inline-flex h-9 items-center gap-2 rounded-[8px] border border-line-strong bg-card px-4 text-[14px] font-medium transition-colors duration-150 hover:bg-raised">
              <Settings {...I} />
              ตั้งค่าการแจ้งเตือน
            </Link>
            <Btn primary disabled={!unread} onClick={() => markRead(list.map((n) => n.id))}>
              <CheckCheck {...I} />
              อ่านทั้งหมด{cat !== "all" ? `ในหมวดนี้` : ""}
            </Btn>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 pb-6 xl:grid-cols-4">
        <StatCard label="ทั้งหมด" value={hydrated ? all.length : "–"} unit="เรื่อง" note={`${visibleCats.length} หมวด`} />
        <StatCard label="ยังไม่อ่าน" value={hydrated ? unread : "–"} unit="เรื่อง" active={show === "unread"} onClick={() => setShow(show === "unread" ? "all" : "unread")} note="คลิกเพื่อดูเฉพาะที่ยังไม่อ่าน" />
        <StatCard label="ด่วน" value={hydrated ? urgent : "–"} unit="เรื่อง" tone={urgent ? "neg" : undefined} note="เลยกำหนดหรือเกิน SLA แล้ว" />
        <StatCard label="ครบกำหนดวันนี้" value={hydrated ? today : "–"} unit="เรื่อง" note="นัดตรวจ งาน และกำหนดชำระของวันนี้" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <Card className="h-fit p-1.5">
          <nav aria-label="หมวดการแจ้งเตือน" className="flex flex-col">
            {[{ key: "all" as const, label: "ทั้งหมด", n: all.length, u: unread }, ...visibleCats.map((c) => ({ key: c, label: catMeta(c).label, n: counts.get(c)!.all, u: counts.get(c)!.unread }))].map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setCat(c.key)}
                aria-pressed={cat === c.key}
                className={cx("flex h-9 items-center justify-between gap-2 rounded-[8px] px-3 text-left text-[14px] transition-colors duration-150", cat === c.key ? "bg-raised text-ink" : "text-ink-2 hover:bg-raised hover:text-ink")}
              >
                <span className="truncate">{c.label}</span>
                <span className="flex items-center gap-1.5 font-mono text-[12px] text-ink-3">
                  {c.u > 0 && <span className="rounded-full bg-accent px-1.5 text-card">{c.u}</span>}
                  {c.n}
                </span>
              </button>
            ))}
          </nav>
        </Card>

        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <Segmented
              value={show}
              onChange={setShow}
              options={[
                { key: "all", label: "ทั้งหมด" },
                { key: "unread", label: `ยังไม่อ่าน ${unread}` },
              ]}
            />
            {cat !== "all" && <p className="text-[13px] text-ink-3">{catMeta(cat).hint}</p>}
          </div>

          {hydrated && list.length === 0 && (
            <Card>
              <Empty>{show === "unread" ? "อ่านครบทุกเรื่องแล้ว" : "ไม่มีเรื่องที่ต้องติดตามในหมวดนี้"}</Empty>
            </Card>
          )}

          {hydrated &&
            GROUPS.map((g) => {
              const items = list.filter((n) => g.tone.includes(n.tone));
              if (!items.length) return null;
              return (
                <Card key={g.label}>
                  <header className="flex items-baseline justify-between border-b border-line px-5 py-3">
                    <h2 className="text-[15px] font-medium">{g.label}</h2>
                    <span className="font-mono text-[12px] text-ink-3">{items.length} เรื่อง</span>
                  </header>
                  <ul>
                    {items.map((n) => {
                      const r = isRead(n);
                      return (
                        <li key={n.id} className="group flex items-start gap-3 border-t border-line px-5 py-3 first:border-t-0">
                          <span className={cx("mt-2 size-1.5 shrink-0 rounded-full", r ? "bg-line-strong" : DOT[n.tone])} />
                          <Link href={n.href} onClick={() => markRead([n.id])} className="min-w-0 flex-1">
                            <span className={cx("block text-[14px] hover:underline", r ? "text-ink-2" : "text-ink")}>{n.title}</span>
                            <span className="block truncate text-[12px] text-ink-3">{n.sub}</span>
                          </Link>
                          <div className="flex shrink-0 items-center gap-3">
                            <Pill>{catMeta(n.cat).label}</Pill>
                            <span className={cx("w-[72px] text-right font-mono text-[12px]", n.tone === "neg" ? "text-neg" : "text-ink-3")}>{when(n)}</span>
                            <button
                              type="button"
                              onClick={() => (r ? markUnread(n.id) : markRead([n.id]))}
                              aria-label={r ? "ทำเครื่องหมายว่ายังไม่อ่าน" : "ทำเครื่องหมายว่าอ่านแล้ว"}
                              title={r ? "ทำเครื่องหมายว่ายังไม่อ่าน" : "ทำเครื่องหมายว่าอ่านแล้ว"}
                              className="rounded-[6px] p-1 text-ink-3 transition-colors duration-150 hover:bg-raised hover:text-ink"
                            >
                              {r ? <Circle {...I} /> : <CircleCheck {...I} />}
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </Card>
              );
            })}
        </div>
      </div>
    </Page>
  );
}
