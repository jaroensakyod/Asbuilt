"use client";

// Project page card: the 3D files uploaded for this project, with upload and open.

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Box, Trash2, Upload } from "lucide-react";
import { Card, CardHead } from "@/components/ui";
import { fileSize } from "@/lib/media";
import { canEdit } from "@/lib/permissions";
import { useMe } from "@/lib/use-me";
import { modelFiles, projectModels, removeModel, STAGE_LABEL } from "@/lib/model3d/store";
import { UploadModelForm } from "./upload-form";

export function ModelFilesCard({ projectId }: { projectId: string }) {
  const all = modelFiles.use();
  const files = useMemo(() => projectModels(all, projectId), [all, projectId]);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { role } = useMe();
  const editable = canEdit(role, "design") || canEdit(role, "projects");
  const href = (id?: string) => `/model3d/${encodeURIComponent(projectId)}${id ? `?file=${encodeURIComponent(id)}` : ""}`;

  return (
    <Card>
      <CardHead
        title="ไฟล์ 3D จากผู้ออกแบบ"
        meta={files.length ? `${files.length} ไฟล์` : undefined}
        action={
          editable && !open ? (
            <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1 text-[13px] text-ink-2 hover:text-ink">
              <Upload size={14} strokeWidth={1.5} /> อัปโหลด
            </button>
          ) : undefined
        }
      />
      {open && (
        <div className="border-b border-line px-5 py-4">
          <UploadModelForm projectId={projectId} onDone={(m) => router.push(href(m.id))} onCancel={() => setOpen(false)} />
        </div>
      )}
      {files.length ? (
        <ul className="divide-y divide-line">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-3 px-5 py-2.5">
              <Link href={href(f.id)} className="shrink-0" aria-hidden tabIndex={-1}>
                {f.thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element -- small data URL saved with the file
                  <img src={f.thumb} alt="" className="h-10 w-[72px] rounded-[6px] border border-line bg-white object-cover" />
                ) : (
                  <span className="flex h-10 w-[72px] items-center justify-center rounded-[6px] border border-line bg-raised text-ink-3">
                    <Box size={16} strokeWidth={1.5} />
                  </span>
                )}
              </Link>
              <Link href={href(f.id)} className="min-w-0 flex-1 hover:text-ink">
                <p className="truncate text-[14px]">{f.name}</p>
                <p className="truncate text-[12px] text-ink-3">
                  {f.source ? "SKP → GLB" : f.format.toUpperCase()} · {STAGE_LABEL[f.stage]} · {fileSize(f.media.size)}
                  {f.stats ? ` · ${f.stats.parts.toLocaleString("th-TH")} ชิ้น · ${f.stats.assets.length} อุปกรณ์` : ""}
                </p>
              </Link>
              {editable && (
                <button
                  type="button"
                  aria-label={`ลบ ${f.name}`}
                  onClick={() => {
                    if (window.confirm(`ลบไฟล์ 3D "${f.name}"?`)) void removeModel(f);
                  }}
                  className="rounded-[6px] p-1.5 text-ink-3 transition-colors hover:bg-raised hover:text-ink"
                >
                  <Trash2 size={15} strokeWidth={1.5} />
                </button>
              )}
              <Link href={href(f.id)} aria-label={`เปิด ${f.name}`} className="text-ink-3 hover:text-ink">
                <ArrowRight size={15} strokeWidth={1.5} />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        !open && (
          <p className="px-5 py-4 text-[13px] leading-relaxed text-ink-3">
            อัปโหลดโมเดลจาก SketchUp (export เป็น GLB/DAE/OBJ/FBX) หรือไฟล์ IFC เพื่อเปิดดู 3 มิติ แยกระบบงาน และผูกอุปกรณ์กับแจ้งซ่อม
          </p>
        )
      )}
    </Card>
  );
}
