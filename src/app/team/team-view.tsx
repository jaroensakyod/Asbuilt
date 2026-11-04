"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Link2, Search, UserPlus, X } from "lucide-react";
import { Card, CardHead, cx, Field, inputCls, Status } from "@/components/ui";
import { ROLE_LABEL, team, thDate, TODAY, daysBetween, type Role } from "@/lib/data";
import { invites, inviteLink, seatLimit } from "./team-store";

const ROLES = Object.keys(ROLE_LABEL) as Role[];

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  // skip Thai leading vowels so the initial is the consonant
  const first = (s: string) => (s.replace(/^[เแโใไ]/, "")[0] ?? s[0] ?? "");
  return parts.slice(0, 2).map(first).join("");
}

function lastActive(iso: string) {
  const d = daysBetween(iso, TODAY);
  if (d <= 0) return "วันนี้";
  if (d === 1) return "เมื่อวาน";
  if (d < 30) return `${d} วันก่อน`;
  return thDate(iso);
}

type Row = { id: string; name: string; role: Role; skill?: string; phone: string; email: string; state: "active" | "inactive" | "invited"; last: string; invite?: boolean ; token?: string };

export function TeamView() {
  const local = invites.use();
  const [q, setQ] = useState("");
  const [role, setRole] = useState<Role | "all">("all");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

  const rows: Row[] = useMemo(
    () => [
      ...local.map<Row>((i) => ({ id: i.id, name: i.name, role: i.role, skill: i.skill, phone: i.phone, email: i.email, state: "invited", last: i.invited, invite: true, token: i.token })),
      ...team.map<Row>((m) => ({ id: m.id, name: m.name, role: m.role, skill: m.skill, phone: m.phone, email: m.email, state: m.active ? "active" : "inactive", last: m.lastSeen })),
    ],
    [local],
  );
  const filtered = rows.filter((r) => {
    if (role !== "all" && r.role !== role) return false;
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return [r.name, r.email, r.phone, r.skill ?? "", ROLE_LABEL[r.role], r.id].some((v) => v.toLowerCase().includes(s));
  });
  const used = rows.filter((r) => r.state !== "inactive").length;

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = String(f.get("name") ?? "").trim();
    const email = String(f.get("email") ?? "").trim();
    if (!name || !/^\S+@\S+\.\S+$/.test(email)) {
      setError("กรอกชื่อและอีเมลให้ถูกต้อง");
      return;
    }
    if (rows.some((r) => r.email.toLowerCase() === email.toLowerCase())) {
      setError("อีเมลนี้มีอยู่ในทีมแล้ว");
      return;
    }
    if (used >= seatLimit()) {
      setError(`ใช้ครบ ${seatLimit()} ที่นั่งของแพ็กเกจแล้ว`);
      return;
    }
    invites.set((prev) => [
      {
        id: `INV-${Date.now().toString(36).toUpperCase()}`,
        name,
        email,
        phone: String(f.get("phone") ?? "").trim() || "–",
        role: String(f.get("role")) as Role,
        skill: String(f.get("skill") ?? "").trim() || undefined,
        invited: TODAY,
      },
      ...prev,
    ]);
    setError("");
    e.currentTarget.reset();
    setOpen(false);
  };

  return (
    <Card>
      <CardHead
        title="ผู้ใช้งาน"
        meta={`${rows.length} คน · ใช้ ${used}/${seatLimit()} ที่นั่ง`}
        action={
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-8 items-center gap-2 rounded-[8px] bg-ink px-3 text-[13px] font-medium text-card transition-colors duration-150 hover:bg-[#3a332b]"
          >
            {open ? <X size={16} strokeWidth={1.5} /> : <UserPlus size={16} strokeWidth={1.5} />}
            {open ? "ปิด" : "เชิญผู้ใช้"}
          </button>
        }
      />
      {open && (
        <form onSubmit={submit} className="grid grid-cols-2 gap-3 border-b border-line bg-raised/40 px-5 py-4 lg:grid-cols-6">
          <Field label="ชื่อ-นามสกุล">
            <input name="name" required className={inputCls} placeholder="เช่น สมหญิง ใจดี" />
          </Field>
          <Field label="อีเมล">
            <input name="email" type="email" required className={inputCls} placeholder="name@example.co.th" />
          </Field>
          <Field label="โทรศัพท์">
            <input name="phone" className={inputCls} placeholder="08x-xxx-xxxx" />
          </Field>
          <Field label="บทบาท">
            <select name="role" defaultValue="technician" className={inputCls}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="ทักษะ/ตำแหน่ง">
            <input name="skill" className={inputCls} placeholder="ไม่บังคับ" />
          </Field>
          <div className="flex flex-col justify-end gap-1">
            <button type="submit" className="h-9 rounded-[8px] bg-ink px-4 text-[14px] font-medium text-card transition-colors duration-150 hover:bg-[#3a332b]">
              ส่งคำเชิญ
            </button>
          </div>
          <p className="col-span-full text-[12px] text-ink-3">{error ? <span className="text-neg">{error}</span> : "บันทึกในเบราว์เซอร์นี้ (ตัวอย่าง) ระบบจริงจะส่งลิงก์เข้าร่วมทางอีเมล"}</p>
        </form>
      )}
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3">
        <label className="relative min-w-60 flex-1">
          <Search size={16} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาชื่อ อีเมล เบอร์โทร ทักษะ" className={cx(inputCls, "w-full pl-9")} />
        </label>
        <select value={role} onChange={(e) => setRole(e.target.value as Role | "all")} className={cx(inputCls, "w-52")} aria-label="บทบาท">
          <option value="all">ทุกบทบาท</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]} ({rows.filter((x) => x.role === r).length})
            </option>
          ))}
        </select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-line text-left text-[12px] text-ink-3">
              <th className="px-5 py-2.5 font-normal">ชื่อ</th>
              <th className="px-3 py-2.5 font-normal">บทบาท</th>
              <th className="px-3 py-2.5 font-normal">ทักษะ</th>
              <th className="px-3 py-2.5 font-normal">โทรศัพท์</th>
              <th className="px-3 py-2.5 font-normal">อีเมล</th>
              <th className="px-3 py-2.5 font-normal">สถานะ</th>
              <th className="px-3 py-2.5 font-normal">ใช้งานล่าสุด</th>
              <th className="w-10 px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-b border-line last:border-0 hover:bg-raised/50">
                <td className="px-5 py-2.5">
                  <div className="flex items-center gap-3">
                    <span className={cx("flex size-8 shrink-0 items-center justify-center rounded-full text-[12px]", r.state === "invited" ? "border border-dashed border-line-strong text-ink-3" : "bg-raised text-ink-2")}>
                      {initials(r.name)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-ink">{r.name}</p>
                      <p className="font-mono text-[11px] text-ink-3">{r.id}</p>
                    </div>
                  </div>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-ink-2">{ROLE_LABEL[r.role]}</td>
                <td className="px-3 py-2.5 text-ink-2">{r.skill ?? "–"}</td>
                <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[12px] text-ink-2">{r.phone}</td>
                <td className="px-3 py-2.5 font-mono text-[12px] text-ink-2">{r.email}</td>
                <td className="px-3 py-2.5">
                  {r.state === "active" ? <Status tone="pos">ใช้งาน</Status> : r.state === "invited" ? <Status tone="warn">รอตอบรับ</Status> : <Status>ระงับ</Status>}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-ink-3">{r.invite ? `เชิญ ${thDate(r.last)}` : lastActive(r.last)}</td>
                <td className="px-3 py-2.5">
                  {r.invite && r.token && (
                    <button
                      type="button"
                      title="คัดลอกลิงก์เชิญ"
                      aria-label={`คัดลอกลิงก์เชิญ ${r.name}`}
                      onClick={() => void navigator.clipboard.writeText(inviteLink(r.token!))}
                      className="mr-1 inline-flex size-7 items-center justify-center rounded-[6px] text-ink-3 transition-colors duration-150 hover:bg-raised hover:text-ink"
                    >
                      <Link2 size={16} strokeWidth={1.5} />
                    </button>
                  )}
                  {r.invite && (
                    <button
                      type="button"
                      aria-label={`ยกเลิกคำเชิญ ${r.name}`}
                      onClick={() => invites.set((prev) => prev.filter((i) => i.id !== r.id))}
                      className="flex size-7 items-center justify-center rounded-[6px] text-ink-3 transition-colors duration-150 hover:bg-raised hover:text-ink"
                    >
                      <X size={16} strokeWidth={1.5} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan={8} className="px-5 py-10 text-center text-ink-3">
                  ไม่พบผู้ใช้ที่ตรงกับเงื่อนไข
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
