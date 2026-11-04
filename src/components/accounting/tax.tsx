"use client";

import { useMemo, useState } from "react";
import { FileCheck2, Printer, Undo2 } from "lucide-react";
import { Card, CardHead, cx, inputCls } from "@/components/ui";
import { Segmented } from "@/components/ops/bits";
import { A } from "@/lib/accounting/coa";
import { ssoDue, vatReturns, whtSummary } from "@/lib/accounting/journal";
import { addMonths, beYear, fmt, monthEnd, periodLabelFull, periodOf, r2, sum, thDateSlash } from "@/lib/accounting/money";
import { ACC_TODAY, certsCol, filingsCol, isLockedDate, LOCKED_MSG, useAccess, useBooks } from "@/lib/accounting/store";
import { type JournalEntry, type TaxFilingKind, type TaxMeta, type WhtCertificate, type WhtFormName, type WhtMeta } from "@/lib/accounting/types";
import { Btn, CsvButton, Empty, I, Labeled, Modal, Num, PeriodSelect, Pill, PrintSheet, tableCls, td, tdR, th, thR, Toolbar } from "./bits";
import { INCOME_ROW_LABEL, Wht50Doc } from "./docs";

type Tab = "pp30" | "pnd1" | "pnd3" | "pnd53" | "sso" | "cert" | "suffered";
const FORM: Record<"pnd1" | "pnd3" | "pnd53", WhtFormName> = { pnd1: "ภ.ง.ด.1", pnd3: "ภ.ง.ด.3", pnd53: "ภ.ง.ด.53" };
/** filing deadlines (paper): ภ.ง.ด. by the 7th, ภ.พ.30 and สปส. by the 15th of the next month (e-filing gets +8 days) */
const deadline = (kind: TaxFilingKind, period: string) => `${addMonths(period, 1)}-${kind.startsWith("pnd") ? "07" : "15"}`;

export function TaxView() {
  const { entries } = useBooks();
  const [tab, setTab] = useState<Tab>("pp30");
  const [period, setPeriod] = useState(addMonths(periodOf(ACC_TODAY), -1));
  return (
    <>
      <Toolbar>
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { key: "pp30", label: "ภ.พ.30" },
            { key: "pnd1", label: "ภ.ง.ด.1" },
            { key: "pnd3", label: "ภ.ง.ด.3" },
            { key: "pnd53", label: "ภ.ง.ด.53" },
            { key: "sso", label: "ประกันสังคม" },
            { key: "cert", label: "50 ทวิ" },
            { key: "suffered", label: "ภาษีถูกหัก" },
          ]}
        />
        <Labeled label="งวดภาษี" className="ml-auto">
          <PeriodSelect value={period} onChange={setPeriod} />
        </Labeled>
      </Toolbar>
      {tab === "pp30" && <Pp30 entries={entries} period={period} />}
      {(tab === "pnd1" || tab === "pnd3" || tab === "pnd53") && <Pnd entries={entries} period={period} kind={tab} />}
      {tab === "sso" && <Sso entries={entries} period={period} />}
      {tab === "cert" && <Certificates entries={entries} period={period} />}
      {tab === "suffered" && <Suffered entries={entries} />}
    </>
  );
}

function FilingBar({ kind, period, amount, note }: { kind: TaxFilingKind; period: string; amount: number; note?: string }) {
  const filings = filingsCol.use();
  const { locks } = useBooks();
  const { edit } = useAccess();
  const f = filings.find((x) => x.kind === kind && x.period === period);
  const due = deadline(kind, period);
  const [date, setDate] = useState(ACC_TODAY < due ? ACC_TODAY : due);
  const ended = monthEnd(period) < ACC_TODAY;
  const err = !ended ? "งวดนี้ยังไม่สิ้นเดือน" : isLockedDate(date, locks) ? LOCKED_MSG : date <= monthEnd(period) ? "วันที่ยื่นต้องอยู่หลังสิ้นงวด" : "";
  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-line px-5 py-3 text-[13px]">
      {f ? (
        <>
          <Pill tone="pos">บันทึกยื่นแล้ว {thDateSlash(f.paidDate)}</Pill>
          <span className="text-ink-2">
            ชำระ <Num v={f.amount} /> บาท
          </span>
          {edit && !isLockedDate(f.paidDate, locks) && (
            <Btn small onClick={() => filingsCol.remove(f.id)}>
              <Undo2 {...I} />
              ยกเลิกการบันทึก
            </Btn>
          )}
        </>
      ) : (
        <>
          <Pill tone={ACC_TODAY > due ? "neg" : "warn"}>
            {ACC_TODAY > due ? "เลยกำหนด" : "กำหนดยื่น"} {thDateSlash(due)}
          </Pill>
          {edit && (
            <>
              <input type="date" aria-label="วันที่ยื่นและชำระ" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
              <Btn small primary disabled={!!err} onClick={() => filingsCol.upsert({ id: `TAX-${kind}-${period}`, kind, period, paidDate: date, amount: r2(amount), account: A.bank })}>
                <FileCheck2 {...I} />
                บันทึกยื่นและชำระ {fmt(amount)} บาท
              </Btn>
              {err && <span className="text-ink-3">{err}</span>}
            </>
          )}
        </>
      )}
      {note && <span className="ml-auto text-[12px] text-ink-3">{note}</span>}
    </div>
  );
}

