"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardHead } from "@/components/ui";
import { Status } from "@/components/ui";
import { useAiStatus } from "@/lib/ai/client";

const FEATURES = [
  "แชทถามข้อมูลบริษัท (ปุ่มมุมขวาล่าง / Ctrl+J)",
  "อ่านใบกำกับภาษี ใบเสร็จ ใบส่งของ ใบเสนอราคา และเอกสารประมูล",
  "ร่างรายงานประจำวันจากเสียงหรือข้อความ, ดูรูปข้อบกพร่องและความเสี่ยงความปลอดภัย, ร่างบันทึกประชุม",
  "แนะนำแบบบ้าน ร่างใบเสนอราคา ถอด BOQ จากคำบรรยาย และร่างคำตอบลูกค้า",
  "อ่านตารางราคาวัสดุ/ราคากลางจากไฟล์ PDF และอธิบายการเปลี่ยนแปลงราคา",
  "ตรวจความผิดปกติของงานถอดปริมาณ",
];

const NAME = { gemini: "Google Gemini", claude: "Anthropic Claude" } as const;

/** AI provider status; the keys live only on the server (.env.local / hosting env). */
export function AiCard() {
  const s = useAiStatus();
  return (
    <Card>
      <CardHead
        title="ผู้ช่วย AI"
        meta={s?.configured ? `ใช้ ${NAME[s.provider]} · ${s.model}` : undefined}
        action={
          <Link href="/settings/ai" className="flex items-center gap-1 text-[13px] text-ink-2 hover:text-ink">
            เทียบ AI และต้นทุน <ArrowRight size={14} strokeWidth={1.5} />
          </Link>
        }
      />
      <div className="flex flex-col gap-3 px-5 py-4 text-[13px]">
        {!s ? (
          <p className="text-ink-3">กำลังตรวจสอบ…</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {(["gemini", "claude"] as const).map((p) => {
              const ps = s.providers?.[p];
              return (
                <li key={p} className="flex flex-wrap items-center gap-2">
                  <span className="w-[130px] text-ink">{NAME[p]}</span>
                  {ps?.configured ? <Status tone="pos">เชื่อมต่อแล้ว</Status> : <Status tone="warn">ยังไม่ได้ตั้งค่า</Status>}
                  <span className="font-mono text-[12px] text-ink-3">
                    {ps?.model}
                    {ps?.effort ? ` · effort ${ps.effort}` : ""}
                  </span>
                  {s.provider === p && <span className="rounded-[4px] bg-ink px-1.5 text-[11px] text-page">ใช้งานอยู่</span>}
                </li>
              );
            })}
          </ul>
        )}
        {s && !s.providers?.claude.configured && (
          <p className="text-ink-2">
            ใส่ <span className="font-mono">ANTHROPIC_API_KEY</span> ใน <span className="font-mono">.env.local</span> แล้วรีสตาร์ตเซิร์ฟเวอร์ เพื่อใช้ Claude · เปลี่ยนตัวที่ใช้งานด้วย <span className="font-mono">AI_PROVIDER</span>
          </p>
        )}
        <ul className="list-disc pl-5 text-ink-2">
          {FEATURES.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
        <p className="text-[12px] text-ink-3">ทุกอย่างที่ AI กรอกเป็นร่าง ต้องให้คนตรวจและกดบันทึกเอง · ข้อความและไฟล์ที่ส่งให้ AI จะถูกส่งไปประมวลผลที่ผู้ให้บริการ (Google หรือ Anthropic)</p>
      </div>
    </Card>
  );
}
