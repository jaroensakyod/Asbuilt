"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AuthShell, FormError, authButton, authInput } from "@/components/auth/auth-shell";
import { Field } from "@/components/ui";
import { supabase } from "@/lib/supabase/client";
import { bootWorkspace, signOut, switchCompany, useWorkspace } from "@/lib/workspace";
import { seedDemoData } from "@/lib/demo-seed";

export default function OnboardingPage() {
  const router = useRouter();
  const ws = useWorkspace();
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<string | null>(null);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const sb = supabase();
    if (!sb) return;
    const f = new FormData(e.currentTarget);
    setError(null);
    setStep("กำลังสร้างบริษัท");
    const { data: cid, error } = await sb.rpc("create_company", { p_name: String(f.get("company")).trim(), p_display_name: String(f.get("name")).trim() });
    if (error || !cid) {
      setStep(null);
      setError(error?.message ?? "สร้างบริษัทไม่สำเร็จ");
      return;
    }
    if (f.get("demo")) {
      try {
        await seedDemoData(cid as string, (label) => setStep(`กำลังใส่ข้อมูลตัวอย่าง · ${label}`));
      } catch (err) {
        setError(`สร้างบริษัทแล้ว แต่ใส่ข้อมูลตัวอย่างไม่ครบ: ${(err as Error).message}`);
      }
    }
    setStep("กำลังเปิดแฟ้มบริษัท");
    await switchCompany(cid as string);
    router.replace("/");
  };

  const signedOut = ws.status === "signed-out";
  return (
    <AuthShell
      title="ตั้งค่าบริษัท"
      sub="บริษัทคือพื้นที่ทำงานของทีม ข้อมูลโครงการ แบบ และงานบริการทั้งหมดจะแยกตามบริษัท"
      footer={
        ws.email ? (
          <>
            เข้าสู่ระบบเป็น {ws.email} ·{" "}
            <button type="button" onClick={() => void signOut()} className="text-ink underline underline-offset-2">
              ออกจากระบบ
            </button>
          </>
        ) : null
      }
    >
      {signedOut ? (
        <button type="button" onClick={() => router.replace("/login?next=/onboarding")} className={authButton}>
          เข้าสู่ระบบก่อน
        </button>
      ) : (
        <>
          {ws.companies.length > 0 && (
            <div className="mb-5 rounded-[10px] border border-line p-3">
              <p className="mb-2 text-[13px] text-ink-2">บริษัทที่คุณเป็นสมาชิก</p>
              <ul className="flex flex-col gap-1">
                {ws.companies.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={async () => {
                        await switchCompany(c.id);
                        router.replace("/");
                      }}
                      className="flex h-9 w-full items-center justify-between rounded-[8px] px-2 text-left transition-colors duration-150 hover:bg-raised"
                    >
                      <span>{c.name}</span>
                      <span className="text-[12px] text-ink-3">เปิด</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <form onSubmit={submit} className="flex flex-col gap-3">
            <Field label="ชื่อบริษัท">
              <input name="company" required placeholder="บริษัท ตัวอย่างรับสร้างบ้าน จำกัด" className={authInput} />
            </Field>
            <Field label="ชื่อของคุณที่ทีมจะเห็น">
              <input name="name" required className={authInput} />
            </Field>
            <label className="flex items-start gap-2.5 rounded-[8px] bg-raised px-3 py-2.5 text-[13px] text-ink-2">
              <input type="checkbox" name="demo" defaultChecked className="mt-0.5 accent-[var(--text)]" />
              <span>
                ใส่ข้อมูลตัวอย่างให้ลองใช้ (40 โครงการ แจ้งซ่อม การตรวจ เอกสาร) ลบทิ้งภายหลังได้
              </span>
            </label>
            <FormError msg={error} />
            <button type="submit" disabled={!!step} className={authButton}>
              {step ?? "สร้างบริษัท"}
            </button>
            {ws.status === "error" && (
              <button type="button" onClick={() => void bootWorkspace()} className="text-[13px] text-ink-2">
                ลองโหลดข้อมูลอีกครั้ง
              </button>
            )}
          </form>
        </>
      )}
    </AuthShell>
  );
}
