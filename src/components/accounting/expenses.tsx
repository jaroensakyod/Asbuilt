"use client";
// ค่าใช้จ่าย — port of ZettaFlow's expense form: item lines with per-row discounts, document discount,
// VAT included / excluded / none, withholding, and a live journal preview that must balance before saving.

import { useMemo, useState } from "react";
import { Ban, Pencil, Plus, Trash2, Wallet } from "lucide-react";
import { Card, CardHead, cx, inputCls } from "@/components/ui";
import { COST_CODES } from "@/lib/biz";
import { A, accountName } from "@/lib/accounting/coa";
import { categoryOf, expenseCategoryGroups } from "@/lib/accounting/categories";
import { buildExpenseJournal, PAID_FROM } from "@/lib/accounting/ledger";
import { BOOKS_START, docPrefix, fmt, periodLabelFull, periodOf, thDateSlash } from "@/lib/accounting/money";
import { afterDiscount, docTypes, FULL_TAX_INVOICE, lineAmount, linesTotal, payStatuses, validTaxId, vatModes, whtRates, type Line, type VatMode } from "@/lib/accounting/tax";
import { ACC_TODAY, expensesCol, isLockedDate, LOCKED_MSG, useAccess, useBooks } from "@/lib/accounting/store";
import type { Expense } from "@/lib/accounting/types";
import { Btn, CsvButton, Empty, I, Labeled, Modal, Num, numInput, PeriodSelect, Pill, tableCls, td, tdR, th, thR, Toolbar } from "./bits";

const PAY_LABEL: Record<string, string> = { โอนแล้ว: "โอนแล้ว (1112)", เงินสดย่อย: "เงินสดย่อย (1113)", เงินสด: "เงินสด (1111)", ยังไม่จ่าย: "ยังไม่จ่าย (ตั้งเจ้าหนี้ 2111)" };

