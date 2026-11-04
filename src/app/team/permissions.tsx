import { Card, CardHead, cx } from "@/components/ui";
import { ROLE_LABEL, type Role } from "@/lib/data";

// - none, v view, o own records only, e edit, a approve
type Level = "-" | "v" | "o" | "e" | "a";

const MODULES = [
  "โครงการ",
  "มูลค่าสัญญา/ต้นทุน",
  "แบบบ้าน & 3D",
  "งานระบบ & อุปกรณ์",
  "การตรวจสอบ",
  "แจ้งซ่อม",
  "ใบสั่งงาน",
  "บำรุงรักษา",
  "เอกสาร",
  "รายงาน",
  "ผู้ใช้/ตั้งค่า",
] as const;

const MATRIX: Record<Role, Level[]> = {
  //          proj cost model sys  insp rep  wo   pm   doc  rpt  admin
  admin: ["a", "a", "e", "e", "e", "a", "a", "e", "a", "v", "a"],
  exec: ["v", "a", "v", "v", "v", "v", "v", "v", "v", "v", "v"],
  sales: ["e", "-", "v", "-", "-", "v", "-", "-", "e", "v", "-"],
  architect: ["v", "-", "a", "e", "v", "v", "-", "-", "e", "-", "-"],
  engineer: ["v", "-", "e", "a", "e", "e", "e", "v", "e", "v", "-"],
  pm: ["e", "v", "v", "v", "a", "a", "a", "e", "e", "v", "-"],
  foreman: ["v", "-", "v", "v", "e", "e", "o", "-", "v", "-", "-"],
  qc: ["v", "-", "v", "v", "a", "e", "v", "-", "e", "v", "-"],
  technician: ["-", "-", "v", "v", "-", "o", "o", "o", "-", "-", "-"],
  purchasing: ["v", "e", "-", "v", "-", "v", "v", "-", "v", "v", "-"],
  accounting: ["v", "a", "-", "-", "-", "v", "v", "-", "v", "e", "-"],
};

const CELL: Record<Level, { text: string; cls: string }> = {
  "-": { text: "–", cls: "text-ink-3/60" },
  v: { text: "ดู", cls: "text-ink-2" },
  o: { text: "ของตน", cls: "text-ink-2 underline decoration-dotted underline-offset-4" },
  e: { text: "แก้ไข", cls: "text-ink" },
  a: { text: "อนุมัติ", cls: "rounded-[4px] bg-accent-soft px-1.5 text-accent-text" },
};

export function Permissions() {
  const roles = Object.keys(ROLE_LABEL) as Role[];
  return (
    <Card>
      <CardHead title="สิทธิ์ตามบทบาท" meta={`${roles.length} บทบาท × ${MODULES.length} โมดูล`} />
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-line text-ink-3">
              <th className="sticky left-0 bg-card px-5 py-2.5 text-left font-normal">บทบาท</th>
              {MODULES.map((m) => (
                <th key={m} className="px-2 py-2.5 text-center font-normal">
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {roles.map((r) => (
              <tr key={r} className="border-b border-line last:border-0">
                <td className="sticky left-0 whitespace-nowrap bg-card px-5 py-2 text-[13px] text-ink">{ROLE_LABEL[r]}</td>
                {MATRIX[r].map((l, i) => (
                  <td key={i} className="px-2 py-2 text-center">
                    <span className={cx("inline-block whitespace-nowrap", CELL[l].cls)}>{CELL[l].text}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-1 border-t border-line px-5 py-3 text-[12px] text-ink-3">
        <p>ดู = อ่านอย่างเดียว · แก้ไข = สร้างและแก้ไขได้ · อนุมัติ = แก้ไขและอนุมัติ/ปิดงานได้ · ของตน = เฉพาะงานที่ได้รับมอบหมาย</p>
        <p>ฝ่ายขายไม่เห็นมูลค่าต้นทุนและกำไร ช่างบริการเห็นเฉพาะใบสั่งงานและแจ้งซ่อมที่มอบหมายให้ตนเอง</p>
      </div>
    </Card>
  );
}
