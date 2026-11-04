"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthShell, FormError, authButton } from "@/components/auth/auth-shell";
import { supabase } from "@/lib/supabase/client";
import { switchCompany, useWorkspace } from "@/lib/workspace";
import { ROLE_LABEL, type Role } from "@/lib/data";

type Preview = { company_name: string; role: Role; email: string; accepted: boolean };

export function InviteAccept({ token }: { token: string }) {
  const router = useRouter();
  const ws = useWorkspace();
  const [preview, setPreview] = useState<Preview | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const sb = supabase();
    if (!sb) return;
    void sb.rpc("invitation_preview", { p_token: token }).then(({ data }) => setPreview(((data as Preview[] | null) ?? [])[0] ?? null));
  }, [token]);

  const accept = async () => {
    const sb = supabase();
    if (!sb) return;
    setBusy(true);
    setError(null);
    const { data: cid, error } = await sb.rpc("accept_invitation", { p_token: token });
    if (error) {
      setBusy(false);
      setError(
        error.message.includes("different email")
          ? `คำเชิญนี้ส่งถึง ${preview?.email} ออกจากระบบแล้วเข้าด้วยอีเมลนั้น`
          : error.message.includes("already used")
            ? "คำเชิญนี้ถูกใช้แล้ว"
            : error.message,
      );
      return;
    }
    await switchCompany(cid as string);
    router.replace("/");
  };

  const next = encodeURIComponent(`/invite/${token}`);

  if (preview === undefined) return <AuthShell title="คำเชิญเข้าร่วมทีม" sub="กำลังตรวจสอบคำเชิญ">{null}</AuthShell>;
  if (preview === null)
    return (
      <AuthShell title="ไม่พบคำเชิญ" sub="ลิงก์อาจไม่ถูกต้องหรือถูกยกเลิกแล้ว ขอลิงก์ใหม่จากผู้ดูแลระบบของบริษัท">
        <Link href="/login" className={authButton}>
          ไปหน้าเข้าสู่ระบบ
        </Link>
      </AuthShell>
    );

  return (
    <AuthShell title={`เข้าร่วม ${preview.company_name}`} sub={`ในบทบาท ${ROLE_LABEL[preview.role]} · คำเชิญสำหรับ ${preview.email}`}>
      {preview.accepted ? (
        <p className="text-[14px] text-ink-2">คำเชิญนี้ถูกใช้แล้ว</p>
      ) : ws.status === "signed-out" || ws.status === "loading" ? (
        <div className="flex flex-col gap-2">
          <Link href={`/signup?next=${next}`} className={authButton}>
            สมัครด้วย {preview.email}
          </Link>
          <Link href={`/login?next=${next}`} className="flex h-10 items-center justify-center rounded-[8px] border border-line-strong text-[14px] transition-colors duration-150 hover:bg-raised">
            มีบัญชีแล้ว เข้าสู่ระบบ
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <FormError msg={error} />
          <button type="button" onClick={accept} disabled={busy} className={authButton}>
            {busy ? "กำลังเข้าร่วม" : "รับคำเชิญ"}
          </button>
          <p className="text-center text-[12px] text-ink-3">เข้าสู่ระบบเป็น {ws.email}</p>
        </div>
      )}
    </AuthShell>
  );
}
