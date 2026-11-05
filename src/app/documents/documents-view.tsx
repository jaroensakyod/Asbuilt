"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Download, FileCode, FileImage, FileText, Folder, Layers, Pencil, PencilRuler, Search, Trash2, Upload, X } from "lucide-react";
import { Card, Field, PageHeader, Status, cx, inputCls } from "@/components/ui";
import { COMPANY_INFO, daysBetween, projects as seedProjects, team, thDate, TODAY, type Project } from "@/lib/data";
import {
  allDocs,
  DOC_CATEGORIES,
  DOC_CATEGORY_LABEL,
  DOC_TYPE_LABEL,
  DOC_TYPES,
  docSize,
  fileTypeOf,
  type DocCategory,
  type DocFileType,
  type DocItem,
} from "@/lib/docs-data";
import { useLocalProjects } from "@/lib/projects-store";
import { isLiveReady, workspace } from "@/lib/workspace";
import { signedDocUrl, uploadDocFile, useSignedDocUrl, type StoredDoc } from "@/lib/doc-files";
import { coverSvg, svgDataUrl } from "./cover";
import { DocAskButton } from "@/components/ai-docs/doc-ask";

import { uploads, overrides, type Override } from "@/lib/docs-store";

/** Object URLs for files picked in this tab; gone after a reload, metadata stays */
const sessionUrls = new Map<string, string>();

const uploader = () => (isLiveReady() ? workspace().displayName : undefined) ?? team[0]?.name ?? "ผู้ดูแลระบบ";
const PAGE = 60;

function initials(name: string) {
  const lead = /^[เแโใไ]/;
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => (lead.test(w) ? w.slice(1, 2) : w.slice(0, 1)))
    .join("");
}

function guessCategory(file: File): DocCategory {
  const n = file.name.toLowerCase();
  const t = fileTypeOf(file.name, file.type);
  if (t === "image") return "photo";
  if (t === "dwg" || t === "svg") return "drawing";
  if (n.includes("boq")) return "boq";
  if (n.includes("contract") || n.includes("สัญญา")) return "contract";
  if (n.includes("permit")) return "permit";
  if (n.includes("warranty")) return "warranty";
  if (n.includes("manual")) return "manual";
  return "report";
}

function TypeIcon({ type }: { type: DocFileType }) {
  const Icon = type === "image" ? FileImage : type === "svg" ? FileCode : type === "dwg" ? PencilRuler : FileText;
  return (
    <span className={cx("grid size-8 shrink-0 place-items-center rounded-[8px]", type === "pdf" ? "bg-accent-soft text-accent-text" : "bg-raised text-ink-2")}>
      <Icon size={16} strokeWidth={1.5} />
    </span>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-full border border-line-strong bg-raised text-[11px] text-ink-2">
      {initials(name)}
    </span>
  );
}

function StatCard({ label, value, unit, note, icon }: { label: string; value: string; unit?: string; note: string; icon: ReactNode }) {
  return (
    <Card className="flex gap-3 px-5 py-4">
      <span className="grid size-8 shrink-0 place-items-center rounded-[8px] bg-raised text-ink-2">{icon}</span>
      <div className="min-w-0">
        <p className="text-[13px] text-ink-2">{label}</p>
        <p className="mt-1 flex items-baseline gap-1.5">
          <span className="num font-mono text-[26px] font-medium leading-none">{value}</span>
          {unit && <span className="text-[13px] text-ink-3">{unit}</span>}
        </p>
        <p className="mt-1.5 truncate text-[12px] text-ink-3">{note}</p>
      </div>
    </Card>
  );
}

