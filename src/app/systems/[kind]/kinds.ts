import type { AssetCategory } from "@/lib/house";

export type Kind = "elec" | "plumb" | "hvac";

export const KINDS: Record<Kind, { title: string; en: string; sub: string; plan: string; sheet: string; defaultProject: string; categories: AssetCategory[] }> = {
  elec: {
    title: "ระบบไฟฟ้า",
    en: "Electrical",
    sub: "ทุกจุดไฟฟ้าในอาคาร ตู้ไฟ เบรกเกอร์ โคมไฟ สวิตช์ เต้ารับ และเครื่องทำน้ำอุ่น พร้อมผังวงจรและตารางโหลด",
    plan: "แบบระบบไฟฟ้า",
    sheet: "E",
    defaultProject: "HC-2021-03",
    categories: ["ตู้ควบคุมไฟฟ้า", "เบรกเกอร์ลูกย่อย", "โคมดาวน์ไลท์ LED", "สวิตช์ไฟ", "เต้ารับคู่มีกราวด์", "เครื่องทำน้ำอุ่น"],
  },
  plumb: {
    title: "ประปา & สุขภัณฑ์",
    en: "Plumbing & Sanitary",
    sub: "สุขภัณฑ์ อ่าง ซิงค์ ปั๊มน้ำ ถังเก็บน้ำ และถังบำบัด พร้อมแนวท่อน้ำดีและท่อน้ำทิ้งทุกชั้น",
    plan: "แบบระบบสุขาภิบาล",
    sheet: "P",
    defaultProject: "HC-2025-01",
    categories: ["สุขภัณฑ์ (ชักโครก)", "อ่างล้างหน้า", "ซิงค์ล้างจาน", "ปั๊มน้ำอัตโนมัติ", "ถังเก็บน้ำ", "ถังบำบัดน้ำเสีย"],
  },
  hvac: {
    title: "ปรับอากาศ",
    en: "HVAC",
    sub: "เครื่องปรับอากาศ คอยล์ร้อน ขนาด BTU แนวท่อน้ำยา และรอบล้างทำความสะอาด",
    plan: "แบบระบบปรับอากาศ",
    sheet: "M",
    defaultProject: "HC-2024-05",
    categories: ["เครื่องปรับอากาศติดผนัง (Fan Coil)", "คอยล์ร้อน (Condensing Unit)"],
  },
};
