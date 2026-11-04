"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BarChart3, CalendarClock, ClipboardCheck, Download, ShieldCheck, TrendingUp, TriangleAlert } from "lucide-react";
import { Card, CardHead, cx } from "@/components/ui";
import { PrintButton } from "@/components/dashboard/print";
import { TODAY, thDate } from "@/lib/data";
import { BarChart, HBarList } from "./chart";
import { buildReport, CATALOGUE, PERIODS, periodStart, toCsv, type PeriodKey, type ReportKey } from "./reports-data";

const ICON: Record<ReportKey, typeof BarChart3> = {
  progress: BarChart3,
  quality: ClipboardCheck,
  repairs: TriangleAlert,
  maintenance: CalendarClock,
  warranty: ShieldCheck,
  sales: TrendingUp,
};

export function ReportsView() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const rRaw = sp.get("r");
  const r: ReportKey = CATALOGUE.some((c) => c.key === rRaw) ? (rRaw as ReportKey) : "progress";
  const pRaw = sp.get("p");
  const p: PeriodKey = PERIODS.some((x) => x.key === pRaw) ? (pRaw as PeriodKey) : "12m";
  const report = useMemo(() => buildReport(r, p), [r, p]);
  const meta = CATALOGUE.find((c) => c.key === r)!;
  const period = PERIODS.find((x) => x.key === p)!;

  const go = (next: { r?: ReportKey; p?: PeriodKey }) => {
    const q = new URLSearchParams(sp.toString());
    if (next.r) q.set("r", next.r);
    if (next.p) q.set("p", next.p);
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  };

  const exportCsv = () => {
    const blob = new Blob([toCsv(report.columns, report.rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `asbuilt-${r}-${p}-${TODAY}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <>
      <div data-noprint className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {CATALOGUE.map((c) => {
          const Icon = ICON[c.key];
          const active = c.key === r;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => go({ r: c.key })}
              aria-pressed={active}
              className={cx(
                "flex flex-col items-start gap-2 rounded-[14px] border p-4 text-left transition-colors duration-150",
                active ? "border-ink/40 bg-card shadow-[0_1px_2px_rgba(0,0,0,0.06)]" : "border-line bg-card/60 hover:bg-card",
              )}
            >
              <span className={cx("flex size-8 items-center justify-center rounded-[8px]", active ? "bg-accent-soft text-accent-text" : "bg-raised text-ink-2")}>
                <Icon size={16} strokeWidth={1.5} />
              </span>
              <span className="text-[14px] font-medium text-ink">{c.title}</span>
              <span className="line-clamp-2 text-[12px] leading-[18px] text-ink-3">{c.desc}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-[22px] font-normal leading-tight">รายงาน{meta.title}</h2>
          <p className="mt-1 font-mono text-[12px] text-ink-3">
            ช่วง {period.label} · {p === "all" ? "ทุกช่วงเวลา" : `${thDate(periodStart(p))} – ${thDate(TODAY)}`} · ข้อมูล ณ {thDate(TODAY)}
          </p>
        </div>
        <div data-noprint className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="ช่วงเวลา" className="flex h-9 items-center rounded-[8px] border border-line-strong bg-card p-0.5">
            {PERIODS.map((x) => (
              <button
                key={x.key}
                type="button"
                onClick={() => go({ p: x.key })}
                aria-pressed={x.key === p}
                className={cx("h-full rounded-[6px] px-3 text-[13px] transition-colors duration-150", x.key === p ? "bg-raised text-ink" : "text-ink-2 hover:text-ink")}
              >
                {x.label}
              </button>
            ))}
          </div>
          <PrintButton label="พิมพ์" />
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex h-9 items-center gap-2 rounded-[8px] bg-ink px-4 text-[14px] font-medium text-card transition-[background-color,transform] duration-150 hover:bg-[#3a332b] active:scale-[0.98]"
          >
            <Download size={16} strokeWidth={1.5} />
            ส่งออก CSV
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
        {report.summary.map((s) => (
          <Card key={s.label} className="px-5 py-4">
            <p className="text-[13px] text-ink-2">{s.label}</p>
            <p className="num mt-2 text-[26px] font-medium leading-none">{s.value}</p>
            {s.note && <p className="mt-2 text-[12px] text-ink-3">{s.note}</p>}
          </Card>
        ))}
      </div>

      <Card className="mt-4">
        <CardHead title={report.chartTitle} meta={report.hbars ? report.hbars.note : undefined} />
        <div className="px-5 py-5">
          {report.bars && (report.bars.data.some((d) => d.value > 0) ? <BarChart {...report.bars} /> : <p className="py-10 text-center text-ink-3">{report.empty}</p>)}
          {report.hbars && (report.hbars.data.length ? <HBarList data={report.hbars.data} /> : <p className="py-10 text-center text-ink-3">{report.empty}</p>)}
        </div>
      </Card>

      <Card className="mt-4 overflow-hidden">
        <CardHead title="ตารางข้อมูล" meta={`${report.rows.length} แถว`} />
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-[12px] text-ink-3">
                {report.columns.map((c, i) => (
                  <th key={c} className={cx("whitespace-nowrap px-4 py-2.5 font-normal", report.align?.[i] === "r" && "text-right")}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row, ri) => (
                <tr key={ri} className="border-b border-line last:border-0 hover:bg-raised/50">
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      className={cx(
                        "px-4 py-2.5",
                        ci === 0 ? "whitespace-nowrap font-mono text-[12px] text-ink-2" : "text-ink",
                        report.align?.[ci] === "r" && "num text-right font-mono text-[12px]",
                      )}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
              {!report.rows.length && (
                <tr>
                  <td colSpan={report.columns.length} className="px-4 py-10 text-center text-ink-3">
                    {report.empty}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
