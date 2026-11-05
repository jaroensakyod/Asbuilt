"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthShell, FormError, authButton, authError, authInput } from "@/components/auth/auth-shell";
import { Field } from "@/components/ui";
import { supabase } from "@/lib/supabase/client";

const safeNext = (n: string | null) => (n && n.startsWith("/") && !n.startsWith("//") ? n : "/onboarding");

export function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const sb = supabase();
    if (!sb) return;
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email")).trim();
    const password = String(f.get("password"));
    if (password.length < 8) {
      setError("รหัสผ่านอย่างน้อย 8 ตัวอักษร");
      return;
    }
    if (password !== String(f.get("confirm"))) {
      setError("รหัสผ่านทั้งสองช่องไม่ตรงกัน");
      return;
    }
    setBusy(true);
    setError(null);
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: String(f.get("name")).trim() },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    setBusy(false);
    if (error) return setError(authError(error.message));
    // with email confirmation off Supabase signs the user in straight away
    if (data.session) router.replace(next);
    else setSentTo(email);
  };

  if (sentTo)
    return (
      <AuthShell title="ยืนยันอีเมล" sub={`ส่งลิงก์ยืนยันไปที่ ${sentTo} แล้ว เปิดลิงก์ในอีเมลเพื่อเริ่มใช้งาน`}>
        <Link href="/login" className={authButton}>
          กลับไปหน้าเข้าสู่ระบบ
        </Link>
      </AuthShell>
    );

  return (
    <AuthShell
      title="สมัครใช้งาน"
      sub="สร้างบัญชี แล้วตั้งบริษัทของคุณในขั้นถัดไป"
      footer={
        <>
          มีบัญชีแล้ว{" "}
          <Link href={`/login${params.get("next") ? `?next=${encodeURIComponent(next)}` : ""}`} className="text-ink underline underline-offset-2">
            เข้าสู่ระบบ
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Field label="ชื่อ-นามสกุล">
          <input name="name" required autoComplete="name" className={authInput} />
        </Field>
        <Field label="อีเมล">
          <input name="email" type="email" required autoComplete="email" className={authInput} />
        </Field>
        <Field label="รหัสผ่าน">
          <input name="password" type="password" required minLength={8} autoComplete="new-password" className={authInput} />
        </Field>
        <Field label="ยืนยันรหัสผ่าน">
          <input name="confirm" type="password" required minLength={8} autoComplete="new-password" className={authInput} />
        </Field>
        <FormError msg={error} />
        <button type="submit" disabled={busy} className={authButton}>
          {busy ? "กำลังสมัคร" : "สมัครใช้งาน"}
        </button>
      </form>
    </AuthShell>
  );
}
