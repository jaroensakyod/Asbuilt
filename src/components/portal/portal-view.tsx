"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Box, Download, FileText, MessageCircle, Phone } from "lucide-react";
import { Card, CardHead, PlanBar, Status, cx } from "@/components/ui";
import { HouseThumb } from "@/components/house-thumb";
import { HousePreview } from "@/components/viewer/house-preview";
import { phaseSegments, thLongDate } from "@/components/dashboard/metrics";
import { coverSvg } from "@/app/documents/cover";
import { COMPANY_INFO, getHouseModel, getProject, REPAIR_STATUS_LABEL, STATUS_LABEL, thDate, TODAY, type Project, type Repair } from "@/lib/data";
import { projectDocs, docSize, type DocCategory, type DocItem } from "@/lib/docs-data";
import { installments as installmentsCol, money, type Installment } from "@/lib/biz";
import { useRepairs } from "@/lib/ops-store";
import { fetchPortal, PORTAL_LIVE, projectIdFromDemoToken, useDemoLinksOff, type PortalCompany, type PortalPayload } from "@/lib/portal";
import { RepairReportForm } from "./repair-report-form";
import { usePortalData } from "./portal-data";
import { BoardsSection, DesignSection, MessagesSection, PortalTodo, ReceiptsSection, SelectionsSection, SurveySection, VariationsSection } from "./portal-extras";

const CUSTOMER_DOCS: DocCategory[] = ["contract", "permit", "warranty", "manual"];
const DOC_GROUP: Record<string, string> = { contract: "สัญญา", permit: "ใบอนุญาต", warranty: "ใบรับประกัน", manual: "คู่มือ" };

type Loaded = { state: "loading" } | { state: "invalid" } | { state: "error"; message: string } | { state: "ok"; data: PortalPayload; docs: DocItem[] | null };

/** Demo: build the payload from the bundled data + this browser's edits */
function useDemoPortal(token: string): Loaded {
  const off = useDemoLinksOff();
  const repairs = useRepairs();
  const inst = installmentsCol.use();
  const id = projectIdFromDemoToken(token);
  const project = id ? getProject(id) : undefined;
  if (!project || off.includes(project.id)) return { state: "invalid" };
  return {
    state: "ok",
    data: {
      company: COMPANY_INFO,
      project,
      repairs: repairs.filter((r) => r.projectId === project.id),
      installments: inst.filter((i) => i.projectId === project.id),
    },
    docs: projectDocs(project.id).filter((d) => CUSTOMER_DOCS.includes(d.category)),
  };
}

function useLivePortal(token: string, nonce: number): Loaded {
  const [res, setRes] = useState<{ key: string; v: Loaded } | null>(null);
  const key = `${token}:${nonce}`;
  useEffect(() => {
    let alive = true;
    fetchPortal(token)
      .then((data) => alive && setRes({ key, v: data ? { state: "ok", data, docs: null } : { state: "invalid" } }))
      .catch((e: Error) => alive && setRes({ key, v: { state: "error", message: e.message } }));
    return () => {
      alive = false;
    };
  }, [token, key]);
  return res && (res.key === key || res.v.state === "ok") ? res.v : { state: "loading" };
}

export function PortalView({ token }: { token: string }) {
  return PORTAL_LIVE ? <LivePortal token={token} /> : <DemoPortal token={token} />;
}

function DemoPortal({ token }: { token: string }) {
  const r = useDemoPortal(token);
  return <PortalBody token={token} loaded={r} />;
}

function LivePortal({ token }: { token: string }) {
  const [nonce, setNonce] = useState(0);
  const r = useLivePortal(token, nonce);
  return <PortalBody token={token} loaded={r} onReported={() => setNonce((n) => n + 1)} />;
}

function PortalBody({ token, loaded, onReported }: { token: string; loaded: Loaded; onReported?: () => void }) {
  if (loaded.state === "loading")
    return (
      <Shell>
        <p className="py-24 text-center text-[14px] text-ink-3">กำลังโหลดข้อมูลบ้านของคุณ</p>
      </Shell>
    );
  if (loaded.state === "invalid") return <InvalidLink />;
  if (loaded.state === "error")
    return (
      <Shell>
        <Card className="mt-10 px-5 py-6">
          <p className="text-[15px] font-medium">โหลดข้อมูลไม่สำเร็จ</p>
          <p className="mt-1 text-[13px] text-ink-2">กรุณาลองใหม่อีกครั้งในภายหลัง หรือติดต่อเจ้าหน้าที่โครงการ</p>
          <p className="mt-3 font-mono text-[12px] text-ink-3">{loaded.message}</p>
        </Card>
      </Shell>
    );

  return <LoadedPortal token={token} data={loaded.data} docs={loaded.docs} onReported={onReported} />;
}

