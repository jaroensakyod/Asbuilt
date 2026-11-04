"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AuthShell, FormError, authButton, authError, authInput } from "@/components/auth/auth-shell";
import { Field } from "@/components/ui";
import { supabase } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const sb = supabase();
    if (!sb) return;
    const f = new FormData(e.currentTarget);
    const password = String(f.get("password"));
    if (password.length < 8) return setError("รหัสผ่านอย่างน้อย 8 ตัวอักษร");
    if (password !== String(f.get("confirm"))) return setError("รหัสผ่านทั้งสองช่องไม่ตรงกัน");
    setBusy(true);
    const { error } = await sb.auth.updateUser({ password });
    setBusy(false);
    if (error) return setError(authError(error.message));
    router.replace("/");
  };

  return (
    <AuthShell title="ตั้งรหัสผ่านใหม่">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Field label="รหัสผ่านใหม่">
          <input name="password" type="password" required minLength={8} autoComplete="new-password" className={authInput} />
        </Field>
        <Field label="ยืนยันรหัสผ่าน">
          <input name="confirm" type="password" required minLength={8} autoComplete="new-password" className={authInput} />
        </Field>
        <FormError msg={error} />
        <button type="submit" disabled={busy} className={authButton}>
          บันทึกรหัสผ่าน
        </button>
      </form>
    </AuthShell>
  );
}
