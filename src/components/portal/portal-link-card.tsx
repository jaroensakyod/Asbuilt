"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Copy, ExternalLink, Link2Off, RefreshCw, Check } from "lucide-react";
import { Card, CardHead, Status, cx } from "@/components/ui";
import { useMe } from "@/lib/use-me";
import { canEdit } from "@/lib/permissions";
import {
  createLink,
  fetchActiveLink,
  PORTAL_LIVE,
  portalTokenFor,
  portalUrl,
  regenerateLink,
  revokeLink,
  setDemoLinkOff,
  useDemoLinksOff,
} from "@/lib/portal";
import { qrPath } from "./qr";

const btn =
  "inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-line-strong bg-card px-3 text-[13px] text-ink transition-colors duration-150 hover:bg-raised disabled:cursor-not-allowed disabled:opacity-40";

/** QR code drawn as SVG (own encoder, byte mode, ECC M) */
export function QrCode({ value, size = 132, className }: { value: string; size?: number; className?: string }) {
  const qr = useMemo(() => {
    try {
      return qrPath(value);
    } catch {
      return null;
    }
  }, [value]);
  if (!qr) return null;
  return (
    <svg viewBox={`0 0 ${qr.size} ${qr.size}`} width={size} height={size} className={className} role="img" aria-label="QR code ลิงก์พอร์ทัล" shapeRendering="crispEdges">
      <rect width={qr.size} height={qr.size} fill="#fff" />
      <path d={qr.d} fill="#1f1b16" />
    </svg>
  );
}

const noSub = () => () => {};

type LiveState = { status: "loading" } | { status: "none" } | { status: "ok"; token: string; createdAt: string } | { status: "error"; message: string };

/** Customer-portal link for a project: copy, open, QR, revoke/regenerate. Mount on /projects/[id]. */
export function PortalLinkCard({ projectId }: { projectId: string }) {
  const me = useMe();
  const editable = canEdit(me.role, "projects");
  const off = useDemoLinksOff();
  const [live, setLive] = useState<LiveState>({ status: "loading" });
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const origin = useSyncExternalStore(noSub, () => window.location.origin, () => "");

  useEffect(() => {
    if (!PORTAL_LIVE) return;
    let alive = true;
    fetchActiveLink(projectId)
      .then((l) => alive && setLive(l ? { status: "ok", token: l.token, createdAt: l.createdAt } : { status: "none" }))
      .catch((e: Error) => alive && setLive({ status: "error", message: e.message }));
    return () => {
      alive = false;
    };
  }, [projectId]);

  const token = PORTAL_LIVE ? (live.status === "ok" ? live.token : null) : off.includes(projectId) ? null : portalTokenFor(projectId);
  const url = token ? (origin ? `${origin}/portal/${token}` : portalUrl(token)) : null;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setLive({ status: "error", message: e instanceof Error ? e.message : "ไม่สำเร็จ" });
    } finally {
      setBusy(false);
      setConfirmRevoke(false);
    }
  };

  const create = () =>
    PORTAL_LIVE
      ? run(async () => {
          const l = await createLink(projectId);
          setLive({ status: "ok", token: l.token, createdAt: l.createdAt });
        })
      : setDemoLinkOff(projectId, false);
  const regenerate = () =>
    PORTAL_LIVE
      ? run(async () => {
          const l = await regenerateLink(projectId);
          setLive({ status: "ok", token: l.token, createdAt: l.createdAt });
        })
      : setDemoLinkOff(projectId, false);
  const revoke = () => {
    if (!PORTAL_LIVE) {
      setDemoLinkOff(projectId, true);
      setConfirmRevoke(false);
      return;
    }
    if (live.status !== "ok") return;
    void run(async () => {
      await revokeLink(live.token);
      setLive({ status: "none" });
    });
  };

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard blocked: the link text is selectable
    }
  };

  return (
    <Card>
      <CardHead
        title="พอร์ทัลเจ้าของบ้าน"
        meta={PORTAL_LIVE ? undefined : "โหมดตัวอย่าง"}
        action={token ? <Status tone="pos">เปิดใช้งาน</Status> : <Status>ปิดอยู่</Status>}
      />
      <div className="px-5 py-4">
        {PORTAL_LIVE && live.status === "loading" ? (
          <p className="text-[13px] text-ink-3">กำลังโหลดลิงก์</p>
        ) : url ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="shrink-0 self-start rounded-[8px] border border-line bg-white p-1">
              <QrCode value={url} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] text-ink-2">ส่งลิงก์นี้ให้เจ้าของบ้านเพื่อดูความคืบหน้า งวดชำระ เอกสาร และแจ้งซ่อมได้เอง โดยไม่ต้องเข้าสู่ระบบ</p>
              <p className="mt-2 select-all break-all rounded-[8px] border border-line bg-raised px-3 py-2 font-mono text-[12px] text-ink">{url}</p>
              {PORTAL_LIVE && live.status === "ok" && (
                <p className="mt-1.5 text-[12px] text-ink-3">สร้างเมื่อ {new Date(live.createdAt).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className={btn} onClick={copy}>
                  {copied ? <Check size={16} strokeWidth={1.5} /> : <Copy size={16} strokeWidth={1.5} />}
                  {copied ? "คัดลอกแล้ว" : "คัดลอกลิงก์"}
                </button>
                <a className={btn} href={url} target="_blank" rel="noreferrer">
                  <ExternalLink size={16} strokeWidth={1.5} />
                  เปิดดู
                </a>
                {editable && PORTAL_LIVE && (
                  <button type="button" className={btn} onClick={regenerate} disabled={busy} title="ยกเลิกลิงก์เดิมแล้วสร้างลิงก์ใหม่">
                    <RefreshCw size={16} strokeWidth={1.5} />
                    สร้างลิงก์ใหม่
                  </button>
                )}
                {editable &&
                  (confirmRevoke ? (
                    <span className="flex items-center gap-2">
                      <button type="button" className={cx(btn, "border-neg/40 text-neg")} onClick={revoke} disabled={busy}>
                        ยืนยันยกเลิก
                      </button>
                      <button type="button" className={btn} onClick={() => setConfirmRevoke(false)}>
                        ไม่ยกเลิก
                      </button>
                    </span>
                  ) : (
                    <button type="button" className={btn} onClick={() => setConfirmRevoke(true)} disabled={busy}>
                      <Link2Off size={16} strokeWidth={1.5} />
                      ยกเลิกลิงก์
                    </button>
                  ))}
              </div>
              {!PORTAL_LIVE && <p className="mt-3 text-[12px] text-ink-3">โหมดตัวอย่าง: ลิงก์คงที่ต่อโครงการ การยกเลิกมีผลเฉพาะในเบราว์เซอร์นี้</p>}
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[13px] text-ink-2">
              {live.status === "error" ? `ทำรายการไม่สำเร็จ: ${live.message}` : "ยังไม่มีลิงก์ที่ใช้งานได้ เจ้าของบ้านจะเปิดลิงก์เดิมไม่ได้"}
            </p>
            {editable && (
              <button type="button" className={btn} onClick={create} disabled={busy}>
                <RefreshCw size={16} strokeWidth={1.5} />
                สร้างลิงก์
              </button>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