export function ExpensesView() {
  const { accounts, projectName, projects, locks } = useBooks();
  const list = expensesCol.use();
  const { edit } = useAccess();
  const [period, setPeriod] = useState(periodOf(ACC_TODAY));
  const [cat, setCat] = useState("");
  const [project, setProject] = useState("");
  const [form, setForm] = useState<Expense | "new" | null>(null);

  const shown = useMemo(
    () =>
      list
        .filter((x) => (!period || x.date.startsWith(period)) && (!cat || x.category === cat) && (!project || x.projectId === project))
        .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)),
    [list, period, cat, project],
  );
  const calc = (x: Expense) => buildExpenseJournal(x, accounts).calc;
  const totals = (() => {
    let gross = 0,
      vat = 0,
      wht = 0;
    for (const x of shown) {
      if (x.status === "void") continue;
      const c = calc(x);
      gross += c.gross;
      vat += c.claimable;
      wht += c.wht;
    }
    return { gross, vat, wht };
  })();

  return (
    <>
      <Toolbar>
        <Labeled label="งวด">
          <PeriodSelect value={period} onChange={setPeriod} allowAll />
        </Labeled>
        <Labeled label="หมวด">
          <select className={inputCls} value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">ทุกหมวด</option>
            {expenseCategoryGroups.map((g) => (
              <optgroup key={g.name} label={g.name}>
                {g.items.map((c) => (
                  <option key={c.name}>{c.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </Labeled>
        <Labeled label="โครงการ">
          <select className={inputCls} value={project} onChange={(e) => setProject(e.target.value)}>
            <option value="">ทุกโครงการ</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id} {p.name}
              </option>
            ))}
          </select>
        </Labeled>
        <div className="ml-auto flex gap-2">
          <CsvButton
            name={`expenses-${period || "all"}`}
            rows={() => [
              ["เลขที่", "วันที่", "ผู้รับเงิน", "เลขผู้เสียภาษี", "หมวด", "บัญชี", "ประเภทเอกสาร", "เลขที่เอกสาร", "โครงการ", "ก่อน VAT", "VAT", "ภาษีซื้อขอคืนได้", "หัก ณ ที่จ่าย", "จ่ายสุทธิ", "การจ่าย", "สถานะ"],
              ...shown.map((x) => {
                const j = buildExpenseJournal(x, accounts);
                return [x.id, x.date, x.payee, x.payeeTaxId ?? "", x.category, j.lines[0]?.account ?? "", x.docType, x.docNo ?? "", x.projectId ?? "", j.calc.base, j.calc.vat, j.calc.claimable, j.calc.wht, j.calc.net, x.payStatus, x.status === "void" ? "ยกเลิก" : "บันทึกแล้ว"];
              }),
            ]}
          />
          {edit && (
            <Btn primary small onClick={() => setForm("new")}>
              <Plus {...I} />
              บันทึกค่าใช้จ่าย
            </Btn>
          )}
        </div>
      </Toolbar>

      <Card>
        <CardHead title={period ? `ใบเสร็จ/ค่าใช้จ่าย ${periodLabelFull(period)}` : "ใบเสร็จ/ค่าใช้จ่ายทั้งหมด"} meta={`${shown.length} รายการ · ${fmt(totals.gross)} บาท · ภาษีซื้อ ${fmt(totals.vat)} · หัก ณ ที่จ่าย ${fmt(totals.wht)}`} />
        {shown.length ? (
          <div className="overflow-x-auto">
            <table className={tableCls}>
              <thead>
                <tr>
                  <th className={th}>เลขที่</th>
                  <th className={th}>ผู้รับเงิน / หมวด</th>
                  <th className={th}>เอกสาร</th>
                  <th className={th}>โครงการ</th>
                  <th className={thR}>ยอดตามเอกสาร</th>
                  <th className={thR}>ภาษีซื้อ</th>
                  <th className={thR}>หัก ณ ที่จ่าย</th>
                  <th className={th}>การจ่าย</th>
                  <th className={th} />
                </tr>
              </thead>
              <tbody>
                {shown.slice(0, 200).map((x) => {
                  const c = calc(x);
                  const locked = isLockedDate(x.date, locks);
                  return (
                    <tr key={x.id} className={x.status === "void" ? "opacity-50" : undefined}>
                      <td className={td}>
                        <span className="font-mono">{x.id}</span>
                        <span className="block font-mono text-[12px] text-ink-3">{thDateSlash(x.date)}</span>
                      </td>
                      <td className={td}>
                        {x.payee}
                        <span className="block text-[12px] text-ink-3">{x.category}</span>
                      </td>
                      <td className={td}>
                        <span className="text-[12px]">{x.docType}</span>
                        {x.docNo && <span className="block font-mono text-[12px] text-ink-3">{x.docNo}</span>}
                      </td>
                      <td className={td}>{x.projectId ? <span className="font-mono text-[12px]">{x.projectId}</span> : <span className="text-ink-3">สำนักงาน</span>}</td>
                      <td className={tdR}>
                        <Num v={c.gross} />
                      </td>
                      <td className={tdR}>
                        <Num v={c.claimable} acc />
                      </td>
                      <td className={tdR}>
                        <Num v={c.wht} acc />
                      </td>
                      <td className={td}>
                        {x.status === "void" ? (
                          <Pill>ยกเลิก</Pill>
                        ) : x.payStatus === "ยังไม่จ่าย" ? (
                          x.paidDate ? (
                            <Pill tone="pos">จ่ายแล้ว {thDateSlash(x.paidDate)}</Pill>
                          ) : (
                            <Pill tone="warn">ค้างจ่าย</Pill>
                          )
                        ) : (
                          <Pill>{x.payStatus}</Pill>
                        )}
                      </td>
                      <td className={tdR}>
                        {edit && x.status !== "void" && (
                          <div className="flex justify-end gap-1">
                            {x.payStatus === "ยังไม่จ่าย" && !x.paidDate && !isLockedDate(ACC_TODAY, locks) && (
                              <Btn small onClick={() => expensesCol.upsert({ ...x, paidDate: ACC_TODAY, paidAccount: A.bank })}>
                                <Wallet {...I} />
                                จ่าย
                              </Btn>
                            )}
                            {!locked && (
                              <Btn small onClick={() => setForm(x)}>
                                <Pencil {...I} />
                              </Btn>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>ไม่มีรายการในเงื่อนไขนี้</Empty>
        )}
      </Card>
      {form && <ExpenseForm initial={form === "new" ? undefined : form} onClose={() => setForm(null)} locks={locks} projectName={projectName} />}
    </>
  );
}

type Row = Line & { key: number };
let rowKey = 0;
const stripKey = (r: Row): Line => ({ name: r.name, qty: r.qty, price: r.price, unit: r.unit, discount: r.discount, discountType: r.discountType });
const blankRow = (): Row => ({ key: ++rowKey, name: "", qty: 1, price: 0, unit: "", discount: 0, discountType: "percent" });

function ExpenseForm({ initial, onClose, locks, projectName }: { initial?: Expense; onClose: () => void; locks: ReturnType<typeof useBooks>["locks"]; projectName: (id?: string) => string }) {
  const { accounts, projects } = useBooks();
  const [d, setD] = useState<Expense>(
    () =>
      initial ?? {
        id: "",
        date: ACC_TODAY,
        payee: "",
        category: "วัสดุก่อสร้าง",
        docType: FULL_TAX_INVOICE,
        vatMode: "included",
        whtRate: 0,
        amount: 0,
        payStatus: "โอนแล้ว",
        status: "posted",
      },
  );
  const [rows, setRows] = useState<Row[]>(() => (initial?.lines?.length ? initial.lines.map((l) => ({ ...l, key: ++rowKey })) : [{ ...blankRow(), price: initial?.amount ?? 0, name: initial?.category ?? "" }]));
  const set = <K extends keyof Expense>(k: K, v: Expense[K]) => setD((x) => ({ ...x, [k]: v }));
  const setRow = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const subtotal = linesTotal(rows);
  const { off, after } = afterDiscount(subtotal, d.discount ?? 0, d.discountType ?? "amount");
  const draft: Expense = { ...d, amount: after, lines: rows.map(stripKey) };
  const j = buildExpenseJournal(draft, accounts);
  const cat = categoryOf(d.category);
  const postable = accounts.filter((a) => a.active && !a.header && (a.type === "expense" || a.code.startsWith("11") || a.code.startsWith("12")));

  const lockedNew = isLockedDate(d.date, locks);
  const lockedOld = initial ? isLockedDate(initial.date, locks) : false;
  const err =
    lockedNew || lockedOld
      ? LOCKED_MSG
      : d.date < BOOKS_START
        ? "วันที่ก่อนเริ่มใช้ระบบบัญชี"
        : !d.payee.trim()
          ? "กรอกชื่อผู้รับเงิน"
          : d.payeeTaxId && !validTaxId(d.payeeTaxId)
            ? "เลขประจำตัวผู้เสียภาษีไม่ถูกต้อง"
            : d.whtRate > 0 && !d.payeeTaxId
              ? "หัก ณ ที่จ่ายต้องมีเลขประจำตัวผู้เสียภาษีของผู้รับเงิน (สำหรับ 50 ทวิ)"
              : !j.balanced
                ? "เดบิตและเครดิตไม่เท่ากัน หรือยอดเป็นศูนย์"
                : "";

  const save = () => {
    if (err) return;
    const id = initial?.id || expensesCol.nextId(docPrefix("EX", d.date));
    expensesCol.upsert({ ...draft, id, payee: d.payee.trim(), payeeTaxId: d.payeeTaxId?.replace(/\D/g, "") || undefined, costCode: cat?.site ? d.costCode : undefined, projectId: d.projectId || undefined });
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      width={1080}
      title={initial ? `แก้ไขค่าใช้จ่าย ${initial.id}` : "บันทึกค่าใช้จ่าย"}
      footer={
        <>
          {err && <span className="mr-auto text-[13px] text-neg">{err}</span>}
          {initial && initial.status !== "void" && !lockedOld && (
            <Btn
              danger
              onClick={() => {
                if (window.confirm(`ยกเลิกรายการ ${initial.id} เลขที่นี้จะไม่ถูกนำกลับมาใช้อีก`)) {
                  expensesCol.upsert({ ...initial, status: "void" });
                  onClose();
                }
              }}
            >
              <Ban {...I} />
              ยกเลิกรายการ
            </Btn>
          )}
          <Btn onClick={onClose}>ปิด</Btn>
          <Btn primary disabled={!!err} onClick={save}>
            บันทึกและลงบัญชี
          </Btn>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Labeled label="วันที่">
              <input type="date" className={inputCls} value={d.date} onChange={(e) => set("date", e.target.value)} />
            </Labeled>
            <Labeled label="ประเภทเอกสาร">
              <select className={inputCls} value={d.docType} onChange={(e) => set("docType", e.target.value)}>
                {docTypes.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Labeled>
            <Labeled label="เลขที่เอกสาร">
              <input className={inputCls} value={d.docNo ?? ""} onChange={(e) => set("docNo", e.target.value)} />
            </Labeled>
            <Labeled label="หมวดค่าใช้จ่าย">
              <select
                className={inputCls}
                value={d.category}
                onChange={(e) => {
                  const c = categoryOf(e.target.value);
                  setD((x) => ({ ...x, category: e.target.value, whtRate: c?.wht ?? 0, accountCode: undefined }));
                }}
              >
                {expenseCategoryGroups.map((g) => (
                  <optgroup key={g.name} label={g.name}>
                    {g.items.map((c) => (
                      <option key={c.name}>{c.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </Labeled>
            <Labeled label="บัญชี (ปรับได้)">
              <select className={inputCls} value={d.accountCode ?? ""} onChange={(e) => set("accountCode", e.target.value || undefined)}>
                <option value="">ตามหมวด · {j.lines[0]?.account}</option>
                {postable.map((a) => (
                  <option key={a.code} value={a.code}>
                    {a.code} {a.name}
                  </option>
                ))}
              </select>
            </Labeled>
            <Labeled label="การจ่ายเงิน">
              <select className={inputCls} value={d.payStatus} onChange={(e) => set("payStatus", e.target.value as Expense["payStatus"])}>
                {payStatuses.map((p) => (
                  <option key={p} value={p}>
                    {PAY_LABEL[p]}
                  </option>
                ))}
              </select>
            </Labeled>
            <Labeled label="โครงการ">
              <select className={inputCls} value={d.projectId ?? ""} onChange={(e) => set("projectId", e.target.value || undefined)}>
                <option value="">สำนักงาน (ไม่ระบุโครงการ)</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.id} {p.name}
                  </option>
                ))}
              </select>
            </Labeled>
            {cat?.site && (
              <Labeled label="หมวดต้นทุน (cost code)">
                <select className={inputCls} value={d.costCode ?? ""} onChange={(e) => set("costCode", e.target.value || undefined)}>
                  <option value="">ไม่ระบุ</option>
                  {Object.entries(COST_CODES).map(([k, v]) => (
                    <option key={k} value={k}>
                      {k} {v}
                    </option>
                  ))}
                </select>
              </Labeled>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Labeled label="ผู้รับเงิน / ผู้ขาย" className="md:col-span-1">
              <input className={inputCls} value={d.payee} onChange={(e) => set("payee", e.target.value)} />
            </Labeled>
            <Labeled label="เลขประจำตัวผู้เสียภาษี">
              <input className={cx(inputCls, "font-mono")} value={d.payeeTaxId ?? ""} onChange={(e) => set("payeeTaxId", e.target.value)} placeholder="13 หลัก" />
            </Labeled>
            <Labeled label="สาขา">
              <input className={inputCls} value={d.payeeBranch ?? ""} onChange={(e) => set("payeeBranch", e.target.value)} placeholder="สำนักงานใหญ่" />
            </Labeled>
          </div>

          <div className="overflow-x-auto rounded-[10px] border border-line">
            <table className={tableCls}>
              <thead>
                <tr className="bg-raised/60">
                  <th className={th}>รายการ</th>
                  <th className={thR}>จำนวน</th>
                  <th className={th}>หน่วย</th>
                  <th className={thR}>ราคา/หน่วย</th>
                  <th className={thR}>ส่วนลด</th>
                  <th className={thR}>จำนวนเงิน</th>
                  <th className={th} />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key}>
                    <td className="px-2 py-1.5">
                      <input aria-label="รายการ" className={cx(inputCls, "w-full min-w-[180px]")} value={r.name} onChange={(e) => setRow(r.key, { name: e.target.value })} />
                    </td>
                    <td className="px-2 py-1.5">
                      <input aria-label="จำนวน" className={cx(numInput, "w-20")} inputMode="decimal" value={r.qty} onChange={(e) => setRow(r.key, { qty: Number(e.target.value) || 0 })} />
                    </td>
                    <td className="px-2 py-1.5">
                      <input aria-label="หน่วย" className={cx(inputCls, "w-20")} value={r.unit ?? ""} onChange={(e) => setRow(r.key, { unit: e.target.value })} />
                    </td>
                    <td className="px-2 py-1.5">
                      <input aria-label="ราคา" className={cx(numInput, "w-28")} inputMode="decimal" value={r.price} onChange={(e) => setRow(r.key, { price: Number(e.target.value) || 0 })} />
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex gap-1">
                        <input aria-label="ส่วนลด" className={cx(numInput, "w-20")} inputMode="decimal" value={r.discount ?? 0} onChange={(e) => setRow(r.key, { discount: Number(e.target.value) || 0 })} />
                        <select aria-label="หน่วยส่วนลด" className={cx(inputCls, "w-16 px-2")} value={r.discountType ?? "percent"} onChange={(e) => setRow(r.key, { discountType: e.target.value as Line["discountType"] })}>
                          <option value="percent">%</option>
                          <option value="amount">บาท</option>
                        </select>
                      </div>
                    </td>
                    <td className={tdR}>
                      <Num v={lineAmount(r)} />
                    </td>
                    <td className="px-1 py-1.5">
                      <button type="button" aria-label="ลบแถว" className="inline-flex size-8 items-center justify-center rounded-[8px] text-ink-3 hover:bg-raised hover:text-neg disabled:opacity-30" disabled={rows.length === 1} onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}>
                        <Trash2 {...I} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t border-line px-2 py-1.5">
              <Btn small onClick={() => setRows((rs) => [...rs, blankRow()])}>
                <Plus {...I} />
                เพิ่มรายการ
              </Btn>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Labeled label="ส่วนลดท้ายบิล">
              <div className="flex gap-1">
                <input className={cx(numInput, "w-full")} inputMode="decimal" value={d.discount ?? 0} onChange={(e) => set("discount", Number(e.target.value) || 0)} />
                <select aria-label="หน่วยส่วนลด" className={cx(inputCls, "w-20 px-2")} value={d.discountType ?? "amount"} onChange={(e) => set("discountType", e.target.value as Expense["discountType"])}>
                  <option value="amount">บาท</option>
                  <option value="percent">%</option>
                </select>
              </div>
            </Labeled>
            <Labeled label="ภาษีมูลค่าเพิ่ม">
              <select className={inputCls} value={d.vatMode} onChange={(e) => set("vatMode", e.target.value as VatMode)}>
                {Object.entries(vatModes).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Labeled>
            <Labeled label="หัก ณ ที่จ่าย">
              <select className={inputCls} value={d.whtRate} onChange={(e) => set("whtRate", Number(e.target.value))}>
                {whtRates.map((r) => (
                  <option key={r} value={r}>
                    {r ? `${r}%` : "ไม่หัก"}
                  </option>
                ))}
              </select>
            </Labeled>
            {d.payStatus === "ยังไม่จ่าย" && (
              <Labeled label="วันที่จ่ายจริง (ถ้าจ่ายแล้ว)">
                <input type="date" className={inputCls} value={d.paidDate ?? ""} onChange={(e) => setD((x) => ({ ...x, paidDate: e.target.value || undefined, paidAccount: e.target.value ? A.bank : undefined }))} />
              </Labeled>
            )}
            <Labeled label="หมายเหตุ" className="col-span-2 md:col-span-4">
              <input className={inputCls} value={d.note ?? ""} onChange={(e) => set("note", e.target.value)} />
            </Labeled>
          </div>
        </div>

        <aside className="flex flex-col gap-4">
          <div className="rounded-[12px] border border-line bg-raised/50 px-4 py-3 text-[13px]">
            {(
              [
                ["รวมรายการ", subtotal],
                ["ส่วนลดท้ายบิล", -off],
                ["ยอดตามเอกสาร", after],
                ["มูลค่าก่อน VAT", j.calc.base],
                ["ภาษีมูลค่าเพิ่ม", j.calc.vat],
                ["ภาษีซื้อขอคืนได้", j.calc.claimable],
                [`หัก ณ ที่จ่าย ${d.whtRate ? d.whtRate + "%" : ""}`, -j.calc.wht],
              ] as [string, number][]
            ).map(([k, v]) => (
              <div key={k} className="flex justify-between py-1">
                <span className="text-ink-2">{k}</span>
                <Num v={v} acc />
              </div>
            ))}
            <div className="mt-1 flex justify-between border-t border-line-strong pt-2 text-[14px] font-medium">
              <span>จ่ายสุทธิ</span>
              <Num v={j.calc.net} />
            </div>
            {j.wht && <p className="mt-2 text-[12px] text-ink-3">ยื่น {j.wht.form} · {j.wht.incomeType}</p>}
            {j.calc.vat > 0 && !j.calc.claimable && <p className="mt-2 text-[12px] text-warn">ไม่ใช่ใบกำกับภาษีเต็มรูป ภาษีซื้อขอคืนไม่ได้ จึงรวมเป็นต้นทุน</p>}
          </div>
          <div className="rounded-[12px] border border-line px-4 py-3">
            <p className="mb-2 flex items-center justify-between text-[13px] font-medium">
              รายการบัญชี
              <Pill tone={j.balanced ? "pos" : "neg"}>{j.balanced ? "สมดุล" : "ไม่สมดุล"}</Pill>
            </p>
            <table className="w-full text-[12px]">
              <tbody>
                {j.lines.map((l, i) => (
                  <tr key={i} className="border-t border-line">
                    <td className={cx("py-1.5", l.credit ? "pl-4" : "")}>
                      <span className="font-mono">{l.account}</span> {accountName(accounts, l.account)}
                      {l.projectId && <span className="block text-ink-3">{projectName(l.projectId)}</span>}
                    </td>
                    <td className="num py-1.5 text-right font-mono">{l.debit ? fmt(l.debit) : ""}</td>
                    <td className="num py-1.5 pl-2 text-right font-mono">{l.credit ? fmt(l.credit) : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-[12px] text-ink-3">จ่ายจาก {accountName(accounts, PAID_FROM[d.payStatus])}</p>
          </div>
        </aside>
      </div>
    </Modal>
  );
}
