"use client";

import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { Card, CardHead, cx, inputCls } from "@/components/ui";
import { accountName, type Account } from "@/lib/accounting/coa";
import { entryTotals, isBalanced } from "@/lib/accounting/journal";
import { BOOKS_START, fmt, monthEnd, periodOf, r2, satang, thDateSlash } from "@/lib/accounting/money";
import { generalLedger } from "@/lib/accounting/reports";
import { ACC_TODAY, isLockedDate, LOCKED_MSG, manualCol, useAccess, useBooks } from "@/lib/accounting/store";
import { SOURCE_LABEL, type JournalLine, type ManualJournal, type Source } from "@/lib/accounting/types";
import { Btn, CsvButton, Empty, I, Labeled, Modal, Notice, Num, numInput, PeriodSelect, Pill, tableCls, td, tdR, th, thR, Toolbar } from "./bits";

const postable = (accounts: Account[]) => accounts.filter((a) => !a.header && a.active).sort((a, b) => a.code.localeCompare(b.code));

export function JournalView() {
  const { entries, accounts, problems, projectName, locks } = useBooks();
  const manual = manualCol.use();
  const { edit } = useAccess();
  const [period, setPeriod] = useState(periodOf(ACC_TODAY));
  const [source, setSource] = useState<"" | Source>("");
  const [account, setAccount] = useState("");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [form, setForm] = useState<ManualJournal | "new" | null>(null);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return entries.filter(
      (e) =>
        (!period || e.period === period) &&
        (!source || e.source === source) &&
        (!account || e.lines.some((l) => l.account === account)) &&
        (!s || `${e.id} ${e.ref} ${e.memo}`.toLowerCase().includes(s)),
    );
  }, [entries, period, source, account, q]);
  const totals = useMemo(() => entryTotals(shown.flatMap((e) => e.lines)), [shown]);
  const toggle = (k: string) => setOpen((s) => (s.has(k) ? new Set([...s].filter((x) => x !== k)) : new Set([...s, k])));

  return (
    <>
      {problems.map((p) => (
        <Notice key={p.key} tone="neg">
          {p.text}
        </Notice>
      ))}
      <Toolbar>
        <Labeled label="งวด">
          <PeriodSelect value={period} onChange={setPeriod} allowAll />
        </Labeled>
        <Labeled label="ที่มา">
          <select className={inputCls} value={source} onChange={(e) => setSource(e.target.value as Source | "")}>
            <option value="">ทุกประเภท</option>
            {(Object.keys(SOURCE_LABEL) as Source[]).map((s) => (
              <option key={s} value={s}>
                {SOURCE_LABEL[s]}
              </option>
            ))}
          </select>
        </Labeled>
        <Labeled label="บัญชี">
          <select className={inputCls} value={account} onChange={(e) => setAccount(e.target.value)}>
            <option value="">ทุกบัญชี</option>
            {postable(accounts).map((a) => (
              <option key={a.code} value={a.code}>
                {a.code} {a.name}
              </option>
            ))}
          </select>
        </Labeled>
        <Labeled label="ค้นหา">
          <input className={inputCls} value={q} onChange={(e) => setQ(e.target.value)} placeholder="JV / เลขที่เอกสาร / คำอธิบาย" />
        </Labeled>
        <div className="ml-auto flex gap-2">
          <CsvButton
            name={`journal-${period || "all"}`}
            rows={() => [
              ["JV", "วันที่", "ที่มา", "เอกสาร", "คำอธิบาย", "รหัสบัญชี", "ชื่อบัญชี", "โครงการ", "เดบิต", "เครดิต"],
              ...shown.flatMap((e) => e.lines.map((l) => [e.id, e.date, SOURCE_LABEL[e.source], e.ref, e.memo, l.account, accountName(accounts, l.account), l.projectId ?? "", l.debit || "", l.credit || ""])),
            ]}
          />
          {edit && (
            <Btn small primary onClick={() => setForm("new")}>
              <Plus {...I} />
              บันทึกรายการปรับปรุง
            </Btn>
          )}
        </div>
      </Toolbar>

      <Card>
        <CardHead title="สมุดรายวันทั่วไป" meta={`${shown.length} รายการ · เดบิต ${fmt(totals.debit)} · เครดิต ${fmt(totals.credit)}`} />
        {shown.length ? (
          <div className="overflow-x-auto">
            <table className={tableCls}>
              <thead>
                <tr>
                  <th className={th} />
                  <th className={th}>วันที่</th>
                  <th className={th}>เลขที่ JV</th>
                  <th className={th}>ที่มา</th>
                  <th className={th}>เอกสาร / คำอธิบาย</th>
                  <th className={thR}>จำนวนเงิน</th>
                  <th className={th} />
                </tr>
              </thead>
              <tbody>
                {shown.slice(0, 400).map((e) => {
                  const isOpen = open.has(e.key);
                  const m = e.source === "manual" || e.source === "opening" ? manual.find((x) => `${e.source}:${x.id}` === e.key) : undefined;
                  return (
                    <Fragment key={e.key}>
                      <tr className="cursor-pointer hover:bg-raised/40" onClick={() => toggle(e.key)}>
                        <td className="w-8 px-2 py-2 text-ink-3">{isOpen ? <ChevronDown {...I} /> : <ChevronRight {...I} />}</td>
                        <td className={td}>
                          <span className="num font-mono">{thDateSlash(e.date)}</span>
                        </td>
                        <td className={td}>{e.id ? <span className="font-mono">{e.id}</span> : <span className="text-ink-3">รอเลข</span>}</td>
                        <td className={td}>
                          <Pill>{SOURCE_LABEL[e.source]}</Pill>
                        </td>
                        <td className={td}>
                          <span className="font-mono text-[12px] text-ink-3">{e.ref}</span> {e.memo}
                        </td>
                        <td className={tdR}>
                          <Num v={entryTotals(e.lines).debit} />
                        </td>
                        <td className={tdR} onClick={(ev) => ev.stopPropagation()}>
                          {m && edit && !isLockedDate(e.date, locks) && (
                            <Btn small onClick={() => setForm(m)}>
                              <Pencil {...I} />
                            </Btn>
                          )}
                        </td>
                      </tr>
                      {isOpen &&
                        e.lines.map((l, i) => (
                          <tr key={i} className="bg-raised/30 text-[12px]">
                            <td />
                            <td />
                            <td className={cx(td, "font-mono")}>{l.account}</td>
                            <td className={cx(td, l.credit ? "pl-8" : "")} colSpan={2}>
                              {accountName(accounts, l.account)}
                              {(l.projectId || l.memo) && (
                                <span className="ml-2 text-ink-3">
                                  {l.projectId ? projectName(l.projectId) : ""} {l.memo ?? ""}
                                </span>
                              )}
                            </td>
                            <td className={tdR}>
                              {l.debit ? <Num v={l.debit} /> : null}
                              {l.credit ? (
                                <span className="text-ink-2">
                                  Cr <Num v={l.credit} />
                                </span>
                              ) : null}
                            </td>
                            <td />
                          </tr>
                        ))}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>ไม่มีรายการ</Empty>
        )}
      </Card>
      {form && <ManualForm initial={form === "new" ? undefined : form} onClose={() => setForm(null)} />}
    </>
  );
}

type Row = JournalLine & { key: number };
let k = 0;
const blank = (): Row => ({ key: ++k, account: "", debit: 0, credit: 0 });

function ManualForm({ initial, onClose }: { initial?: ManualJournal; onClose: () => void }) {
  const { accounts, projects, locks } = useBooks();
  const { me } = useAccess();
  const [date, setDate] = useState(initial?.date ?? ACC_TODAY);
  const [memo, setMemo] = useState(initial?.memo ?? "");
  const [ref, setRef] = useState(initial?.ref ?? "");
  const [rows, setRows] = useState<Row[]>(() => (initial?.lines.length ? initial.lines.map((l) => ({ ...l, key: ++k })) : [blank(), blank()]));
  const set = (key: number, p: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));
  const lines: JournalLine[] = rows.filter((r) => r.account && (r.debit || r.credit)).map(({ account, debit, credit, projectId, memo }) => ({ account, debit: r2(debit), credit: r2(credit), projectId: projectId || undefined, memo: memo || undefined }));
  const t = entryTotals(lines);
  const diff = r2(t.debit - t.credit);
  const err =
    isLockedDate(date, locks) || (initial && isLockedDate(initial.date, locks))
      ? LOCKED_MSG
      : date < BOOKS_START && initial?.source !== "opening"
        ? "วันที่ก่อนเริ่มใช้ระบบบัญชี"
        : !memo.trim()
          ? "กรอกคำอธิบายรายการ"
          : rows.some((r) => r.debit && r.credit)
            ? "แต่ละบรรทัดใส่ได้ทั้งเดบิตหรือเครดิตอย่างใดอย่างหนึ่ง"
            : !isBalanced(lines)
              ? `เดบิตและเครดิตไม่เท่ากัน (ต่าง ${fmt(diff)})`
              : "";
  const save = () => {
    if (err) return;
    const id = initial?.id ?? manualCol.nextId("MJ-");
    manualCol.upsert({ id, date, memo: memo.trim(), ref: ref.trim() || undefined, source: initial?.source, lines, createdBy: initial?.createdBy ?? me.name });
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      width={980}
      title={initial ? `แก้ไขรายการ ${initial.id}` : "บันทึกรายการปรับปรุง (JV)"}
      footer={
        <>
          {err && <span className="mr-auto text-[13px] text-neg">{err}</span>}
          {initial && !isLockedDate(initial.date, locks) && (
            <Btn
              danger
              onClick={() => {
                if (window.confirm(`ลบรายการ ${initial.id} เลขที่ JV ของรายการนี้จะไม่ถูกนำกลับมาใช้`)) {
                  manualCol.remove(initial.id);
                  onClose();
                }
              }}
            >
              <Trash2 {...I} />
              ลบ
            </Btn>
          )}
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary disabled={!!err} onClick={save}>
            บันทึก
          </Btn>
        </>
      }
    >
      <div className="grid grid-cols-[160px_160px_1fr] gap-3">
        <Labeled label="วันที่">
          <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
        </Labeled>
        <Labeled label="เลขที่อ้างอิง">
          <input className={inputCls} value={ref} onChange={(e) => setRef(e.target.value)} />
        </Labeled>
        <Labeled label="คำอธิบาย">
          <input className={inputCls} value={memo} onChange={(e) => setMemo(e.target.value)} />
        </Labeled>
      </div>
      <div className="mt-4 overflow-x-auto rounded-[10px] border border-line">
        <table className={tableCls}>
          <thead>
            <tr className="bg-raised/60">
              <th className={th}>บัญชี</th>
              <th className={th}>โครงการ</th>
              <th className={th}>หมายเหตุ</th>
              <th className={thR}>เดบิต</th>
              <th className={thR}>เครดิต</th>
              <th className={th} />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <td className="px-2 py-1.5">
                  <select aria-label="บัญชี" className={cx(inputCls, "w-64")} value={r.account} onChange={(e) => set(r.key, { account: e.target.value })}>
                    <option value="">เลือกบัญชี</option>
                    {postable(accounts).map((a) => (
                      <option key={a.code} value={a.code}>
                        {a.code} {a.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-1.5">
                  <select aria-label="โครงการ" className={cx(inputCls, "w-40")} value={r.projectId ?? ""} onChange={(e) => set(r.key, { projectId: e.target.value || undefined })}>
                    <option value="">–</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.id}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-1.5">
                  <input aria-label="หมายเหตุ" className={cx(inputCls, "w-48")} value={r.memo ?? ""} onChange={(e) => set(r.key, { memo: e.target.value })} />
                </td>
                <td className="px-2 py-1.5">
                  <input aria-label="เดบิต" className={cx(numInput, "w-32")} inputMode="decimal" value={r.debit || ""} onChange={(e) => set(r.key, { debit: Number(e.target.value) || 0 })} />
                </td>
                <td className="px-2 py-1.5">
                  <input aria-label="เครดิต" className={cx(numInput, "w-32")} inputMode="decimal" value={r.credit || ""} onChange={(e) => set(r.key, { credit: Number(e.target.value) || 0 })} />
                </td>
                <td className="px-1">
                  <button type="button" aria-label="ลบแถว" disabled={rows.length <= 2} className="inline-flex size-8 items-center justify-center rounded-[8px] text-ink-3 hover:bg-raised hover:text-neg disabled:opacity-30" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}>
                    <Trash2 {...I} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className={td} colSpan={3}>
                <Btn small onClick={() => setRows((rs) => [...rs, blank()])}>
                  <Plus {...I} />
                  เพิ่มบรรทัด
                </Btn>
              </td>
              <td className={tdR}>
                <Num v={t.debit} strong />
              </td>
              <td className={tdR}>
                <Num v={t.credit} strong />
              </td>
              <td className={td}>
                <Pill tone={satang(diff) === 0 && t.debit > 0 ? "pos" : "neg"}>{satang(diff) === 0 && t.debit > 0 ? "สมดุล" : "ไม่สมดุล"}</Pill>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Modal>
  );
}

export function LedgerView() {
  const { entries, accounts, projectName } = useBooks();
  const [account, setAccount] = useState("1112");
  const [from, setFrom] = useState(BOOKS_START);
  const [to, setTo] = useState(monthEnd(periodOf(ACC_TODAY)));
  const gl = useMemo(() => generalLedger(entries, account, { from, to }), [entries, account, from, to]);
  const used = useMemo(() => new Set(entries.flatMap((e) => e.lines.map((l) => l.account))), [entries]);
  return (
    <>
      <Toolbar>
        <Labeled label="บัญชี">
          <select className={inputCls} value={account} onChange={(e) => setAccount(e.target.value)}>
            {postable(accounts)
              .filter((a) => used.has(a.code))
              .map((a) => (
                <option key={a.code} value={a.code}>
                  {a.code} {a.name}
                </option>
              ))}
          </select>
        </Labeled>
        <Labeled label="ตั้งแต่">
          <input type="date" className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} />
        </Labeled>
        <Labeled label="ถึง">
          <input type="date" className={inputCls} value={to} onChange={(e) => setTo(e.target.value)} />
        </Labeled>
        <div className="ml-auto">
          <CsvButton
            name={`gl-${account}-${from}-${to}`}
            rows={() => [["วันที่", "JV", "เอกสาร", "คำอธิบาย", "โครงการ", "เดบิต", "เครดิต", "ยอดคงเหลือ"], ["", "", "", "ยอดยกมา", "", "", "", gl.opening], ...gl.rows.map((r) => [r.entry.date, r.entry.id, r.entry.ref, r.memo, r.projectId ?? "", r.debit || "", r.credit || "", r.balance])]}
          />
        </div>
      </Toolbar>
      <Card>
        <CardHead title={`${account} ${accountName(accounts, account)}`} meta={`ยกมา ${fmt(gl.opening)} · เดบิต ${fmt(gl.debit)} · เครดิต ${fmt(gl.credit)} · คงเหลือ ${fmt(gl.closing)}`} />
        <div className="overflow-x-auto">
          <table className={tableCls}>
            <thead>
              <tr>
                <th className={th}>วันที่</th>
                <th className={th}>JV</th>
                <th className={th}>คำอธิบาย</th>
                <th className={thR}>เดบิต</th>
                <th className={thR}>เครดิต</th>
                <th className={thR}>ยอดคงเหลือ (Dr+)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={td} />
                <td className={td} />
                <td className={td}>ยอดยกมา</td>
                <td className={tdR} />
                <td className={tdR} />
                <td className={tdR}>
                  <Num v={gl.opening} acc />
                </td>
              </tr>
              {gl.rows.map((r, i) => (
                <tr key={i}>
                  <td className={td}>
                    <span className="num font-mono">{thDateSlash(r.entry.date)}</span>
                  </td>
                  <td className={td}>
                    <span className="font-mono">{r.entry.id || "รอเลข"}</span>
                    <span className="block font-mono text-[12px] text-ink-3">{r.entry.ref}</span>
                  </td>
                  <td className={td}>
                    {r.memo}
                    {r.projectId && <span className="block text-[12px] text-ink-3">{projectName(r.projectId)}</span>}
                  </td>
                  <td className={tdR}>{r.debit ? <Num v={r.debit} /> : null}</td>
                  <td className={tdR}>{r.credit ? <Num v={r.credit} /> : null}</td>
                  <td className={tdR}>
                    <Num v={r.balance} acc />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