function LoadedPortal({ token, data, docs, onReported }: { token: string; data: PortalPayload; docs: DocItem[] | null; onReported?: () => void }) {
  const { company, project, repairs, installments } = data;
  const api = usePortalData(project.id, PORTAL_LIVE ? { token, records: data.records ?? [], reload: () => onReported?.() } : undefined);
  return (
    <Shell company={company}>
      <div className="flex flex-col gap-4 pb-12">
        <Hero project={project} />
        <PortalTodo api={api} />
        <Progress project={project} />
        <DesignSection api={api} project={project} />
        <VariationsSection api={api} project={project} />
        <SelectionsSection api={api} project={project} />
        <BoardsSection api={api} />
        <Payments list={installments} />
        <ReceiptsSection list={installments} project={project} company={company} />
        <Documents docs={docs} project={project} company={company} />
        <MessagesSection api={api} project={project} />
        <Repairs list={repairs} />
        <Card>
          <CardHead title="แจ้งซ่อม" meta={project.status === "delivered" ? "ในระยะประกัน" : undefined} />
          <div className="px-5 py-4">
            <RepairReportForm token={token} projectId={project.id} onDone={onReported} />
          </div>
        </Card>
        <SurveySection api={api} project={project} repairs={repairs} />
        <ContactCard company={company} />
      </div>
    </Shell>
  );
}

// ---------- frame ----------

