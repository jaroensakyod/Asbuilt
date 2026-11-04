"use client";

import { useMemo, useState } from "react";
import { Card, CardHead, cx, inputCls } from "@/components/ui";
import { A, accountName } from "@/lib/accounting/coa";
import { monthEnd, periodOf, r2, satang, thDateSlash } from "@/lib/accounting/money";
import { generalLedger } from "@/lib/accounting/reports";
import { parseSlipQr } from "@/lib/accounting/slip";
import { ACC_TODAY, arDocsCol, apPaymentsCol, bankMatchCol, statementsCol, useAccess, useBooks } from "@/lib/accounting/store";
import { SOURCE_LABEL } from "@/lib/accounting/types";
import { CsvButton, Empty, Labeled, Num, numInput, PeriodSelect, Pill, tableCls, td, tdR, th, thR, Toolbar } from "./bits";

const CASH_ACCOUNTS = [A.bank, A.petty, A.cash];

export function CashView() {
  const { entries, accounts } = useBooks();
  const matches = bankMatchCol.use();
  const statements = statementsCol.use();
  const { edit } = useAccess();
  const [account, setAccount] = useState<string>(A.bank);
  const [period, setPeriod] = useState(periodOf(ACC_TODAY));
  const from = `${period}-01`,
    to = monthEnd(period);
  const gl = useMemo(() => generalLedger(entries, account, { from, to }), [entries, account, from, to]);
  const cleared = useMemo(() => new Set(matches.filter((m) => m.cleared).map((m) => m.id)), [matches]);
  const lineId = (key: string, i: number) => `${account}|${key}|${i}`;

  // reconciliation as of the period end: book balance vs cleared items
  const recon = useMemo(() => {
    const all = generalLedger(entries, account, { to });
    const isCleared = (key: string, src: string, i: number) => src === "opening" || cleared.has(`${account}|${key}|${i}`);
    let clearedBal = 0;
    const open: typeof all.rows = [];
    const count = new Map<string, number>();
    for (const r of all.rows) {
      const i = count.get(r.entry.key) ?? 0;
      count.set(r.entry.key, i + 1);
      if (isCleared(r.entry.key, r.entry.source, i)) clearedBal += satang(r.debit) - satang(r.credit);
      else open.push(r);
    }
    return { book: all.closing, cleared: clearedBal / 100, open };
  }, [entries, account, to, cleared]);
  const stmtId = `${account}-${period}`;
  const stmt = statements.find((s) => s.id === stmtId);
  const diff = stmt ? r2(stmt.balance - recon.cleared) : null;

  const rowIndex = new Map<string, number>();
  return (
    <div className="flex flex-col gap-5">
      <Toolbar>
        <Labeled label="บัญชี">
          <select className={inputCls} value={account} onChange={(e) => setAccount(e.target.value)}>
            {CASH_ACCOUNTS.map((c) => (
              <option key={c} value={c}>
                {c} {accountName(accounts, c)}
              </option>
            ))}
          </select>
        </Labeled>
        <Labeled label="งวด">
          <PeriodSelect value={period} onChange={setPeriod} />
        </Labeled>
        <div className="ml-auto">
          <CsvButton
            name={`cashbook-${account}-${period}`}
            rows={() => [["วันที่", "JV", "เอกสาร", "ที่มา", "คำอธิบาย", "รับ", "จ่าย", "คงเหลือ"], ["", "", "", "", "ยอดยกมา", "", "", gl.opening], ...gl.rows.map((r) => [r.entry.date, r.entry.id, r.entry.ref, SOURCE_LABEL[r.entry.source], r.memo, r.debit, r.credit, r.balance])]}
          />
        </div>
      </Toolbar>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Card className="px-5 py-4">
          <p className="text-[13px] text-ink-2">ยอดยกมา</p>
          <p className="mt-2 text-[22px]"><Num v={gl.opening} /></p>
        </Card>
        <Card className="px-5 py-4">
          <p className="text-[13px] text-ink-2">รับ</p>
          <p className="mt-2 text-[22px]"><Num v={gl.debit} /></p>
        </Card>
        <Card className="px-5 py-4">
          <p className="text-[13px] text-ink-2">จ่าย</p>
          <p className="mt-2 text-[22px]"><Num v={gl.credit} /></p>
        </Card>
        <Card className="px-5 py-4">
          <p className="text-[13px] text-ink-2">คงเหลือสิ้นงวด</p>
          <p className="mt-2 text-[22px]"><Num v={gl.closing} strong /></p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 2xl:grid-cols-[1fr_380px]">
        <Card>
          <CardHead title={`สมุด${accountName(accounts, account)}`} meta={`${gl.rows.length} รายการ`} />
          {gl.rows.length ? (
            <div className="overflow-x-auto">
              <table className={tableCls}>
                <thead>
                  <tr>
                    <th className={th}>วันที่</th>
                    <th className={th}>เอกสาร</th>
                    <th className={th}>คำอธิบาย</th>
                    <th className={thR}>รับ</th>
                    <th className={thR}>จ่าย</th>
                    <th className={thR}>คงเหลือ</th>
                    {account === A.bank && <th className={th}>ตรง statement</th>}
                  </tr>
                </thead>
                <tbody>
                  {gl.rows.map((r) => {
                    const i = rowIndex.get(r.entry.key) ?? 0;
                    rowIndex.set(r.entry.key, i + 1);
                    const id = lineId(r.entry.key, i);
                    const on = r.entry.source === "opening" || cleared.has(id);
                    return (
                      <tr key={id}>
                        <td className={td}>
                          <span className="num font-mono">{thDateSlash(r.entry.date)}</span>
                        </td>
                        <td className={td}>
                          <span className="font-mono">{r.entry.ref}</span>
                          <span className="block font-mono text-[12px] text-ink-3">{r.entry.id || "รอเลข JV"}</span>
                        </td>
                        <td className={td}>
                          {r.memo}
                          <span className="block text-[12px] text-ink-3">{SOURCE_LABEL[r.entry.source]}</span>
                        </td>
                        <td className={tdR}>{r.debit ? <Num v={r.debit} /> : null}</td>
                        <td className={tdR}>{r.credit ? <Num v={r.credit} /> : null}</td>
                        <td className={tdR}>
                          <Num v={r.balance} />
                        </td>
                        {account === A.bank && (
                          <td className={td}>
                            <input
                              type="checkbox"
                              aria-label="ตรงกับ statement"
                              className="size-4 accent-[var(--accent)]"
                              checked={on}
                              disabled={!edit || r.entry.source === "opening"}
                              onChange={(e) => bankMatchCol.upsert({ id, cleared: e.target.checked, statementDate: e.target.checked ? r.entry.date : undefined })}
                            />
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>ไม่มีรายการในงวดนี้</Empty>
          )}
        </Card>

        <div className="flex flex-col gap-5">
          {account === A.bank && (
            <Card>
              <CardHead title="กระทบยอดเงินฝากธนาคาร" meta={`ณ ${thDateSlash(to)}`} />
              <div className="px-5 py-4 text-[13px]">
                <Labeled label="ยอดคงเหลือตาม statement ธนาคาร">
                  <input
                    className={numInput}
                    inputMode="decimal"
                    disabled={!edit}
                    defaultValue={stmt?.balance ?? ""}
                    key={stmtId}
                    onBlur={(e) => e.target.value !== "" && statementsCol.upsert({ id: stmtId, account, period, balance: r2(Number(e.target.value) || 0) })}
                  />
                </Labeled>
                <dl className="mt-4 flex flex-col gap-1.5">
                  <div className="flex justify-between">
                    <dt className="text-ink-2">ยอดตามบัญชี</dt>
                    <dd><Num v={recon.book} /></dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-ink-2">รายการที่ยังไม่ตรง ({recon.open.length})</dt>
                    <dd><Num v={r2(recon.book - recon.cleared)} acc /></dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-ink-2">ยอดที่กระทบแล้ว</dt>
                    <dd><Num v={recon.cleared} /></dd>
                  </div>
                  <div className="flex justify-between border-t border-line pt-1.5 font-medium">
                    <dt>ผลต่างกับ statement</dt>
                    <dd>{diff === null ? <span className="text-ink-3">ยังไม่กรอก</span> : <Pill tone={satang(diff) === 0 ? "pos" : "neg"}>{satang(diff) === 0 ? "ตรงกัน" : <Num v={diff} />}</Pill>}</dd>
                  </div>
                </dl>
                {recon.open.length > 0 && (
                  <ul className="mt-4 max-h-56 overflow-y-auto border-t border-line pt-2 text-[12px]">
                    {recon.open.slice(0, 40).map((r, k) => (
                      <li key={k} className="flex justify-between gap-2 py-1">
                        <span className="truncate text-ink-2">
                          {thDateSlash(r.entry.date)} {r.entry.ref}
                        </span>
                        <Num v={r.debit - r.credit} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>
          )}
          <SlipCheck />
        </div>
      </div>
    </div>
  );
}

/** Paste the text of a Thai bank-slip mini-QR to check its checksum and whether the reference was used before. */
function SlipCheck() {
  const [raw, setRaw] = useState("");
  const ar = arDocsCol.use();
  const ap = apPaymentsCol.use();
  const qr = raw.trim() ? parseSlipQr(raw) : null;
  const used = qr ? [...ar.map((d) => (d.kind === "receipt" ? d.note : "")), ...ap.map((p) => p.note)].some((n) => n?.includes(qr.transRef)) : false;
  return (
    <Card>
      <CardHead title="ตรวจ QR สลิปโอนเงิน" />
      <div className="px-5 py-4 text-[13px]">
        <Labeled label="ข้อความจาก QR บนสลิป">
          <input className={cx(inputCls, "font-mono")} value={raw} onChange={(e) => setRaw(e.target.value)} placeholder="0041000600000101030040220..." />
        </Labeled>
        {raw.trim() && (
          <p className="mt-3">
            {qr ? (
              <>
                <Pill tone={used ? "warn" : "pos"}>{used ? "เลขอ้างอิงนี้ถูกใช้แล้ว" : "สลิปถูกต้อง"}</Pill>
                <span className="ml-2 text-ink-2">
                  {qr.bankName} · Ref <span className="font-mono">{qr.transRef}</span>
                </span>
              </>
            ) : (
              <Pill tone="neg">ไม่ใช่ QR สลิปที่ถูกต้อง</Pill>
            )}
          </p>
        )}
        <p className="mt-3 text-[12px] text-ink-3">ใส่เลขอ้างอิงในช่องหมายเหตุตอนรับชำระหรือจ่ายเงิน เพื่อกันการใช้สลิปซ้ำ ยอดเงินในสลิปต้องตรวจด้วยตา</p>
      </div>
    </Card>
  );
}
