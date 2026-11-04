"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthShell, FormError, authButton, authError, authInput } from "@/components/auth/auth-shell";
import { Field } from "@/components/ui";
import { supabase } from "@/lib/supabase/client";
import { bootWorkspace } from "@/lib/workspace";

const safeNext = (n: string | null) => (n && n.startsWith("/") && !n.startsWith("//") ? n : "/");

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const sb = supabase();
    if (!sb) return;
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    const { error } = await sb.auth.signInWithPassword({ email: String(f.get("email")).trim(), password: String(f.get("password")) });
    if (error) {
      setBusy(false);
      setError(authError(error.message));
      return;
    }
    await bootWorkspace();
    router.replace(next);
  };

  const forgot = async () => {
    const sb = supabase();
    if (!sb) return;
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError("กรอกอีเมลก่อน แล้วกดลืมรหัสผ่านอีกครั้ง");
      return;
    }
    const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/auth/callback?next=/reset-password` });
    if (error) setError(authError(error.message));
    else setNotice(`ส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่ ${email.trim()} แล้ว`);
  };

  return (
    <AuthShell
      title="เข้าสู่ระบบ"
      sub="แฟ้มบ้านของบริษัทคุณ"
      footer={
        <>
          ยังไม่มีบัญชี{" "}
          <Link href={`/signup${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`} className="text-ink underline underline-offset-2">
            สมัครใช้งาน
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Field label="อีเมล">
          <input name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={authInput} />
        </Field>
        <Field label="รหัสผ่าน">
          <input name="password" type="password" autoComplete="current-password" required className={authInput} />
        </Field>
        <FormError msg={error} />
        {notice && <p className="rounded-[8px] bg-pos-soft px-3 py-2 text-[13px]">{notice}</p>}
        <button type="submit" disabled={busy} className={authButton}>
          {busy ? "กำลังเข้าสู่ระบบ" : "เข้าสู่ระบบ"}
        </button>
        <button type="button" onClick={forgot} className="text-[13px] text-ink-2 hover:text-ink">
          ลืมรหัสผ่าน
        </button>
      </form>
    </AuthShell>
  );
}