function Shell({ company, children }: { company?: PortalCompany; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-page">
      <header className="border-b border-line bg-card">
        <div className="mx-auto flex max-w-[760px] items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-[15px] font-medium leading-tight">{company?.name || "พอร์ทัลลูกค้า"}</p>
            <p className="text-[12px] text-ink-3">พอร์ทัลเจ้าของบ้าน</p>
          </div>
          {company?.hotline && (
            <a href={`tel:${company.hotline}`} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[8px] border border-line-strong bg-card px-3 text-[13px] text-ink transition-colors duration-150 hover:bg-raised">
              <Phone size={16} strokeWidth={1.5} />
              <span className="num font-mono">{company.hotline}</span>
            </a>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-[760px] px-4 pt-4">{children}</main>
    </div>
  );
}

export function InvalidLink() {
  return (
    <Shell>
      <Card className="mt-10 px-5 py-8 text-center">
        <p className="text-[17px] font-medium">ลิงก์นี้ใช้งานไม่ได้</p>
        <p className="mx-auto mt-2 max-w-[26rem] text-[14px] text-ink-2">
          ลิงก์อาจถูกยกเลิกหรือพิมพ์ไม่ครบ กรุณาขอลิงก์ใหม่จากผู้จัดการโครงการของคุณ
        </p>
        <p className="mt-5 text-[13px] text-ink-3">
          หรือโทร <a href={`tel:${COMPANY_INFO.hotline}`} className="num font-mono text-ink underline-offset-2 hover:underline">{COMPANY_INFO.hotline}</a>
        </p>
      </Card>
    </Shell>
  );
}

// ---------- sections ----------

function Hero({ project }: { project: Project }) {
  const [show3d, setShow3d] = useState(false);
  const hasModel = !!getHouseModel(project.modelCode);
  return (
    <Card className="overflow-hidden">
      <div className="relative h-[220px] bg-raised sm:h-[280px]">
        {show3d ? (
          <HousePreview pins={[]} code={project.modelCode} />
        ) : hasModel ? (
          <HouseThumb code={project.modelCode} className="h-full w-full" label={`รูปด้านหน้า ${project.model}`} />
        ) : (
          <div className="flex h-full items-center justify-center text-[13px] text-ink-3">{project.model}</div>
        )}
        {hasModel && (
          <button
            type="button"
            onClick={() => setShow3d((v) => !v)}
            className="absolute bottom-3 right-3 inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-line-strong bg-card px-3 text-[13px] text-ink transition-colors duration-150 hover:bg-raised"
          >
            <Box size={16} strokeWidth={1.5} />
            {show3d ? "ดูภาพด้านหน้า" : "ดูแบบ 3 มิติ"}
          </button>
        )}
      </div>
      <div className="px-5 py-4">
        <p className="text-[13px] text-ink-3">
          <span className="font-mono">{project.id}</span> · {STATUS_LABEL[project.status]}
        </p>
        <h1 className="mt-1 text-[24px] font-normal leading-tight">{project.name}</h1>
        <p className="mt-1 text-[14px] text-ink-2">
          แบบบ้าน {project.model} · {project.floors} ชั้น · <span className="num font-mono">{project.area}</span> ตร.ม.
        </p>
      </div>
    </Card>
  );
}

function Progress({ project }: { project: Project }) {
  const delivered = project.status === "delivered";
  const segs = phaseSegments(project);
  const diff = Math.round(project.actual - project.plan);
  return (
    <Card>
      <CardHead title="ความคืบหน้า" meta={`ข้อมูล ณ ${thDate(TODAY)}`} />
      <div className="px-5 py-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[13px] text-ink-2">ทำแล้ว</p>
            <p className="num text-[34px] font-medium leading-none">
              {project.actual}
              <span className="ml-0.5 text-[16px] text-ink-3">%</span>
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-[13px]">
            <dt className="text-ink-3">ตามแผน</dt>
            <dd className="num text-right font-mono">{project.plan}%</dd>
            <dt className="text-ink-3">{delivered ? "ส่งมอบเมื่อ" : "กำหนดส่งมอบ"}</dt>
            <dd className="text-right">{thLongDate(project.handedOver ?? project.finish)}</dd>
          </dl>
        </div>
        <div className="mt-4">
          <PlanBar actual={project.actual} plan={project.plan} />
        </div>
        {!delivered && (
          <p className="mt-3 text-[13px] text-ink-2">
            ขณะนี้อยู่ในขั้น <span className="text-ink">{project.phase}</span>
            {diff < -2 ? ` · ช้ากว่าแผน ${-diff}% ทีมงานกำลังเร่งงาน` : diff > 0 ? ` · เร็วกว่าแผน ${diff}%` : " · เป็นไปตามแผน"}
          </p>
        )}
        {delivered && project.warrantyUntil && (
          <p className="mt-3 text-[13px] text-ink-2">
            รับประกันถึง <span className="text-ink">{thLongDate(project.warrantyUntil)}</span>
          </p>
        )}

        <ol className="mt-5 flex flex-col">
          {segs.map((s, i) => (
            <li key={s.phase} className="relative flex gap-3 pb-3 last:pb-0">
              {i < segs.length - 1 && <span aria-hidden className="absolute left-[5px] top-4 h-[calc(100%-8px)] w-px bg-line" />}
              <span
                aria-hidden
                className={cx(
                  "relative mt-1.5 size-[11px] shrink-0 rounded-full border",
                  s.state === "done" ? "border-ink bg-ink" : s.state === "current" ? "border-accent bg-accent" : s.state === "late" ? "border-warn bg-card" : "border-line-strong bg-card",
                )}
              />
              <div className="flex min-w-0 flex-1 items-baseline justify-between gap-3">
                <span className={cx("text-[14px]", s.state === "future" ? "text-ink-3" : "text-ink")}>{s.label}</span>
                <span className="num shrink-0 font-mono text-[12px] text-ink-3">
                  {s.state === "done" ? "เสร็จแล้ว" : s.state === "future" ? "ยังไม่เริ่ม" : `${Math.round(s.actual)}%`}
                </span>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </Card>
  );
}

const PAY_LABEL: Record<Installment["status"], { text: string; tone: "pos" | "warn" | "neg" | "neutral" | "accent" }> = {
  paid: { text: "ชำระแล้ว", tone: "pos" },
  invoiced: { text: "ออกใบแจ้งหนี้แล้ว", tone: "accent" },
  due: { text: "ถึงกำหนดชำระ", tone: "warn" },
  overdue: { text: "เลยกำหนดชำระ", tone: "neg" },
  scheduled: { text: "ยังไม่ถึงกำหนด", tone: "neutral" },
};

function Payments({ list }: { list: Installment[] }) {
  const rows = [...list].sort((a, b) => a.no - b.no);
  const total = (f: (i: Installment) => boolean) => rows.filter(f).reduce((s, i) => s + i.amount + i.vat, 0);
  const paid = total((i) => i.status === "paid");
  const due = total((i) => i.status === "due" || i.status === "invoiced" || i.status === "overdue");
  const upcoming = total((i) => i.status === "scheduled");
  return (
    <Card>
      <CardHead title="งวดการชำระเงิน" meta="รวม VAT 7%" />
      {rows.length === 0 ? (
        <p className="px-5 py-5 text-[14px] text-ink-3">ตารางงวดชำระจะแสดงที่นี่เมื่อเจ้าหน้าที่บันทึกในระบบ</p>
      ) : (
        <>
          <div className="grid grid-cols-3 border-b border-line">
            {[
              ["ชำระแล้ว", paid],
              ["ถึงกำหนด", due],
              ["งวดถัดไป", upcoming],
            ].map(([l, v], i) => (
              <div key={l as string} className={cx("px-4 py-3", i > 0 && "border-l border-line")}>
                <p className="text-[12px] text-ink-3">{l}</p>
                <p className="num mt-0.5 font-mono text-[15px]">฿{money(v as number)}</p>
              </div>
            ))}
          </div>
          <ul className="divide-y divide-line">
            {rows.map((i) => (
              <li key={i.id} className="flex items-start justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="text-[14px]">
                    <span className="num font-mono text-ink-3">{i.no}.</span> {i.title}
                  </p>
                  <p className="mt-0.5 text-[12px] text-ink-3">
                    {i.status === "paid" && i.paidDate ? `ชำระ ${thDate(i.paidDate)}` : `กำหนด ${thDate(i.dueDate)}`}
                    {i.receiptNo ? ` · ใบเสร็จ ${i.receiptNo}` : i.invoiceNo ? ` · ใบแจ้งหนี้ ${i.invoiceNo}` : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="num font-mono text-[14px]">฿{money(i.amount + i.vat)}</p>
                  <div className="mt-0.5">
                    <Status tone={PAY_LABEL[i.status].tone}>{PAY_LABEL[i.status].text}</Status>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

function Documents({ docs, project, company }: { docs: DocItem[] | null; project: Project; company: PortalCompany }) {
  const download = (d: DocItem) => {
    const svg = coverSvg(d, project.name, company.name);
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${d.file.replace(/\.[^.]+$/, "")}_cover.svg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  return (
    <Card>
      <CardHead title="เอกสารของบ้าน" meta={docs ? `${docs.length} ไฟล์` : undefined} />
      {docs === null ? (
        <p className="px-5 py-5 text-[14px] text-ink-3">ขอสำเนาสัญญา ใบอนุญาต ใบรับประกัน หรือคู่มือบ้านได้จากผู้จัดการโครงการ</p>
      ) : docs.length === 0 ? (
        <p className="px-5 py-5 text-[14px] text-ink-3">ยังไม่มีเอกสารสำหรับเจ้าของบ้าน</p>
      ) : (
        <ul className="divide-y divide-line">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="flex min-w-0 items-start gap-3">
                <FileText size={16} strokeWidth={1.5} className="mt-0.5 shrink-0 text-ink-3" />
                <div className="min-w-0">
                  <p className="truncate text-[14px]">{d.title}</p>
                  <p className="text-[12px] text-ink-3">
                    {DOC_GROUP[d.category]} · {thDate(d.date)} · {docSize(d.sizeKb)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => download(d)}
                aria-label={`ดาวน์โหลด ${d.title}`}
                title="ดาวน์โหลดใบปะหน้า (ไฟล์ตัวอย่าง)"
                className="flex size-9 shrink-0 items-center justify-center rounded-[8px] border border-line-strong text-ink-2 transition-colors duration-150 hover:bg-raised hover:text-ink"
              >
                <Download size={16} strokeWidth={1.5} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

const REPAIR_TONE: Record<Repair["status"], "warn" | "accent" | "neutral" | "pos"> = { open: "warn", fixing: "accent", waiting: "neutral", closed: "pos" };

function Repairs({ list }: { list: Repair[] }) {
  const open = list.filter((r) => r.status !== "closed").sort((a, b) => b.reported.localeCompare(a.reported));
  const closed = list.filter((r) => r.status === "closed").sort((a, b) => b.reported.localeCompare(a.reported)).slice(0, 3);
  const rows = [...open, ...closed];
  return (
    <Card>
      <CardHead title="รายการแจ้งซ่อม" meta={open.length ? `${open.length} รายการที่ยังไม่ปิด` : undefined} />
      {rows.length === 0 ? (
        <p className="px-5 py-5 text-[14px] text-ink-3">ไม่มีรายการแจ้งซ่อม</p>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((r) => (
            <li key={r.id} className="flex items-start justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="text-[14px]">{r.title}</p>
                <p className="mt-0.5 text-[12px] text-ink-3">
                  <span className="font-mono">{r.id}</span> · {r.location} · แจ้ง {thDate(r.reported)}
                </p>
              </div>
              <Status tone={REPAIR_TONE[r.status]}>{REPAIR_STATUS_LABEL[r.status]}</Status>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ContactCard({ company }: { company: PortalCompany }) {
  return (
    <Card className="px-5 py-4">
      <p className="text-[15px] font-medium">ติดต่อบริษัท</p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[14px]">
        {company.hotline && (
          <>
            <dt className="flex items-center gap-1.5 text-ink-3">
              <Phone size={16} strokeWidth={1.5} /> สายด่วน
            </dt>
            <dd>
              <a href={`tel:${company.hotline}`} className="num font-mono hover:underline">{company.hotline}</a>
            </dd>
          </>
        )}
        {company.phone && (
          <>
            <dt className="flex items-center gap-1.5 text-ink-3">
              <Phone size={16} strokeWidth={1.5} /> สำนักงาน
            </dt>
            <dd>
              <a href={`tel:${company.phone}`} className="num font-mono hover:underline">{company.phone}</a>
            </dd>
          </>
        )}
        {company.line && (
          <>
            <dt className="flex items-center gap-1.5 text-ink-3">
              <MessageCircle size={16} strokeWidth={1.5} /> LINE
            </dt>
            <dd className="font-mono">{company.line}</dd>
          </>
        )}
      </dl>
    </Card>
  );
}
