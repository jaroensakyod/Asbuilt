"use client";

// Expense receipt (photo / PDF) → AI → prefilled accounting expense (petty cash and site costs).
// The caller opens its normal ExpenseForm with the draft; nothing is posted until the user saves.

import { useState } from "react";
import { TODAY } from "@/lib/data";
import type { MediaRef } from "@/lib/media";
import { checkAmounts, expenseDraft, taxIdChecksumOk, type CategoryLike, type Confidence, type ExpenseDraft, type Issue } from "@/lib/ai-docs";
import { AiButton, ReadDocDialog } from "./bits";
import { readInvoice } from "./run";

export type ReceiptAiMeta = { refs: MediaRef[]; confidence: Confidence; issues: Issue[]; note?: string; keys: string[]; total: number };

export function ReceiptAi({ categories, projects, onDraft }: { categories: CategoryLike[]; projects: { id: string; name: string }[]; onDraft: (d: ExpenseDraft, meta: ReceiptAiMeta) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <AiButton onClick={() => setOpen(true)}>อ่านใบเสร็จด้วย AI</AiButton>
      {open && (
        <ReadDocDialog
          title="อ่านใบเสร็จ / บิลค่าใช้จ่าย"
          hint="ถ่ายรูปใบเสร็จ บิลเงินสด หรือใบกำกับภาษี AI จะอ่านร้านค้า วันที่ ยอดเงิน VAT และเดาหมวดค่าใช้จ่ายกับโครงการ แล้วเปิดแบบฟอร์มให้ตรวจก่อนลงบัญชี"
          run={(files) =>
            readInvoice(files, {
              purpose: "expense",
              categories: categories.map((c) => c.name),
              projects: projects.slice(0, 40),
            })
          }
          onRead={(x, refs) => {
            setOpen(false);
            const d = expenseDraft(x, { today: TODAY, categories, projects });
            const keys = ["payee", "date", "docType", "category", "vatMode", "lines"];
            if (d.payeeTaxId) keys.push("payeeTaxId");
            if (d.payeeBranch) keys.push("payeeBranch");
            if (d.docNo) keys.push("docNo");
            if (d.projectId) keys.push("projectId");
            if (d.whtRate) keys.push("whtRate");
            if (d.discount) keys.push("discount");
            const issues = checkAmounts(x);
            if (d.payeeTaxId && !taxIdChecksumOk(d.payeeTaxId)) issues.push({ field: "payeeTaxId", tone: "neg", msg: `เลขผู้เสียภาษี ${d.payeeTaxId} ไม่ผ่านการตรวจหลักสุดท้าย อาจอ่านผิดหนึ่งหลัก ตรวจกับใบเสร็จ` });
            onDraft(d, { refs, confidence: x.confidence, issues, note: x.note || (x.uncertain.length ? `อ่านไม่ชัด: ${x.uncertain.join(", ")}` : undefined), keys, total: x.total });
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