function download(href: string, name: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/30 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal aria-label={title} className="enter w-full max-w-[520px] rounded-[14px] border border-line bg-card shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
        <header className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className="text-[15px] font-medium">{title}</h2>
          <button type="button" onClick={onClose} aria-label="ปิด" className="grid size-8 place-items-center rounded-[8px] text-ink-3 hover:bg-raised hover:text-ink">
            <X size={16} strokeWidth={1.5} />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

const btn = "inline-flex h-9 items-center gap-2 rounded-[8px] px-4 text-[14px] font-medium transition-[background-color,transform] duration-150 active:scale-[0.98]";
const btnPrimary = cx(btn, "bg-ink text-card hover:bg-[#253d5c]");
const btnGhost = cx(btn, "border border-line-strong bg-card text-ink hover:bg-raised");
const iconBtn = "grid size-8 place-items-center rounded-[8px] text-ink-3 transition-colors duration-150 hover:bg-raised hover:text-ink";

// ---------- view ----------

export function DocumentsView() {
  const params = useSearchParams();
  const localProjects = useLocalProjects();
  const uploaded = uploads.use();
  const edits = overrides.use();

  const [folder, setFolder] = useState<string>(params.get("project") ?? "all");
  const [q, setQ] = useState(params.get("q") ?? "");
  const [cat, setCat] = useState<DocCategory | "all">("all");
  const [type, setType] = useState<DocFileType | "all">("all");
  const [limit, setLimit] = useState(PAGE);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [pending, setPending] = useState<{ files: File[]; project: string; category: DocCategory } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const allProjects = useMemo<Project[]>(() => [...localProjects, ...seedProjects], [localProjects]);
  const projectById = useMemo(() => new Map(allProjects.map((p) => [p.id, p])), [allProjects]);

  const docs = useMemo(
    () =>
      [...uploaded, ...allDocs].map((d) => {
        const o = edits[d.id];
        return o ? { ...d, ...o } : d;
      }),
    [uploaded, edits],
  );

  const folders = useMemo(() => {
    const count = new Map<string, number>();
    const latest = new Map<string, string>();
    for (const d of docs) {
      count.set(d.projectId, (count.get(d.projectId) ?? 0) + 1);
      if ((latest.get(d.projectId) ?? "") < d.date) latest.set(d.projectId, d.date);
    }
    return allProjects
      .map((p) => ({ p, n: count.get(p.id) ?? 0, latest: latest.get(p.id) ?? p.contractDate ?? "" }))
      .sort((a, b) => b.latest.localeCompare(a.latest) || b.p.id.localeCompare(a.p.id));
  }, [docs, allProjects]);

  const needle = q.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      docs
        .filter((d) => folder === "all" || d.projectId === folder)
        .filter((d) => cat === "all" || d.category === cat)
        .filter((d) => type === "all" || d.type === type)
        .filter((d) => {
          if (!needle) return true;
          const p = projectById.get(d.projectId);
          return [d.title, d.file, d.projectId, p?.name ?? "", p?.owner ?? "", ...d.tags].some((s) => s.toLowerCase().includes(needle));
        })
        .sort((a, b) => b.date.localeCompare(a.date)),
    [docs, folder, cat, type, needle, projectById],
  );

  const stats = useMemo(() => {
    const kb = docs.reduce((s, d) => s + d.sizeKb, 0);
    const recent = docs.filter((d) => daysBetween(d.date, TODAY) <= 30 && daysBetween(d.date, TODAY) >= 0).length;
    const by = (c: DocCategory) => docs.filter((d) => d.category === c).length;
    return { kb, recent, legal: by("contract") + by("permit"), drawings: by("drawing"), warranty: by("warranty"), projects: new Set(docs.map((d) => d.projectId)).size };
  }, [docs]);

  const preview = previewId ? docs.find((d) => d.id === previewId) ?? null : null;
  const editing = editId ? docs.find((d) => d.id === editId) ?? null : null;
  const reset = () => setLimit(PAGE);

  useEffect(() => {
    if (!previewId) return;
    const on = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreviewId(null);
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [previewId]);

  const projectLabel = (id: string) => projectById.get(id)?.name ?? id;

  const downloadDoc = async (d: DocItem) => {
    const url = sessionUrls.get(d.id);
    if (url) return download(url, d.file);
    if ((d as StoredDoc).storagePath) {
      const signed = await signedDocUrl(d as StoredDoc, true);
      if (signed) return download(signed, d.file);
    }
    if (d.local) return setPreviewId(d.id);
    const svg = coverSvg(d, projectLabel(d.projectId), COMPANY_INFO.name);
    const blob = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    download(blob, `${d.file.replace(/\.[^.]+$/, "")}_cover.svg`);
    setTimeout(() => URL.revokeObjectURL(blob), 2000);
  };

  const onPick = (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (!files.length) return;
    setPending({ files, project: folder !== "all" ? folder : allProjects[0]?.id ?? "", category: guessCategory(files[0]) });
  };

  const confirmUpload = () => {
    if (!pending) return;
    const stamp = Date.now();
    const items: DocItem[] = pending.files.map((f, i) => {
      const id = `U-${stamp}-${i}`;
      sessionUrls.set(id, URL.createObjectURL(f));
      const t = fileTypeOf(f.name, f.type);
      return {
        id,
        title: f.name.replace(/\.[^.]+$/, ""),
        file: f.name,
        category: pending.category,
        type: t,
        projectId: pending.project,
        sizeKb: Math.max(1, Math.round(f.size / 1024)),
        by: uploader(),
        date: TODAY,
        tags: [DOC_CATEGORY_LABEL[pending.category], "อัปโหลด"],
        local: true,
        mime: f.type,
      };
    });
    uploads.set((prev) => [...items, ...prev]);
    if (isLiveReady())
      pending.files.forEach((f, i) => {
        void uploadDocFile(items[i], f).then((stored) => stored && uploads.set((prev) => prev.map((d) => (d.id === stored.id ? stored : d))));
      });
    setPending(null);
    if (fileRef.current) fileRef.current.value = "";
    setPreviewId(items[0]?.id ?? null);
  };

  const removeUpload = (id: string) => {
    const url = sessionUrls.get(id);
    if (url) URL.revokeObjectURL(url);
    sessionUrls.delete(id);
    uploads.set((prev) => prev.filter((d) => d.id !== id));
    overrides.set((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setPreviewId(null);
  };

  const selectCls = cx(inputCls, "pr-8");

  return (
    <>
      <PageHeader
        title="เอกสารโครงการ"
        sub="สัญญา ใบอนุญาต แบบก่อสร้าง รายงาน ใบรับประกัน และคู่มือ จัดเก็บตามโครงการ ค้นหาและดูตัวอย่างได้ทันที"
        actions={
          <>
            <input ref={fileRef} type="file" multiple accept=".pdf,.svg,.dwg,.dxf,image/*" className="hidden" onChange={(e) => onPick(e.target.files)} />
            <button type="button" className={btnPrimary} onClick={() => fileRef.current?.click()}>
              <Upload size={16} strokeWidth={1.5} />
              อัปโหลดเอกสาร
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="เอกสารทั้งหมด" value={docs.length.toLocaleString("th-TH")} unit="ไฟล์" note={`${stats.projects} โครงการ`} icon={<FileText size={16} strokeWidth={1.5} />} />
        <StatCard label="พื้นที่จัดเก็บ" value={docSize(stats.kb)} note="PDF · SVG · รูปภาพ · DWG" icon={<Layers size={16} strokeWidth={1.5} />} />
        <StatCard label="อัปโหลด 30 วัน" value={String(stats.recent)} unit="ไฟล์" note={`ถึง ${thDate(TODAY)}`} icon={<Upload size={16} strokeWidth={1.5} />} />
        <StatCard label="สัญญา / ใบอนุญาต" value={String(stats.legal)} unit="ไฟล์" note={`แบบก่อสร้าง ${stats.drawings} · ใบรับประกัน ${stats.warranty}`} icon={<Folder size={16} strokeWidth={1.5} />} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* folders */}
        <Card className="self-start lg:sticky lg:top-[72px]">
          <header className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <h2 className="text-[15px] font-medium">โฟลเดอร์โครงการ</h2>
            <span className="font-mono text-[12px] text-ink-3">{folders.length}</span>
          </header>
          <ul className="max-h-[calc(100vh-200px)] overflow-y-auto p-2">
            <li>
              <button
                type="button"
                onClick={() => {
                  setFolder("all");
                  reset();
                }}
                className={cx("flex h-10 w-full items-center gap-2.5 rounded-[8px] px-3 text-left text-[14px] transition-colors duration-150", folder === "all" ? "bg-raised text-ink" : "text-ink-2 hover:bg-raised/60")}
              >
                <Layers size={16} strokeWidth={1.5} className="text-ink-3" />
                <span className="flex-1">เอกสารล่าสุด (ทุกโครงการ)</span>
                <span className="font-mono text-[12px] text-ink-3">{docs.length}</span>
              </button>
            </li>
            {folders.map(({ p, n }) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    setFolder(p.id);
                    reset();
                  }}
                  className={cx("flex w-full items-center gap-2.5 rounded-[8px] px-3 py-1.5 text-left transition-colors duration-150", folder === p.id ? "bg-raised" : "hover:bg-raised/60")}
                >
                  <Folder size={16} strokeWidth={1.5} className="shrink-0 text-ink-3" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] text-ink">{p.name}</span>
                    <span className="block font-mono text-[11px] leading-4 text-ink-3">{p.id}</span>
                  </span>
                  <span className="font-mono text-[12px] text-ink-3">{n}</span>
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <div className="min-w-0 space-y-4">
          {/* filters */}
          <Card className="flex flex-wrap items-end gap-3 px-5 py-4">
            <div className="min-w-[240px] flex-1">
              <Field label="ค้นหา">
                <span className="relative">
                  <Search size={16} strokeWidth={1.5} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
                  <input
                    value={q}
                    onChange={(e) => {
                      setQ(e.target.value);
                      reset();
                    }}
                    placeholder="ชื่อเอกสาร แท็ก ชื่อไฟล์ หรือโครงการ"
                    className={cx(inputCls, "w-full pl-9")}
                  />
                </span>
              </Field>
            </div>
            <Field label="หมวด">
              <select
                value={cat}
                onChange={(e) => {
                  setCat(e.target.value as DocCategory | "all");
                  reset();
                }}
                className={selectCls}
              >
                <option value="all">ทุกหมวด</option>
                {DOC_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {DOC_CATEGORY_LABEL[c]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="ชนิดไฟล์">
              <select
                value={type}
                onChange={(e) => {
                  setType(e.target.value as DocFileType | "all");
                  reset();
                }}
                className={selectCls}
              >
                <option value="all">ทุกชนิด</option>
                {DOC_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {DOC_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </Field>
            {(q || cat !== "all" || type !== "all" || folder !== "all") && (
              <button
                type="button"
                className={btnGhost}
                onClick={() => {
                  setQ("");
                  setCat("all");
                  setType("all");
                  setFolder("all");
                  reset();
                }}
              >
                ล้างตัวกรอง
              </button>
            )}
          </Card>

          {/* table */}
          <Card className="overflow-hidden">
            <header className="flex items-baseline justify-between gap-4 border-b border-line px-5 py-3.5">
              <div className="flex items-baseline gap-3">
                <h2 className="text-[15px] font-medium">{folder === "all" ? "เอกสารล่าสุด" : projectLabel(folder)}</h2>
                <span className="font-mono text-[12px] text-ink-3">{filtered.length} ไฟล์</span>
              </div>
              {folder !== "all" && (
                <Link href={`/projects/${folder}`} className="text-[13px] text-ink-2 transition-colors duration-150 hover:text-ink">
                  ไปที่โครงการ
                </Link>
              )}
            </header>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left">
                <thead>
                  <tr className="border-b border-line text-[12px] text-ink-3">
                    <th className="px-5 py-2.5 font-normal">เอกสาร</th>
                    <th className="px-3 py-2.5 font-normal">หมวด</th>
                    <th className="px-3 py-2.5 font-normal">โครงการ</th>
                    <th className="px-3 py-2.5 text-right font-normal">ขนาด</th>
                    <th className="px-3 py-2.5 font-normal">ผู้อัปโหลด</th>
                    <th className="px-3 py-2.5 font-normal">วันที่</th>
                    <th className="w-[88px] px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, limit).map((d) => (
                    <tr key={d.id} className={cx("border-b border-line transition-colors duration-150 last:border-0 hover:bg-raised/50", previewId === d.id && "bg-raised/60")}>
                      <td className="max-w-[420px] px-5 py-2.5">
                        <button type="button" onClick={() => setPreviewId(d.id)} className="flex w-full min-w-0 items-center gap-3 text-left">
                          <TypeIcon type={d.type} />
                          <span className="min-w-0">
                            <span className="block truncate text-[14px] text-ink">{d.title}</span>
                            <span className="block truncate text-[12px] text-ink-3">
                              <span className="font-mono">{d.file}</span> · {d.tags.join(", ")}
                            </span>
                          </span>
                        </button>
                      </td>
                      <td className="px-3 py-2.5">
                        <Status tone={d.local ? "accent" : "neutral"}>{DOC_CATEGORY_LABEL[d.category]}</Status>
                      </td>
                      <td className="px-3 py-2.5">
                        <Link href={`/projects/${d.projectId}`} className="block max-w-[200px] hover:opacity-70">
                          <span className="block truncate text-[13px] text-ink">{projectLabel(d.projectId)}</span>
                          <span className="block font-mono text-[11px] leading-4 text-ink-3">{d.projectId}</span>
                        </Link>
                      </td>
                      <td className="num px-3 py-2.5 text-right font-mono text-[13px] text-ink-2">{docSize(d.sizeKb)}</td>
                      <td className="px-3 py-2.5">
                        <span className="flex items-center gap-2 whitespace-nowrap text-[13px] text-ink-2">
                          <Avatar name={d.by} />
                          {d.by}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[13px] text-ink-2">{thDate(d.date)}</td>
                      <td className="px-3 py-2.5">
                        <span className="flex justify-end gap-0.5">
                          <button type="button" className={iconBtn} aria-label={`ดาวน์โหลด ${d.file}`} title="ดาวน์โหลด" onClick={() => downloadDoc(d)}>
                            <Download size={16} strokeWidth={1.5} />
                          </button>
                          <button type="button" className={iconBtn} aria-label={`แก้ไข ${d.title}`} title="แก้ไข" onClick={() => setEditId(d.id)}>
                            <Pencil size={16} strokeWidth={1.5} />
                          </button>
                        </span>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-5 py-12 text-center text-ink-3">
                        ไม่พบเอกสารตามตัวกรองนี้
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {filtered.length > limit && (
              <div className="flex items-center justify-between border-t border-line px-5 py-3 text-[13px] text-ink-3">
                <span>
                  แสดง <span className="font-mono">{limit}</span> จาก <span className="font-mono">{filtered.length}</span> ไฟล์
                </span>
                <button type="button" className={btnGhost} onClick={() => setLimit((l) => l + PAGE)}>
                  แสดงเพิ่ม
                </button>
              </div>
            )}
          </Card>
        </div>
      </div>

      {preview && (
        <PreviewPanel
          doc={preview}
          projectName={projectLabel(preview.projectId)}
          onClose={() => setPreviewId(null)}
          onDownload={() => downloadDoc(preview)}
          onEdit={() => setEditId(preview.id)}
          onRemove={preview.local ? () => removeUpload(preview.id) : undefined}
        />
      )}

      {editing && (
        <EditDialog
          doc={editing}
          onClose={() => setEditId(null)}
          onSave={(o) => {
            overrides.set((prev) => ({ ...prev, [editing.id]: o }));
            setEditId(null);
          }}
        />
      )}

      {pending && (
        <Modal title="อัปโหลดเอกสาร" onClose={() => setPending(null)}>
          <div className="space-y-4 px-5 py-4">
            <ul className="max-h-[180px] space-y-1.5 overflow-y-auto">
              {pending.files.map((f, i) => (
                <li key={i} className="flex items-center gap-3 rounded-[8px] bg-raised px-3 py-2">
                  <TypeIcon type={fileTypeOf(f.name, f.type)} />
                  <span className="min-w-0 flex-1 truncate font-mono text-[13px]">{f.name}</span>
                  <span className="font-mono text-[12px] text-ink-3">{docSize(f.size / 1024)}</span>
                </li>
              ))}
            </ul>
            <Field label="โครงการ">
              <select value={pending.project} onChange={(e) => setPending({ ...pending, project: e.target.value })} className={selectCls}>
                {allProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.id} · {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="หมวด">
              <select value={pending.category} onChange={(e) => setPending({ ...pending, category: e.target.value as DocCategory })} className={selectCls}>
                {DOC_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {DOC_CATEGORY_LABEL[c]}
                  </option>
                ))}
              </select>
            </Field>
            <p className="text-[12px] text-ink-3">ข้อมูลไฟล์บันทึกในเบราว์เซอร์นี้ ตัวอย่างไฟล์ดูได้จนกว่าจะปิดหรือรีเฟรชหน้า</p>
          </div>
          <footer className="flex justify-end gap-2 border-t border-line px-5 py-3">
            <button type="button" className={btnGhost} onClick={() => setPending(null)}>
              ยกเลิก
            </button>
            <button type="button" className={btnPrimary} onClick={confirmUpload} disabled={!pending.project}>
              <Upload size={16} strokeWidth={1.5} />
              อัปโหลด {pending.files.length} ไฟล์
            </button>
          </footer>
        </Modal>
      )}
    </>
  );
}

function PreviewPanel({
  doc,
  projectName,
  onClose,
  onDownload,
  onEdit,
  onRemove,
}: {
  doc: DocItem;
  projectName: string;
  onClose: () => void;
  onDownload: () => void;
  onEdit: () => void;
  onRemove?: () => void;
}) {
  const signed = useSignedDocUrl(doc as StoredDoc);
  const url = sessionUrls.get(doc.id) ?? signed ?? undefined;
  let body: ReactNode;
  if (doc.local || (doc as StoredDoc).storagePath) {
    if (!url) body = <Empty text="ตัวอย่างไฟล์ดูได้เฉพาะในเซสชันที่อัปโหลด ข้อมูลไฟล์ยังเก็บไว้ อัปโหลดใหม่เพื่อดูตัวอย่าง" />;
    else if (doc.type === "pdf") body = <iframe src={url} title={doc.title} className="h-full min-h-[60vh] w-full rounded-[8px] border border-line bg-card" />;
    else if (doc.type === "image" || doc.type === "svg")
      // eslint-disable-next-line @next/next/no-img-element
      body = <img src={url} alt={doc.title} className="mx-auto max-h-[70vh] rounded-[8px] border border-line object-contain" />;
    else body = <Empty text="ไฟล์ DWG ดูตัวอย่างในเบราว์เซอร์ไม่ได้ ดาวน์โหลดเพื่อเปิดด้วยโปรแกรม CAD" />;
  } else {
    // eslint-disable-next-line @next/next/no-img-element
    body = <img src={svgDataUrl(coverSvg(doc, projectName, COMPANY_INFO.name))} alt={`ปกเอกสาร ${doc.title}`} className="mx-auto w-full max-w-[420px] rounded-[8px] border border-line" />;
  }

  return (
    <div className="fixed inset-0 z-40" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside aria-label="ตัวอย่างเอกสาร" className="absolute inset-y-0 right-0 flex w-[min(560px,100vw)] flex-col border-l border-line bg-card shadow-[-8px_0_32px_rgba(0,0,0,0.08)]">
        <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-3.5">
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-medium">{doc.title}</h2>
            <p className="truncate font-mono text-[12px] text-ink-3">{doc.file}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="ปิด" className={iconBtn}>
            <X size={16} strokeWidth={1.5} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto bg-raised/50 p-5">{body}</div>
        <dl className="grid grid-cols-[96px_minmax(0,1fr)] gap-x-3 gap-y-1.5 border-t border-line px-5 py-4 text-[13px]">
          <dt className="text-ink-3">หมวด</dt>
          <dd>{DOC_CATEGORY_LABEL[doc.category]}</dd>
          <dt className="text-ink-3">โครงการ</dt>
          <dd className="truncate">
            <Link href={`/projects/${doc.projectId}`} className="hover:opacity-70">
              {projectName} <span className="font-mono text-ink-3">{doc.projectId}</span>
            </Link>
          </dd>
          <dt className="text-ink-3">ชนิด / ขนาด</dt>
          <dd className="font-mono">
            {DOC_TYPE_LABEL[doc.type]} · {docSize(doc.sizeKb)}
          </dd>
          <dt className="text-ink-3">ผู้อัปโหลด</dt>
          <dd>{doc.by}</dd>
          <dt className="text-ink-3">วันที่</dt>
          <dd className="font-mono">{thDate(doc.date)}</dd>
          <dt className="text-ink-3">แท็ก</dt>
          <dd>{doc.tags.join(", ") || "-"}</dd>
        </dl>
        <footer className="flex items-center gap-2 border-t border-line px-5 py-3">
          <button type="button" className={btnPrimary} onClick={onDownload}>
            <Download size={16} strokeWidth={1.5} />
            {doc.local || sessionUrls.has(doc.id) || (doc as StoredDoc).storagePath ? "ดาวน์โหลด" : "ดาวน์โหลดปกเอกสาร"}
          </button>
          {(doc.type === "pdf" || doc.type === "image") && (
            <DocAskButton title={doc.title} fileName={doc.file} category={doc.category} mime={doc.mime} getBlob={async () => (url ? fetch(url).then((r) => r.blob()) : undefined)} />
          )}
          <button type="button" className={btnGhost} onClick={onEdit}>
            <Pencil size={16} strokeWidth={1.5} />
            แก้ไข
          </button>
          {onRemove && (
            <button type="button" className={cx(btn, "ml-auto border border-line-strong bg-card text-neg hover:bg-neg-soft")} onClick={onRemove}>
              <Trash2 size={16} strokeWidth={1.5} />
              ลบไฟล์
            </button>
          )}
        </footer>
      </aside>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="grid h-full min-h-[240px] place-items-center px-6 text-center text-[13px] text-ink-3">{text}</p>;
}

function EditDialog({ doc, onClose, onSave }: { doc: DocItem; onClose: () => void; onSave: (o: Override) => void }) {
  const [title, setTitle] = useState(doc.title);
  const [category, setCategory] = useState<DocCategory>(doc.category);
  const [tags, setTags] = useState(doc.tags.join(", "));
  return (
    <Modal title="แก้ไขข้อมูลเอกสาร" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave({
            title: title.trim() || doc.title,
            category,
            tags: tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean),
          });
        }}
      >
        <div className="space-y-4 px-5 py-4">
          <p className="font-mono text-[12px] text-ink-3">{doc.file}</p>
          <Field label="ชื่อเอกสาร">
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
          </Field>
          <Field label="หมวด">
            <select value={category} onChange={(e) => setCategory(e.target.value as DocCategory)} className={inputCls}>
              {DOC_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {DOC_CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="แท็ก (คั่นด้วยจุลภาค)">
            <input value={tags} onChange={(e) => setTags(e.target.value)} className={inputCls} />
          </Field>
        </div>
        <footer className="flex justify-end gap-2 border-t border-line px-5 py-3">
          <button type="button" className={btnGhost} onClick={onClose}>
            ยกเลิก
          </button>
          <button type="submit" className={btnPrimary}>
            บันทึก
          </button>
        </footer>
      </form>
    </Modal>
  );
}
