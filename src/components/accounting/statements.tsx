"use client";

import { useMemo, useState } from "react";
import { Card, cx, inputCls } from "@/components/ui";
import { Segmented } from "@/components/ops/bits";
import { COMPANY_INFO } from "@/lib/data";
import { BOOKS_START, monthEnd, periodLabel, periodOf, periodsBetween, satang, thDateFull } from "@/lib/accounting/money";
import { balanceSheet, plByMonth, plByProject, trialBalance, type BsLine, type PlLine } from "@/lib/accounting/reports";
import { ACC_TODAY, useBooks } from "@/lib/accounting/store";
import { CsvButton, Labeled, Notice, Num, Pill, PrintArea, PrintButton, tableCls, td, tdR, th, thR, Toolbar } from "./bits";

function StatementHead({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="border-b border-line px-5 py-4 text-center">
      <p className="text-[14px] font-medium">{COMPANY_INFO.name}</p>
      <p className="text-[16px] font-medium">{title}</p>
      <p className="text-[13px] text-ink-2">{sub}</p>
    </div>
  );
}

// ---------- trial balance ----------

export function TrialBalanceView() {
  const { entries, accounts } = useBooks();
  const [from, setFrom] = useState(BOOKS_START);
  const [to, setTo] = useState(ACC_TODAY);
  const tb = useMemo(() => trialBalance(entries, accounts, { from, to }), [entries, accounts, from, to]);
  return (
    <>
      <Toolbar>
        <Labeled label="ตั้งแต่">
          <input type="date" className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} />
        </Labeled>
        <Labeled label="ถึง">
          <input type="date" className={inputCls} value={to} onChange={(e) => setTo(e.target.value)} />
        </Labeled>
        <div className="ml-auto flex gap-2">
          <CsvButton
            name={`trial-balance-${from}-${to}`}
            rows={() => [["รหัสบัญชี", "ชื่อบัญชี", "ยอดยกมา", "เดบิต", "เครดิต", "คงเหลือเดบิต", "คงเหลือเครดิต"], ...tb.rows.map((r) => [r.code, r.name, r.opening, r.debit, r.credit, Math.max(0, r.closing), Math.max(0, -r.closing)]), ["", "รวม", "", tb.totals.debit, tb.totals.credit, tb.totals.drBalance, tb.totals.crBalance]]}
          />
          <PrintButton />
        </div>
      </Toolbar>
      {!tb.balanced && <Notice tone="neg">งบทดลองไม่สมดุล ตรวจสอบรายการที่สมุดรายวัน</Notice>}
      <PrintArea>
        <Card>
          <StatementHead title="งบทดลอง" sub={`ตั้งแต่ ${thDateFull(from)} ถึง ${thDateFull(to)}`} />
          <div className="overflow-x-auto">
            <table className={tableCls}>
              <thead>
                <tr>
                  <th className={th}>รหัส</th>
                  <th className={th}>ชื่อบัญชี</th>
                  <th className={thR}>ยอดยกมา</th>
                  <th className={thR}>เดบิต</th>
                  <th className={thR}>เครดิต</th>
                  <th className={thR}>คงเหลือ เดบิต</th>
                  <th className={thR}>คงเหลือ เครดิต</th>
                </tr>
              </thead>
              <tbody>
                {tb.rows.map((r) => (
                  <tr key={r.code}>
                    <td className={cx(td, "font-mono")}>{r.code}</td>
                    <td className={td}>{r.name}</td>
                    <td className={tdR}>
                      <Num v={r.opening} acc />
                    </td>
                    <td className={tdR}>
                      <Num v={r.debit} acc />
                    </td>
                    <td className={tdR}>
                      <Num v={r.credit} acc />
                    </td>
                    <td className={tdR}>
                      <Num v={Math.max(0, r.closing)} acc />
                    </td>
                    <td className={tdR}>
                      <Num v={Math.max(0, -r.closing)} acc />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-medium">
                  <td className={td} />
                  <td className={td}>
                    รวม <Pill tone={tb.balanced ? "pos" : "neg"}>{tb.balanced ? "สมดุล" : "ไม่สมดุล"}</Pill>
                  </td>
                  <td className={tdR} />
                  <td className={tdR}>
                    <Num v={tb.totals.debit} strong />
                  </td>
                  <td className={tdR}>
                    <Num v={tb.totals.credit} strong />
                  </td>
                  <td className={tdR}>
                    <Num v={tb.totals.drBalance} strong />
                  </td>
                  <td className={tdR}>
                    <Num v={tb.totals.crBalance} strong />
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      </PrintArea>
    </>
  );
}

// ---------- profit and loss ----------

export function ProfitLossView() {
  const { entries, accounts, projectName } = useBooks();
  const [mode, setMode] = useState<"month" | "project">("month");
  const year = ACC_TODAY.slice(0, 4);
  const periods = useMemo(() => periodsBetween(periodOf(BOOKS_START) > `${year}-01` ? periodOf(BOOKS_START) : `${year}-01`, periodOf(ACC_TODAY)), [year]);
  const pl = useMemo(() => plByMonth(entries, accounts, periods), [entries, accounts, periods]);
  const projects = useMemo(() => plByProject(entries, { from: `${year}-01-01`, to: `${year}-12-31` }), [entries, year]);
  const total = (vals: number[]) => vals.reduce((s, v) => s + v, 0);
  const section = (title: string, lines: PlLine[], tot: number[]) => (
    <>
      <tr className="bg-raised/40">
        <td className={cx(td, "font-medium")} colSpan={periods.length + 2}>
          {title}
        </td>
      </tr>
      {lines.map((l) => (
        <tr key={l.code}>
          <td className={td}>
            <span className="mr-2 font-mono text-[12px] text-ink-3">{l.code}</span>
            {l.name}
          </td>
          {l.values.map((v, i) => (
            <td key={i} className={tdR}>
              <Num v={v} acc />
            </td>
          ))}
          <td className={tdR}>
            <Num v={l.total} acc strong />
          </td>
        </tr>
      ))}
      <tr>
        <td className={cx(td, "font-medium")}>รวม{title}</td>
        {tot.map((v, i) => (
          <td key={i} className={tdR}>
            <Num v={v} acc strong />
          </td>
        ))}
        <td className={tdR}>
          <Num v={total(tot)} acc strong />
        </td>
      </tr>
    </>
  );
  const sumRow = (label: string, vals: number[]) => (
    <tr className="border-t-2 border-line-strong">
      <td className={cx(td, "font-medium")}>{label}</td>
      {vals.map((v, i) => (
        <td key={i} className={tdR}>
          <Num v={v} acc strong />
        </td>
      ))}
      <td className={tdR}>
        <Num v={total(vals)} acc strong />
      </td>
    </tr>
  );
  const csvMonth = () => [
    ["รหัส", "รายการ", ...periods, "รวม"],
    ...[...pl.income, ...pl.cost, ...pl.sga].map((l) => [l.code, l.name, ...l.values, l.total]),
    ["", "กำไรขั้นต้น", ...pl.totals.gross, total(pl.totals.gross)],
    ["", "กำไร(ขาดทุน)สุทธิ", ...pl.totals.net, total(pl.totals.net)],
  ];
  return (
    <>
      <Toolbar>
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { key: "month", label: "รายเดือน" },
            { key: "project", label: "รายโครงการ" },
          ]}
        />
        <div className="ml-auto flex gap-2">
          <CsvButton name={`profit-loss-${mode}-${year}`} rows={() => (mode === "month" ? csvMonth() : [["โครงการ", "ชื่อ", "รายได้", "ต้นทุน", "กำไรขั้นต้น", "อัตรากำไร %"], ...projects.map((p) => [p.projectId, projectName(p.projectId), p.revenue, p.cost, p.profit, p.margin])])} />
          <PrintButton />
        </div>
      </Toolbar>
      <PrintArea>
        <Card>
          <StatementHead title={mode === "month" ? "งบกำไรขาดทุน" : "กำไรขั้นต้นรายโครงการ"} sub={`สำหรับงวด ${periodLabel(periods[0])} ถึง ${periodLabel(periods[periods.length - 1])} (ก่อนภาษีเงินได้นิติบุคคล)`} />
          <div className="overflow-x-auto">
            {mode === "month" ? (
              <table className={tableCls}>
                <thead>
                  <tr>
                    <th className={th}>รายการ</th>
                    {periods.map((p) => (
                      <th key={p} className={thR}>
                        {periodLabel(p)}
                      </th>
                    ))}
                    <th className={thR}>รวม</th>
                  </tr>
                </thead>
                <tbody>
                  {section("รายได้", pl.income, pl.totals.income)}
                  {section("ต้นทุนงานก่อสร้าง", pl.cost, pl.totals.cost)}
                  {sumRow("กำไรขั้นต้น", pl.totals.gross)}
                  {section("ค่าใช้จ่ายในการขายและบริหาร", pl.sga, pl.totals.sga)}
                  {sumRow("กำไร(ขาดทุน)สุทธิ", pl.totals.net)}
                </tbody>
              </table>
            ) : (
              <table className={tableCls}>
                <thead>
                  <tr>
                    <th className={th}>โครงการ</th>
                    <th className={thR}>รายได้ค่าก่อสร้าง</th>
                    <th className={thR}>ต้นทุนที่บันทึก</th>
                    <th className={thR}>กำไรขั้นต้น</th>
                    <th className={thR}>อัตรากำไร</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((p) => (
                    <tr key={p.projectId}>
                      <td className={td}>
                        {projectName(p.projectId)} <span className="font-mono text-[12px] text-ink-3">{p.projectId}</span>
                      </td>
                      <td className={tdR}>
                        <Num v={p.revenue} acc />
                      </td>
                      <td className={tdR}>
                        <Num v={p.cost} acc />
                      </td>
                      <td className={tdR}>
                        <Num v={p.profit} acc strong />
                      </td>
                      <td className={tdR}>{p.revenue ? <span className={cx("num font-mono", p.margin < 0 && "text-neg")}>{p.margin.toFixed(1)}%</span> : <span className="text-ink-3">–</span>}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-medium">
                    <td className={td}>รวมทุกโครงการ</td>
                    <td className={tdR}>
                      <Num v={projects.reduce((s, p) => s + p.revenue, 0)} strong />
                    </td>
                    <td className={tdR}>
                      <Num v={projects.reduce((s, p) => s + p.cost, 0)} strong />
                    </td>
                    <td className={tdR}>
                      <Num v={projects.reduce((s, p) => s + p.profit, 0)} strong />
                    </td>
                    <td className={tdR} />
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
          {mode === "project" && <p className="border-t border-line px-5 py-3 text-[12px] text-ink-3">รายได้รับรู้ตามงวดที่ออกใบแจ้งหนี้ ต้นทุนคือรายการที่ระบุโครงการ (ใบแจ้งหนี้ผู้ขาย ค่าใช้จ่ายหน้างาน ค่าแรง ค่าเสื่อมราคาเครื่องจักรที่ผูกโครงการ) ยังไม่ได้ปันส่วนค่าใช้จ่ายส่วนกลาง</p>}
        </Card>
      </PrintArea>
    </>
  );
}

// ---------- balance sheet ----------

export function BalanceSheetView() {
  const { entries, accounts } = useBooks();
  const [asOf, setAsOf] = useState(ACC_TODAY);
  const bs = useMemo(() => balanceSheet(entries, accounts, asOf), [entries, accounts, asOf]);
  const block = (title: string, lines: BsLine[], total: number, extra?: [string, number][]) => (
    <>
      <tr className="bg-raised/40">
        <td className={cx(td, "font-medium")} colSpan={2}>
          {title}
        </td>
      </tr>
      {lines.map((l) => (
        <tr key={l.code}>
          <td className={td}>
            <span className="mr-2 font-mono text-[12px] text-ink-3">{l.code}</span>
            {l.name}
          </td>
          <td className={tdR}>
            <Num v={l.amount} acc />
          </td>
        </tr>
      ))}
      {extra?.map(([k, v]) => (
        <tr key={k}>
          <td className={td}>{k}</td>
          <td className={tdR}>
            <Num v={v} acc />
          </td>
        </tr>
      ))}
      <tr>
        <td className={cx(td, "font-medium")}>รวม{title}</td>
        <td className={tdR}>
          <Num v={total} strong />
        </td>
      </tr>
    </>
  );
  const equityExtra: [string, number][] = [["กำไร(ขาดทุน)สุทธิปีปัจจุบัน", bs.currentProfit]];
  if (satang(bs.priorUnclosed)) equityExtra.push(["กำไร(ขาดทุน)ปีก่อนที่ยังไม่ปิดบัญชี", bs.priorUnclosed]);
  return (
    <>
      <Toolbar>
        <Labeled label="ณ วันที่">
          <input type="date" className={inputCls} value={asOf} onChange={(e) => setAsOf(e.target.value)} />
        </Labeled>
        <div className="ml-auto flex gap-2">
          <CsvButton
            name={`balance-sheet-${asOf}`}
            rows={() => [
              ["หมวด", "รหัส", "ชื่อบัญชี", "จำนวนเงิน"],
              ...bs.assets.map((l) => ["สินทรัพย์", l.code, l.name, l.amount]),
              ["", "", "รวมสินทรัพย์", bs.totalAssets],
              ...bs.liabilities.map((l) => ["หนี้สิน", l.code, l.name, l.amount]),
              ["", "", "รวมหนี้สิน", bs.totalLiabilities],
              ...bs.equity.map((l) => ["ส่วนของเจ้าของ", l.code, l.name, l.amount]),
              ...equityExtra.map(([k, v]) => ["ส่วนของเจ้าของ", "", k, v]),
              ["", "", "รวมส่วนของเจ้าของ", bs.totalEquity],
            ]}
          />
          <PrintButton />
        </div>
      </Toolbar>
      {!bs.balanced && <Notice tone="neg">งบไม่สมดุล สินทรัพย์ไม่เท่ากับหนี้สินรวมส่วนของเจ้าของ</Notice>}
      <PrintArea>
        <Card>
          <StatementHead title="งบแสดงฐานะการเงิน" sub={`ณ วันที่ ${thDateFull(asOf)} (ยังไม่ได้ตรวจสอบ)`} />
          <div className="grid grid-cols-1 gap-0 xl:grid-cols-2 xl:divide-x xl:divide-line">
            <table className={tableCls}>
              <tbody>{block("สินทรัพย์", bs.assets, bs.totalAssets)}</tbody>
            </table>
            <table className={tableCls}>
              <tbody>
                {block("หนี้สิน", bs.liabilities, bs.totalLiabilities)}
                {block("ส่วนของเจ้าของ", bs.equity, bs.totalEquity, equityExtra)}
                <tr className="border-t-2 border-line-strong">
                  <td className={cx(td, "font-medium")}>รวมหนี้สินและส่วนของเจ้าของ</td>
                  <td className={tdR}>
                    <Num v={bs.totalLiabilities + bs.totalEquity} strong />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="border-t border-line px-5 py-3 text-[13px]">
            <Pill tone={bs.balanced ? "pos" : "neg"}>{bs.balanced ? "สินทรัพย์ = หนี้สิน + ส่วนของเจ้าของ" : "ไม่สมดุล"}</Pill>
            <span className="ml-2 text-[12px] text-ink-3">ค่าเสื่อมราคาสะสมแสดงเป็นยอดติดลบในหมวดสินทรัพย์ · ณ {monthEnd(periodOf(asOf)) === asOf ? "สิ้นเดือน" : "ระหว่างเดือน"}</span>
          </p>
        </Card>
      </PrintArea>
    </>
  );
}
