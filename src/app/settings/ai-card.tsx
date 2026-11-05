"use client";

import { Card, CardHead } from "@/components/ui";
import { Status } from "@/components/ui";
import { useAiStatus } from "@/lib/ai/client";

const FEATURES = [
  "แชทถามข้อมูลบริษัท (ปุ่มมุมขวาล่าง / Ctrl+J)",
  "อ่านใบกำกับภาษี ใบเสร็จ ใบส่งของ ใบเสนอราคา และเอกสารประมูล",
  "ร่างรายงานประจำวันจากเสียงหรือข้อความ, ดูรูปข้อบกพร่องและความเสี่ยงความปลอดภัย, ร่างบันทึกประชุม",
  "แนะนำแบบบ้าน ร่างใบเสนอราคา ถอด BOQ จากคำบรรยาย และร่างคำตอบลูกค้า",
  "อ่านตารางราคาวัสดุ/ราคากลางจากไฟล์ PDF และอธิบายการเปลี่ยนแปลงราคา",
];

/** AI provider status; the key itself lives only on the server (.env.local / hosting env). */
export function AiCard() {
  const s = useAiStatus();
  return (
    <Card>
      <CardHead title="ผู้ช่วย AI" meta={s?.configured ? `${s.provider} · ${s.model}` : undefined} />
      <div className="flex flex-col gap-3 px-5 py-4 text-[13px]">
        {!s ? (
          <p className="text-ink-3">กำลังตรวจสอบ…</p>
        ) : s.configured ? (
          <Status tone="pos">เชื่อมต่อแล้ว ใช้ได้ทุกบทบาทตามสิทธิ์ที่แต่ละคนเห็นข้อมูล</Status>
        ) : (
          <div className="flex flex-col gap-1.5">
            <Status tone="warn">ยังไม่ได้ตั้งค่า</Status>
            <p className="text-ink-2">
              สร้างคีย์ที่ aistudio.google.com/apikey แล้วใส่ <span className="font-mono">GEMINI_API_KEY</span> ในไฟล์ <span className="font-mono">.env.local</span> (หรือ Environment Variables ของโฮสติ้ง) แล้วรีสตาร์ตเซิร์ฟเวอร์
            </p>
          </div>
        )}
        <ul className="list-disc pl-5 text-ink-2">
          {FEATURES.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
        <p className="text-[12px] text-ink-3">ทุกอย่างที่ AI กรอกเป็นร่าง ต้องให้คนตรวจและกดบันทึกเอง · ข้อความและไฟล์ที่ส่งให้ AI จะถูกส่งไปประมวลผลที่ผู้ให้บริการ (Google)</p>
      </div>
    </Card>
  );
}