function VatList({ title, items, name }: { title: string; items: TaxMeta[]; name: string }) {
  return (
    <Card>
      <CardHead
        title={title}
        meta={`${items.length} รายการ · ฐาน ${fmt(sum(items.map((x) => x.base)))} · ภาษี ${fmt(sum(items.map((x) => x.vat)))}`}
        action={<CsvButton name={name} rows={() => [["ลำดับ", "วันที่", "เลขที่ใบกำกับภาษี", "ชื่อ", "เลขประจำตัวผู้เสียภาษี", "สาขา", "มูลค่า", "ภาษีมูลค่าเพิ่ม"], ...items.map((x, i) => [i + 1, x.date, x.docNo, x.party, x.taxId ?? "", x.branch ?? "", x.base, x.vat])]} />}
      />
      {items.length ? (
        <div className="overflow-x-auto">
          <table className={tableCls}>
            <thead>
              <tr>
                <th className={th}>วันที่</th>
                <th className={th}>เลขที่</th>
                <th className={th}>ชื่อผู้ซื้อ/ผู้ขาย</th>
                <th className={th}>เลขผู้เสียภาษี</th>
                <th className={thR}>มูลค่า</th>
                <th className={thR}>ภาษี</th>
              </tr>
            </thead>
            <tbody>
              {items.map((x, i) => (
                <tr key={i}>
                  <td className={td}>
                    <span className="num font-mono">{thDateSlash(x.date)}</span>
                  </td>
                  <td className={td}>
                    <span className="font-mono">{x.docNo}</span>
                  </td>
                  <td className={td}>
                    {x.party}
                    {x.branch && <span className="block text-[12px] text-ink-3">{x.branch}</span>}
                  </td>
                  <td className={td}>
                    <span className="font-mono text-[12px]">{x.taxId ?? "–"}</span>
                  </td>
                  <td className={tdR}>
                    <Num v={x.base} />
                  </td>
                  <td className={tdR}>
                    <Num v={x.vat} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>ไม่มีรายการ</Empty>
      )}
    </Card>
  );
}

function Pp30({ entries, period }: { entries: JournalEntry[]; period: string }) {
  const r = useMemo(() => vatReturns(entries, period).find((x) => x.period === period), [entries, period]);
  const items = useMemo(() => entries.filter((e) => e.period === period && e.source !== "closing").flatMap((e) => e.tax ?? []), [entries, period]);
  const output = items.filter((x) => x.kind === "output"),
    input = items.filter((x) => x.kind === "input");
  if (!r) return <Empty>ไม่มีข้อมูลงวดนี้</Empty>;
  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHead title={`ภ.พ.30 · ${periodLabelFull(period)}`} meta="แบบแสดงรายการภาษีมูลค่าเพิ่ม" />
        <dl className="grid grid-cols-2 gap-4 px-5 py-4 text-[13px] md:grid-cols-5">
          {(
            [
              ["ภาษีขาย", r.output],
              ["ภาษีซื้อ", r.input],
              ["ภาษีชำระเกินยกมา", r.creditIn],
              ["ภาษีที่ต้องชำระ", r.payable],
              ["ภาษีชำระเกินยกไป", r.creditOut],
            ] as const
          ).map(([k, v]) => (
            <div key={k}>
              <dt className="text-ink-3">{k}</dt>
              <dd className="mt-1 text-[20px]">
                <Num v={v} strong={k === "ภาษีที่ต้องชำระ"} />
              </dd>
            </div>
          ))}
        </dl>
        <FilingBar key={period} kind="pp30" period={period} amount={r.payable} note="ยอดขายและยอดซื้อจากรายงานภาษีด้านล่าง ตรวจกับใบกำกับภาษีจริงก่อนยื่น" />
      </Card>
      <VatList title="รายงานภาษีขาย" items={output} name={`output-vat-${period}`} />
      <VatList title="รายงานภาษีซื้อ" items={input} name={`input-vat-${period}`} />
    </div>
  );
}

function Pnd({ entries, period, kind }: { entries: JournalEntry[]; period: string; kind: "pnd1" | "pnd3" | "pnd53" }) {
  const s = useMemo(() => whtSummary(entries, period, FORM[kind]), [entries, period, kind]);
  return (
    <Card>
      <CardHead
        title={`${FORM[kind]} · ${periodLabelFull(period)}`}
        meta={`${s.items.length} ราย · เงินได้ ${fmt(s.base)} · ภาษี ${fmt(s.amount)}`}
        action={
          <CsvButton
            name={`${kind}-${period}`}
            rows={() => [["ลำดับ", "เลขประจำตัวผู้เสียภาษี", "ชื่อผู้มีเงินได้", "วันที่จ่าย", "ประเภทเงินได้", "อัตรา %", "จำนวนเงินที่จ่าย", "ภาษีที่หัก", "เอกสาร"], ...s.items.map((w, i) => [i + 1, w.taxId ?? "", w.payee, w.date, w.incomeType, w.rate, w.base, w.amount, w.docNo])]}
          />
        }
      />
      {s.items.length ? (
        <div className="overflow-x-auto">
          <table className={tableCls}>
            <thead>
              <tr>
                <th className={th}>ผู้มีเงินได้</th>
                <th className={th}>เลขผู้เสียภาษี</th>
                <th className={th}>วันที่จ่าย</th>
                <th className={th}>ประเภทเงินได้</th>
                <th className={thR}>อัตรา</th>
                <th className={thR}>เงินได้</th>
                <th className={thR}>ภาษีที่หัก</th>
              </tr>
            </thead>
            <tbody>
              {s.items.map((w) => (
                <tr key={w.key}>
                  <td className={td}>
                    {w.payee}
                    <span className="block font-mono text-[12px] text-ink-3">{w.docNo}</span>
                  </td>
                  <td className={td}>
                    <span className={cx("font-mono text-[12px]", !w.taxId && kind !== "pnd1" && "text-neg")}>{w.taxId ?? (kind === "pnd1" ? "ตามทะเบียนพนักงาน" : "ไม่มีเลข")}</span>
                  </td>
                  <td className={td}>
                    <span className="num font-mono">{thDateSlash(w.date)}</span>
                  </td>
                  <td className={td}>{w.incomeType}</td>
                  <td className={tdR}>{w.rate ? `${w.rate}%` : "อัตราก้าวหน้า"}</td>
                  <td className={tdR}>
                    <Num v={w.base} />
                  </td>
                  <td className={tdR}>
                    <Num v={w.amount} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>ไม่มีการหักภาษี ณ ที่จ่ายในงวดนี้</Empty>
      )}
      <FilingBar key={period} kind={kind} period={period} amount={s.amount} />
    </Card>
  );
}

function Sso({ entries, period }: { entries: JournalEntry[]; period: string }) {
  const due = useMemo(() => ssoDue(entries, period), [entries, period]);
  return (
    <Card>
      <CardHead title={`เงินสมทบประกันสังคม · ${periodLabelFull(period)}`} meta="สปส.1-10 (ส่วนลูกจ้าง + ส่วนนายจ้าง)" />
      <p className="px-5 py-4 text-[13px] text-ink-2">
        ยอดที่ต้องนำส่งตามรายการเงินเดือนงวดนี้ <Num v={due} strong /> บาท
      </p>
      <FilingBar key={period} kind="sso" period={period} amount={due} />
    </Card>
  );
}

function Certificates({ entries, period }: { entries: JournalEntry[]; period: string }) {
  const certs = certsCol.use();
  const { edit } = useAccess();
  const [all, setAll] = useState(false);
  const [issue, setIssue] = useState<WhtMeta | null>(null);
  const [print, setPrint] = useState<WhtCertificate | null>(null);
  const items = useMemo(
    () =>
      entries
        .flatMap((e) => e.wht ?? [])
        .filter((w) => w.form !== "ภ.ง.ด.1" && (all || periodOf(w.date) === period))
        .sort((a, b) => a.date.localeCompare(b.date)),
    [entries, period, all],
  );
  return (
    <Card>
      <CardHead
        title="หนังสือรับรองการหักภาษี ณ ที่จ่าย (50 ทวิ)"
        meta={`${items.length} รายการ · ออกแล้ว ${items.filter((w) => certs.some((c) => c.key === w.key)).length}`}
        action={
          <label className="flex items-center gap-2 text-[13px] text-ink-2">
            <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={all} onChange={(e) => setAll(e.target.checked)} />
            ทุกงวด
          </label>
        }
      />
      {items.length ? (
        <div className="overflow-x-auto">
          <table className={tableCls}>
            <thead>
              <tr>
                <th className={th}>วันที่จ่าย</th>
                <th className={th}>ผู้ถูกหัก</th>
                <th className={th}>แบบ</th>
                <th className={thR}>เงินได้</th>
                <th className={thR}>ภาษี</th>
                <th className={th}>เลขที่</th>
                <th className={th} />
              </tr>
            </thead>
            <tbody>
              {items.map((w) => {
                const c = certs.find((x) => x.key === w.key);
                return (
                  <tr key={w.key}>
                    <td className={td}>
                      <span className="num font-mono">{thDateSlash(w.date)}</span>
                    </td>
                    <td className={td}>
                      {w.payee}
                      <span className="block font-mono text-[12px] text-ink-3">{w.taxId ?? "ไม่มีเลขผู้เสียภาษี"}</span>
                    </td>
                    <td className={td}>{w.form}</td>
                    <td className={tdR}>
                      <Num v={w.base} />
                    </td>
                    <td className={tdR}>
                      <Num v={w.amount} />
                    </td>
                    <td className={td}>{c ? <span className="font-mono">{c.no}</span> : <span className="text-ink-3">ยังไม่ออก</span>}</td>
                    <td className={tdR}>
                      {c ? (
                        <Btn small onClick={() => setPrint(c)}>
                          <Printer {...I} />
                          พิมพ์
                        </Btn>
                      ) : (
                        edit && (
                          <Btn small onClick={() => setIssue(w)}>
                            ออก 50 ทวิ
                          </Btn>
                        )
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>ไม่มีรายการหัก ณ ที่จ่ายในงวดนี้</Empty>
      )}
      {issue && <IssueCert w={issue} onClose={() => setIssue(null)} onIssued={setPrint} />}
      <PrintSheet open={!!print} onClose={() => setPrint(null)} title={`50 ทวิ ${print?.no ?? ""}`}>
        {print && <Wht50Doc c={print} />}
      </PrintSheet>
    </Card>
  );
}

const defaultRow = (w: WhtMeta): WhtCertificate["incomeRow"] => (w.form === "ภ.ง.ด.1" ? "1" : "5");

function IssueCert({ w, onClose, onIssued }: { w: WhtMeta; onClose: () => void; onIssued: (c: WhtCertificate) => void }) {
  const certs = certsCol.use();
  const prev = certs.find((c) => c.payee === w.payee);
  const [address, setAddress] = useState(prev?.payeeAddress ?? "");
  const [branch, setBranch] = useState(prev?.payeeBranch ?? (w.form === "ภ.ง.ด.53" ? "สำนักงานใหญ่" : ""));
  const [row, setRow] = useState<WhtCertificate["incomeRow"]>(defaultRow(w));
  const [desc, setDesc] = useState(w.incomeType);
  const [payerMode, setPayerMode] = useState<WhtCertificate["payerMode"]>("withhold");
  const be = beYear(w.date);
  const save = () => {
    const id = certsCol.nextId(`WHT-${be}-`);
    const c: WhtCertificate = {
      id,
      no: `${be}/${id.slice(-4)}`,
      key: w.key,
      form: w.form,
      payee: w.payee,
      payeeTaxId: w.taxId,
      payeeAddress: address.trim() || undefined,
      payeeBranch: branch.trim() || undefined,
      incomeRow: row,
      incomeDesc: desc.trim(),
      date: w.date,
      base: w.base,
      rate: w.rate,
      amount: w.amount,
      payerMode,
      issuedAt: new Date().toISOString(),
    };
    certsCol.upsert(c);
    onClose();
    onIssued(c);
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`ออก 50 ทวิ · ${w.payee}`}
      footer={
        <>
          {!w.taxId && <span className="mr-auto text-[13px] text-neg">ผู้ถูกหักไม่มีเลขประจำตัวผู้เสียภาษี กรอกในเอกสารต้นทางก่อน</span>}
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary disabled={!w.taxId} onClick={save}>
            ออกเลขที่ {be}/....
          </Btn>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Labeled label="ที่อยู่ผู้ถูกหัก" className="col-span-2">
          <input className={inputCls} value={address} onChange={(e) => setAddress(e.target.value)} />
        </Labeled>
        <Labeled label="สาขา">
          <input className={inputCls} value={branch} onChange={(e) => setBranch(e.target.value)} />
        </Labeled>
        <Labeled label="ผู้จ่ายเงิน">
          <select className={inputCls} value={payerMode} onChange={(e) => setPayerMode(e.target.value as WhtCertificate["payerMode"])}>
            <option value="withhold">หัก ณ ที่จ่าย</option>
            <option value="always">ออกให้ตลอดไป</option>
            <option value="once">ออกให้ครั้งเดียว</option>
          </select>
        </Labeled>
        <Labeled label="ประเภทเงินได้ (แถวในแบบ)">
          <select className={inputCls} value={row} onChange={(e) => setRow(e.target.value as WhtCertificate["incomeRow"])}>
            {(Object.keys(INCOME_ROW_LABEL) as WhtCertificate["incomeRow"][]).map((k) => (
              <option key={k} value={k}>
                {INCOME_ROW_LABEL[k]}
              </option>
            ))}
          </select>
        </Labeled>
        <Labeled label="รายละเอียดเงินได้">
          <input className={inputCls} value={desc} onChange={(e) => setDesc(e.target.value)} />
        </Labeled>
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-3 rounded-[10px] bg-raised px-4 py-3 text-[13px]">
        <div>
          <dt className="text-ink-3">แบบ</dt>
          <dd>{w.form}</dd>
        </div>
        <div>
          <dt className="text-ink-3">เงินได้ที่จ่าย</dt>
          <dd><Num v={w.base} /></dd>
        </div>
        <div>
          <dt className="text-ink-3">ภาษีที่หัก {w.rate}%</dt>
          <dd><Num v={w.amount} strong /></dd>
        </div>
      </dl>
    </Modal>
  );
}

function Suffered({ entries }: { entries: JournalEntry[] }) {
  const items = useMemo(() => entries.flatMap((e) => e.whtSuffered ?? []).sort((a, b) => b.date.localeCompare(a.date)), [entries]);
  return (
    <Card>
      <CardHead
        title="ภาษีที่ลูกค้าหัก ณ ที่จ่าย (1157)"
        meta={`รวม ${fmt(sum(items.map((x) => x.amount)))} บาท · ใช้เครดิตภาษีเงินได้นิติบุคคล (ภ.ง.ด.50/51)`}
        action={<CsvButton name="wht-suffered" rows={() => [["วันที่", "ใบเสร็จ", "ผู้จ่ายเงิน", "เงินได้", "ภาษีถูกหัก"], ...items.map((x) => [x.date, x.docNo, x.payer, x.base, x.amount])]} />}
      />
      {items.length ? (
        <div className="overflow-x-auto">
          <table className={tableCls}>
            <thead>
              <tr>
                <th className={th}>วันที่</th>
                <th className={th}>ใบเสร็จ</th>
                <th className={th}>ลูกค้า</th>
                <th className={thR}>เงินได้</th>
                <th className={thR}>ภาษีถูกหัก</th>
              </tr>
            </thead>
            <tbody>
              {items.map((x) => (
                <tr key={x.docNo}>
                  <td className={td}>
                    <span className="num font-mono">{thDateSlash(x.date)}</span>
                  </td>
                  <td className={td}>
                    <span className="font-mono">{x.docNo}</span>
                  </td>
                  <td className={td}>{x.payer}</td>
                  <td className={tdR}>
                    <Num v={x.base} />
                  </td>
                  <td className={tdR}>
                    <Num v={x.amount} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>ยังไม่มีลูกค้าที่หักภาษี ณ ที่จ่าย</Empty>
      )}
      <p className="border-t border-line px-5 py-3 text-[12px] text-ink-3">ติดตามขอหนังสือรับรอง 50 ทวิ ตัวจริงจากลูกค้าทุกรายการ เพื่อใช้เป็นหลักฐานเครดิตภาษี</p>
    </Card>
  );
}
