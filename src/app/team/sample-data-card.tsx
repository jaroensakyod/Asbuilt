"use client";

import { useState } from "react";
import { Card, CardHead } from "@/components/ui";
import { useMe } from "@/lib/use-me";
import { canApprove } from "@/lib/permissions";
import { bootWorkspace } from "@/lib/workspace";
import { purgeDemoData } from "@/lib/demo-seed";
import { resetLocalCollections } from "@/lib/collection";

/**
 * Live mode: delete the sample records that "ใส่ข้อมูลตัวอย่าง" copied into this company.
 * Demo mode: forget the edits made in this browser and go back to the original sample data.
 */
export function SampleDataCard() {
  const me = useMe();
  const [step, setStep] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!canApprove(me.role, "admin")) return null;

  const run = async () => {
    setError(null);
    if (!me.live) {
      for (const k of Object.keys(window.localStorage)) if (k.startsWith("asbuilt")) window.localStorage.removeItem(k);
      resetLocalCollections();
      return;
    }
    try {
      await purgeDemoData(me.companyId!, (l) => setStep(`กำลังลบ ${l}`));
      setStep("กำลังโหลดข้อมูลใหม่");
      await bootWorkspace(me.companyId);
      setStep(null);
      setConfirm(false);
    } catch (e) {
      setStep(null);
      setError((e as Error).message);
    }
  };

  return (
    <Card>
      <CardHead title={me.live ? "ข้อมูลตัวอย่าง" : "รีเซ็ตข้อมูลเดโม"} />
      <div className="px-5 py-4 text-[13px] text-ink-2">
        <p>
          {me.live
            ? "ลบโครงการ งานขาย บัญชี เงินเดือน และเอกสารตัวอย่างที่ใส่ไว้ตอนสร้างบริษัท ข้อมูลที่คุณสร้างเองจะไม่ถูกลบ"
            : "ล้างรายการที่สร้างหรือแก้ไขในเบราว์เซอร์นี้ แล้วกลับไปใช้ข้อมูลตัวอย่างชุดเดิม"}
        </p>
        {error && <p className="mt-3 rounded-[8px] bg-neg-soft px-3 py-2 text-ink">{error}</p>}
        <div className="mt-4 flex items-center gap-2">
          {confirm ? (
            <>
              <button type="button" onClick={run} disabled={!!step} className="h-9 rounded-[8px] bg-neg px-4 text-[14px] font-medium text-card disabled:opacity-60">
                {step ?? (me.live ? "ยืนยันลบข้อมูลตัวอย่าง" : "ยืนยันรีเซ็ต")}
              </button>
              {!step && (
                <button type="button" onClick={() => setConfirm(false)} className="h-9 rounded-[8px] border border-line-strong px-4 text-[14px] text-ink">
                  ยกเลิก
                </button>
              )}
            </>
          ) : (
            <button type="button" onClick={() => setConfirm(true)} className="h-9 rounded-[8px] border border-line-strong px-4 text-[14px] text-ink transition-colors duration-150 hover:bg-raised">
              {me.live ? "ลบข้อมูลตัวอย่าง" : "รีเซ็ตข้อมูลเดโม"}
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}
