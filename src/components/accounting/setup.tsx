"use client";

import { useMemo, useState } from "react";
import { Lock, LockOpen, Plus } from "lucide-react";
import { Card, CardHead, cx, inputCls } from "@/components/ui";
import { A, TYPE_LABEL, typeOfCode, type Account, type AccountType } from "@/lib/accounting/coa";
import { BOOKS_START, monthEnd, periodLabelFull, periodOf, periodsBetween, thDateSlash } from "@/lib/accounting/money";
import { netByAccount, trialBalance } from "@/lib/accounting/reports";
import { ACC_TODAY, accountsCol, closePeriod, filingsCol, nextClosable, reopenPeriod, useAccess, useBooks } from "@/lib/accounting/store";
import { Btn, CsvButton, I, Labeled, Modal, Notice, Num, Pill, tableCls, td, tdR, th, thR, Toolbar } from "./bits";

const PROTECTED = new Set<string>(Object.values(A));

export function AccountsView() {
  const { entries } = useBooks();
  const accounts = accountsCol.use();
  const { approve } = useAccess();
  const [adding, setAdding] = useState(false);
  const [showInactive, setShowInactive] = useState(true);
  const bal = useMemo(() => netByAccount(entries, { to: ACC_TODAY }), [entries]);
  const sorted = [...accounts].sort((a, b) => a.code.localeCompare(b.code)).filter((a) => showInactive || a.active);
  return (
    <>
      <Toolbar>
        <label className="flex items-center gap-2 text-[13px] text-ink-2">
          <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          แสดงบัญชีที่ปิดใช้
        </label>
        <div className="ml-auto flex gap-2">
          <CsvButton name="chart-of-accounts" rows={() => [["รหัส", "ชื่อบัญชี", "ประเภท", "บัญชีคุม", "หัวข้อ", "ใช้งาน"], ...sorted.map((a) => [a.code, a.name, TYPE_LABEL[a.type], a.parent ?? "", a.header ? "ใช่" : "", a.active ? "ใช่" : "ไม่"])]} />
          {approve && (
            <Btn small primary onClick={() => setAdding(true)}>
              <Plus {...I} />
              เพิ่มบัญชี
            </Btn>
          )}
        </div>
      </Toolbar>
      <Card>
        <CardHead title="ผังบัญชี" meta={`${accounts.length} บัญชี`} />
        <div className="overflow-x-auto">
          <table className={tableCls}>
            <thead>
              <tr>
                <th className={th}>รหัส</th>
                <th className={th}>ชื่อบัญชี</th>
                <th className={th}>ประเภท</th>
                <th className={th}>บัญชีคุม</th>
                <th className={thR}>ยอดคงเหลือ (Dr+)</th>
                <th className={th}>ใช้งาน</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((a) => {
                const b = bal.get(a.code)?.net ?? 0;
                const locked = PROTECTED.has(a.code) || a.header || Math.abs(b) > 0.004;
                return (
                  <tr key={a.code} className={cx(!a.active && "opacity-50", a.header && "bg-raised/40")}>
                    <td className={cx(td, "font-mono", a.header && "font-medium")}>{a.code}</td>
                    <td className={cx(td, a.header ? "font-medium" : a.parent ? "pl-6" : "")}>{a.name}</td>
                    <td className={td}>{TYPE_LABEL[a.type]}</td>
                    <td className={cx(td, "font-mono text-ink-3")}>{a.parent ?? ""}</td>
                    <td className={tdR}>{a.header ? null : <Num v={b} acc />}</td>
                    <td className={td}>
                      {a.header ? (
                        <span className="text-[12px] text-ink-3">หัวข้อ</span>
                      ) : (
                        <input
                          type="checkbox"
                          aria-label={`ใช้งาน ${a.name}`}
                          className="size-4 accent-[var(--accent)]"
                          checked={a.active}
                          disabled={!approve || (a.active && locked)}
                          title={a.active && locked ? "บัญชีที่ระบบใช้หรือมียอดคงเหลือ ปิดใช้ไม่ได้" : undefined}
                          onChange={(e) => accountsCol.upsert({ ...a, active: e.target.checked })}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      {adding && <AddAccount accounts={accounts} onClose={() => setAdding(false)} />}
    </>
  );
}

function AddAccount({ accounts, onClose }: { accounts: Account[]; onClose: () => void }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [header, setHeader] = useState(false);
  const type: AccountType = typeOfCode(code || "5");
  const parents = accounts.filter((a) => a.header && a.type === type);
  const [parent, setParent] = useState("");
  const err = !/^[1-5]\d{3}$/.test(code) ? "รหัสบัญชี 4 หลัก ขึ้นต้นด้วย 1–5" : accounts.some((a) => a.code === code) ? "รหัสนี้มีอยู่แล้ว" : !name.trim() ? "กรอกชื่อบัญชี" : "";
  return (
    <Modal
      open
      onClose={onClose}
      title="เพิ่มบัญชี"
      footer={
        <>
          {err && <span className="mr-auto text-[13px] text-neg">{err}</span>}
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn
            primary
            disabled={!!err}
            onClick={() => {
              accountsCol.upsert({ id: code, code, name: name.trim(), type, parent: parent || undefined, header: header || undefined, active: true, group: type === "expense" ? (code.startsWith("51") ? "cost" : "sga") : undefined });
              onClose();
            }}
          >
            บันทึก
          </Btn>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Labeled label="รหัสบัญชี">
          <input className={cx(inputCls, "font-mono")} value={code} onChange={(e) => setCode(e.target.value.trim())} placeholder="5180" />
        </Labeled>
        <Labeled label="ประเภท (ตามหลักแรกของรหัส)">
          <input className={inputCls} value={TYPE_LABEL[type]} readOnly />
        </Labeled>
        <Labeled label="ชื่อบัญชี" className="col-span-2">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
        </Labeled>
        <Labeled label="บัญชีคุม">
          <select className={inputCls} value={parent} onChange={(e) => setParent(e.target.value)}>
            <option value="">–</option>
            {parents.map((p) => (
              <option key={p.code} value={p.code}>
                {p.code} {p.name}
              </option>
            ))}
          </select>
        </Labeled>
        <label className="mt-6 flex items-center gap-2 text-[13px] text-ink-2">
          <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={header} onChange={(e) => setHeader(e.target.checked)} />
          เป็นหัวข้อ (ไม่ใช้บันทึกรายการ)
        </label>
      </div>
    </Modal>
  );
}

export function CloseView() {
  const { input, entries, accounts, late, problems, locks } = useBooks();
  const filings = filingsCol.use();
  const { approve, me } = useAccess();
  const next = nextClosable(locks);
  const lastClosed = [...locks].sort((a, b) => b.id.localeCompare(a.id))[0]?.id;
  const months = periodsBetween(periodOf(BOOKS_START), periodOf(ACC_TODAY)).reverse();
  const nextTb = useMemo(() => trialBalance(entries, accounts, { from: `${next}-01`, to: monthEnd(next) }), [entries, accounts, next]);
  const canCloseNext = monthEnd(next) < ACC_TODAY;
  const missingPp30 = !filings.some((f) => f.kind === "pp30" && f.period === next);

  return (
    <div className="flex flex-col gap-5">
      {late.length > 0 && (
        <Notice>
          มีเอกสาร {late.length} รายการที่ลงวันที่ในงวดที่ปิดแล้ว ระบบไม่นำมาลงบัญชี ให้ลงวันที่ใหม่ในงวดที่ยังเปิดอยู่ หรือยกเลิกการปิดงวด
          <ul className="mt-1 list-disc pl-5">
            {late.slice(0, 8).map((p) => (
              <li key={p.key}>{p.text}</li>
            ))}
          </ul>
        </Notice>
      )}
      <Card>
        <CardHead title={`งวดถัดไปที่ปิดได้ · ${periodLabelFull(next)}`} />
        <div className="px-5 py-4 text-[13px]">
          <ul className="flex flex-col gap-1.5">
            <li>
              <Pill tone={canCloseNext ? "pos" : "warn"}>{canCloseNext ? "สิ้นเดือนแล้ว" : "ยังไม่สิ้นเดือน"}</Pill>
            </li>
            <li>
              <Pill tone={nextTb.balanced ? "pos" : "neg"}>{nextTb.balanced ? "งบทดลองของงวดสมดุล" : "งบทดลองไม่สมดุล"}</Pill>
            </li>
            <li>
              <Pill tone={problems.length ? "neg" : "pos"}>{problems.length ? `มีรายการผิดพลาด ${problems.length} รายการ` : "ไม่มีรายการไม่สมดุล"}</Pill>
            </li>
            <li>
              <Pill tone={missingPp30 ? "warn" : "pos"}>{missingPp30 ? "ยังไม่บันทึกยื่น ภ.พ.30 ของงวดนี้ (ยื่นในเดือนถัดไปได้)" : "บันทึกยื่น ภ.พ.30 แล้ว"}</Pill>
            </li>
          </ul>
          <p className="mt-3 text-ink-2">เมื่อปิดงวด ระบบจะออกเลข JV ให้ทุกรายการและเก็บรายการของเดือนนั้นไว้ตามที่ปิด เอกสารที่ลงวันที่ในงวดนี้จะแก้ไขไม่ได้{next.endsWith("-12") ? " และจะสร้างรายการปิดบัญชีรายได้/ค่าใช้จ่ายเข้ากำไรสะสม" : ""}</p>
          {approve && (
            <div className="mt-4">
              <Btn
                primary
                disabled={!canCloseNext || !nextTb.balanced || problems.length > 0}
                onClick={() => {
                  if (window.confirm(`ปิดงวด ${periodLabelFull(next)}`)) closePeriod(next, input, me.name);
                }}
              >
                <Lock {...I} />
                ปิดงวด {periodLabelFull(next)}
              </Btn>
            </div>
          )}
        </div>
      </Card>
      <Card>
        <CardHead title="สถานะงวดบัญชี" />
        <table className={tableCls}>
          <thead>
            <tr>
              <th className={th}>งวด</th>
              <th className={th}>สถานะ</th>
              <th className={thR}>รายการ</th>
              <th className={th}>ปิดเมื่อ</th>
              <th className={th}>โดย</th>
              <th className={th} />
            </tr>
          </thead>
          <tbody>
            {months.map((p) => {
              const l = locks.find((x) => x.id === p);
              return (
                <tr key={p}>
                  <td className={td}>{periodLabelFull(p)}</td>
                  <td className={td}>
                    <Pill tone={l ? "neutral" : p === next ? "accent" : "warn"}>{l ? "ปิดแล้ว" : "เปิดอยู่"}</Pill>
                  </td>
                  <td className={tdR}>
                    <span className="num font-mono">{entries.filter((e) => e.period === p).length}</span>
                  </td>
                  <td className={td}>{l ? <span className="num font-mono">{thDateSlash(l.closedAt.slice(0, 10))}</span> : null}</td>
                  <td className={td}>{l?.closedBy}</td>
                  <td className={tdR}>
                    {l && approve && p === lastClosed && (
                      <Btn
                        small
                        onClick={() => {
                          if (window.confirm(`ยกเลิกการปิดงวด ${periodLabelFull(p)} รายการในงวดนี้จะคำนวณใหม่จากเอกสารปัจจุบัน`)) reopenPeriod(p);
                        }}
                      >
                        <LockOpen {...I} />
                        ยกเลิกปิดงวด
                      </Btn>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
