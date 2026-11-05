import { BrandMark } from "@/components/brand";
import type { ReactNode } from "react";
import Link from "next/link";
import { LIVE } from "@/lib/supabase/env";

export function AuthShell({ title, sub, children, footer }: { title: string; sub?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-[440px]">
        <Link href="/" className="mb-8 flex items-center gap-2.5">
          <BrandMark />
          <span className="text-[18px] font-medium leading-none">Asbuilt</span>
          <span className="text-[13px] leading-none text-ink-3">แฟ้มบ้าน</span>
        </Link>
        <div className="rounded-[16px] border border-line bg-card p-8 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h1 className="text-[22px] font-normal leading-tight">{title}</h1>
          {sub && <p className="mt-1.5 text-[14px] text-ink-2">{sub}</p>}
          {!LIVE && (
            <p className="mt-4 rounded-[8px] bg-warn-soft px-3 py-2 text-[13px] text-ink">
              โหมดเดโม: ปิดการล็อกอินไว้ระหว่างทดสอบ ใช้ข้อมูลตัวอย่าง <Link href="/" className="underline underline-offset-2">เข้าดูเดโม</Link>
            </p>
          )}
          <div className="mt-5">{children}</div>
        </div>
        {footer && <div className="mt-4 text-center text-[13px] text-ink-2">{footer}</div>}
      </div>
    </main>
  );
}

export function FormError({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <p role="alert" className="rounded-[8px] bg-neg-soft px-3 py-2 text-[13px] text-ink">
      {msg}
    </p>
  );
}

/** Thai messages for the common Supabase auth errors */
export function authError(message: string) {
  const m = message.toLowerCase();
  if (m.includes("invalid login")) return "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
  if (m.includes("email not confirmed")) return "ยังไม่ได้ยืนยันอีเมล กรุณาเปิดลิงก์ในอีเมลก่อน";
  if (m.includes("already registered")) return "อีเมลนี้สมัครไว้แล้ว ลองเข้าสู่ระบบ";
  if (m.includes("password should be")) return "รหัสผ่านสั้นเกินไป อย่างน้อย 8 ตัวอักษร";
  if (m.includes("rate limit")) return "ส่งคำขอบ่อยเกินไป รอสักครู่แล้วลองใหม่";
  return message;
}

export const authInput =
  "h-10 w-full rounded-[8px] border border-line-strong bg-card px-3 text-[14px] text-ink outline-none transition-colors duration-150 placeholder:text-ink-3 focus:border-ink-3";
export const authButton =
  "flex h-10 w-full items-center justify-center rounded-[8px] bg-ink text-[14px] font-medium text-card transition-[background-color,transform] duration-150 hover:bg-[#253d5c] active:scale-[0.98] disabled:opacity-50";
