"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LIVE } from "@/lib/supabase/env";
import { ServiceWorker } from "./pwa";
import { AiChatLauncher } from "@/components/ai";
import { supabase } from "@/lib/supabase/client";
import { bootWorkspace, onRemoteError, useWorkspace } from "@/lib/workspace";
import { applyCompanySettings } from "@/app/team/team-store";
// stores that receive the company's rows must be loaded before the workspace boots
import "@/lib/ops-store";
import "@/lib/projects-store";
import "@/lib/docs-store";
import "@/lib/demo-seed";
import "@/lib/modules";
import { Sidebar } from "./sidebar";
import { canView, moduleOfPath, MODULES } from "@/lib/permissions";
import { useMe } from "@/lib/use-me";
import { CommandPalette } from "./command-palette";

const BARE = ["/login", "/signup", "/onboarding", "/invite", "/auth", "/reset-password", "/portal"];
const isBare = (path: string) => BARE.some((p) => path === p || path.startsWith(p + "/"));
// phone screens for the field (foreman, technician, crew): signed-in like the rest, but full-screen without the sidebar
const PHONE = ["/m", "/offline"];
const isPhone = (path: string) => PHONE.some((p) => path === p || path.startsWith(p + "/"));

/**
 * App chrome + workspace gate.
 * Demo mode renders the app straight away. Live mode waits until the signed-in
 * user's company is loaded, and routes signed-out users to /login and users
 * without a company to /onboarding.
 */
export function AppFrame({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const ws = useWorkspace();
  const bare = isBare(path);
  const me = useMe();
  const mod = moduleOfPath(path);
  const denied = !!mod && !canView(me.role, mod);

  useEffect(() => {
    if (!LIVE) {
      applyCompanySettings();
      return;
    }
    void bootWorkspace();
    const sb = supabase();
    const { data } = sb!.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") void bootWorkspace();
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (ws.status === "ready") applyCompanySettings();
    if (!LIVE || bare) return;
    if (ws.status === "signed-out") router.replace(`/login?next=${encodeURIComponent(path)}`);
    if (ws.status === "no-company") router.replace("/onboarding");
  }, [ws.status, bare, path, router]);

  if (bare)
    return (
      <>
        <ServiceWorker />
        {children}
      </>
    );

  if (LIVE && ws.status !== "ready") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        {ws.status === "error" ? (
          <div className="max-w-[420px] rounded-[14px] border border-line bg-card p-6">
            <p className="text-[15px] font-medium">โหลดข้อมูลบริษัทไม่สำเร็จ</p>
            <p className="mt-1 text-[13px] text-ink-2">{ws.error}</p>
            <button type="button" onClick={() => void bootWorkspace()} className="mt-4 h-9 rounded-[8px] bg-ink px-4 text-[14px] font-medium text-card">
              ลองอีกครั้ง
            </button>
          </div>
        ) : (
          <p className="text-[14px] text-ink-3">กำลังโหลดข้อมูลบริษัท</p>
        )}
      </div>
    );
  }

  if (isPhone(path))
    return (
      <>
        <ServiceWorker />
        {denied ? <p className="px-6 py-16 text-center text-[14px] text-ink-2">บทบาท {me.roleLabel} ใช้หน้านี้ไม่ได้</p> : children}
        <RemoteErrors />
        <AiChatLauncher />
      </>
    );

  return (
    <>
      <ServiceWorker />
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="min-w-0 flex-1">
          {denied ? (
            <div className="flex min-h-[70vh] items-center justify-center px-8">
              <div className="max-w-[420px] rounded-[14px] border border-line bg-card p-6">
                <p className="text-[15px] font-medium">ไม่มีสิทธิ์เข้าถึง{MODULES[mod!]}</p>
                <p className="mt-1 text-[13px] text-ink-2">บทบาท {me.roleLabel} ดูส่วนนี้ไม่ได้ ติดต่อผู้ดูแลระบบของบริษัทถ้าต้องใช้งาน</p>
              </div>
            </div>
          ) : (
            children
          )}
        </div>
      </div>
      <CommandPalette />
      <AiChatLauncher />
      <RemoteErrors />
    </>
  );
}

function RemoteErrors() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    let t: number | undefined;
    const off = onRemoteError((m) => {
      setMsg(m);
      window.clearTimeout(t);
      t = window.setTimeout(() => setMsg(null), 6000);
    });
    return () => {
      off();
      window.clearTimeout(t);
    };
  }, []);
  if (!msg) return null;
  return (
    <div role="alert" className="enter fixed bottom-4 right-4 z-50 max-w-[420px] rounded-[12px] border border-line-strong bg-card px-4 py-3 text-[13px] shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
      <span className="mr-2 inline-block size-1.5 rounded-full bg-neg align-middle" />
      {msg}
    </div>
  );
}
