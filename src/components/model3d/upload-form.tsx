"use client";

import { useRef, useState } from "react";
import { FileUp, LoaderCircle } from "lucide-react";
import { cx, Field, inputCls } from "@/components/ui";
import { ACCEPT, FORMATS, isSkpName, MAX_BYTES, rejectReason, SKP_LABEL } from "@/lib/model3d/classify";
import type { SkpStage } from "@/lib/model3d/skp-client";
import { STAGE_LABEL, uploadModel, type ModelFile, type ModelStage } from "@/lib/model3d/store";
import { fileSize } from "@/lib/media";

const btn =
  "inline-flex h-9 items-center justify-center gap-2 rounded-[8px] border border-line-strong bg-card px-3.5 text-[14px] font-medium text-ink transition-colors duration-150 hover:bg-raised disabled:opacity-50";

export function UploadModelForm({ projectId, onDone, onCancel }: { projectId: string; onDone?: (m: ModelFile) => void; onCancel?: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<ModelStage>("construction");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skpStage, setSkpStage] = useState<SkpStage | null>(null);

  const pick = (f: File | undefined) => {
    setError(null);
    if (!f) return;
    const why = rejectReason(f.name, f.size);
    if (why) {
      setFile(null);
      setError(why);
      return;
    }
    setFile(f);
    setName(f.name.replace(/\.[^.]+$/, ""));
  };

  const submit = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const m = await uploadModel(projectId, file, { stage, name, onSkpStage: setSkpStage });
      setFile(null);
      setName("");
      if (input.current) input.current.value = "";
      onDone?.(m);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setSkpStage(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <label
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          pick(e.dataTransfer.files[0]);
        }}
        className="flex cursor-pointer flex-col items-center gap-1.5 rounded-[12px] border border-dashed border-line-strong bg-raised/50 px-4 py-6 text-center transition-colors hover:bg-raised"
      >
        <FileUp size={22} strokeWidth={1.5} className="text-ink-2" />
        <span className="text-[14px] text-ink">{file ? `${file.name} · ${fileSize(file.size)}` : "ลากไฟล์มาวาง หรือคลิกเพื่อเลือก"}</span>
        <span className="text-[12px] text-ink-3">
          {[...FORMATS.map((f) => f.label), SKP_LABEL].join(" · ")} · ไม่เกิน {Math.round(MAX_BYTES / 1048576)} MB (.skp ไม่เกิน 200 MB)
        </span>
        <input ref={input} type="file" accept={ACCEPT} className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
      </label>

      {file && (
        <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
          <Field label="ชื่อที่แสดง">
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="ประเภทแบบ">
            <select className={inputCls} value={stage} onChange={(e) => setStage(e.target.value as ModelStage)}>
              {(Object.keys(STAGE_LABEL) as ModelStage[]).map((s) => (
                <option key={s} value={s}>
                  {STAGE_LABEL[s]}
                </option>
              ))}
            </select>
          </Field>
        </div>
      )}

      {file && isSkpName(file.name) && !busy && (
        <p className="rounded-[8px] bg-raised px-3 py-2 text-[12px] leading-relaxed text-ink-2">
          ไฟล์ SketchUp: ระบบจะอ่านไฟล์และแปลงเป็นโมเดล 3D ให้เอง (ใช้เวลาประมาณ 10–60 วินาทีตามขนาดไฟล์) เส้น 2D ที่ import จาก CAD จะถูกตัดออกให้เหลือแต่ตัวอาคาร
        </p>
      )}

      {error && <p className="rounded-[8px] bg-accent-soft px-3 py-2 text-[13px] text-accent-text">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <button type="button" className={cx(btn, "border-ink bg-ink text-page hover:bg-ink/90")} disabled={!file || busy} onClick={submit}>
          {busy && <LoaderCircle size={16} strokeWidth={1.5} className="animate-spin" />}
          {!busy ? "อัปโหลดและเปิดดู 3D" : skpStage === "convert" ? "กำลังแปลง SketchUp เป็น 3D" : skpStage === "save" ? "กำลังบันทึกโมเดล" : "กำลังอัปโหลด"}
        </button>
        {onCancel && (
          <button type="button" className={btn} onClick={onCancel} disabled={busy}>
            ยกเลิก
          </button>
        )}
      </div>

      <ExportGuide />
    </div>
  );
}

export function ExportGuide() {
  return (
    <details className="rounded-[10px] border border-line px-4 py-3 text-[13px] leading-relaxed text-ink-2">
      <summary className="cursor-pointer font-medium text-ink">ไฟล์จาก SketchUp และการตั้งชื่อให้ระบบอ่านได้</summary>
      <ol className="mt-2 list-decimal space-y-1 pl-5">
        <li>
          อัปโหลดไฟล์ <span className="font-mono">.skp</span> ได้เลย ระบบแปลงเป็น 3D ให้เอง (SketchUp 2013 ขึ้นไป) ถ้าไฟล์อ่านไม่ได้ ให้ใช้ File → Export → 3D Model เลือก <b>COLLADA (.dae)</b> หรือ <b>.glb</b> แทน
        </li>
        <li>ก่อน export ให้ Purge Unused และซ่อน/ลบต้นไม้ คน รถ ที่ไม่จำเป็น เพื่อให้ไฟล์เล็กลง</li>
        <li>
          ตั้งชื่อ <b>Tag หรือ Group</b> ตามระบบงาน เช่น โครงสร้าง, สถาปัตย์, ไฟฟ้า, ประปา, สุขภัณฑ์, แอร์, ภายนอก (หรือภาษาอังกฤษ Structure, Electrical, Plumbing …) ระบบจะแยกปุ่มเปิด/ปิดให้เอง
        </li>
        <li>
          ตั้งชื่อ <b>Component</b> ของอุปกรณ์เป็นรหัส เช่น <span className="font-mono">AC-201</span>, <span className="font-mono">WC-101</span>, <span className="font-mono">PU-001</span> คลิกที่ชิ้นนั้นในเว็บจะเห็นข้อมูลอุปกรณ์และแจ้งซ่อม
        </li>
        <li>ไฟล์ IFC (จาก SketchUp Pro, Revit, ArchiCAD) แยกระบบงานจากชนิดชิ้นส่วนให้อัตโนมัติ ไม่ต้องตั้งชื่อ</li>
      </ol>
    </details>
  );
}
