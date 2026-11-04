// Money, date and numbering helpers for the accounting module.
// Pure (no React, no "@/" imports) so node --test can load it directly.

/** Round to satang (2 decimals), half away from zero. */
export const r2 = (n: number) => {
  const x = Number(n) || 0;
  return (Math.sign(x) * Math.round((Math.abs(x) + Number.EPSILON) * 100)) / 100;
};
/** Integer satang, for exact equality checks. */
export const satang = (n: number) => Math.round((Number(n) || 0) * 100);
export const sum = (xs: number[]) => r2(xs.reduce((s, x) => s + (Number(x) || 0), 0));

export const VAT_RATE = 0.07;

/** First day the books are kept in this system; earlier documents live in the opening balances. */
export const BOOKS_START = "2026-01-01";

export const periodOf = (iso: string) => iso.slice(0, 7);
export const yearOf = (iso: string) => Number(iso.slice(0, 4));
/** Buddhist-era year (พ.ศ.) */
export const beYear = (iso: string) => yearOf(iso) + 543;

export function monthEnd(period: string) {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${period}-${String(d).padStart(2, "0")}`;
}
export function addMonths(period: string, n: number) {
  const [y, m] = period.split("-").map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}
export function addDays(iso: string, n: number) {
  const t = Date.parse(iso + "T00:00:00Z") + n * 86400000;
  return new Date(t).toISOString().slice(0, 10);
}
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
/** Periods from `from` to `to` inclusive ("2026-01" … "2026-11"). */
export function periodsBetween(from: string, to: string) {
  const out: string[] = [];
  for (let p = from; p <= to; p = addMonths(p, 1)) out.push(p);
  return out;
}

/**
 * Thai document prefix with Buddhist year and month: IV-6911- for a tax invoice dated Nov 2569 (2026).
 * The running number is appended by the collection (nextId), sequential per prefix and never reused
 * because issued documents are never deleted.
 */
export const docPrefix = (kind: "IV" | "RC" | "PV" | "EX", iso: string) => `${kind}-${String(beYear(iso)).slice(2)}${iso.slice(5, 7)}-`;
/** Journal voucher prefix (Christian year, sequential per company per year): JV-2026- */
export const jvPrefix = (iso: string) => `JV-${yearOf(iso)}-`;

const TH_MONTH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const TH_MONTH_FULL = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
/** "ต.ค. 69" */
export const periodLabel = (period: string) => `${TH_MONTH[Number(period.slice(5, 7)) - 1]} ${String(Number(period.slice(0, 4)) + 543).slice(2)}`;
/** "ตุลาคม 2569" */
export const periodLabelFull = (period: string) => `${TH_MONTH_FULL[Number(period.slice(5, 7)) - 1]} ${Number(period.slice(0, 4)) + 543}`;
/** "4 พฤศจิกายน 2569" */
export const thDateFull = (iso: string) => `${Number(iso.slice(8, 10))} ${TH_MONTH_FULL[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(0, 4)) + 543}`;
/** "04/11/2569" */
export const thDateSlash = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${Number(iso.slice(0, 4)) + 543}`;

export const fmt = (n: number) => r2(n).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** Accounting style: negatives in parentheses, zero as a dash. */
export const fmtAcc = (n: number) => (satang(n) === 0 ? "–" : n < 0 ? `(${fmt(-n)})` : fmt(n));

/** Baht amount in Thai words, as printed on receipts: "หนึ่งหมื่นเจ็ดร้อยบาทถ้วน". */
export function bahtText(n: number) {
  const digits = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
  const units = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"];
  const read = (s: string): string => {
    if (s.length > 6) {
      const head = s.slice(0, s.length - 6),
        tail = s.slice(-6);
      return read(head) + "ล้าน" + (Number(tail) ? read(tail) : "");
    }
    let out = "";
    const len = s.length;
    for (let i = 0; i < len; i++) {
      const d = Number(s[i]),
        pos = len - i - 1;
      if (!d) continue;
      if (pos === 1 && d === 1) out += "สิบ";
      else if (pos === 1 && d === 2) out += "ยี่สิบ";
      else if (pos === 0 && d === 1 && len > 1 && Number(s.slice(0, -1)) > 0) out += "เอ็ด";
      else out += digits[d] + units[pos];
    }
    return out;
  };
  const neg = n < 0;
  const cents = satang(Math.abs(n));
  const b = Math.floor(cents / 100),
    st = cents % 100;
  const text = (b ? read(String(b)) + "บาท" : st ? "" : "ศูนย์บาท") + (st ? read(String(st)) + "สตางค์" : "ถ้วน");
  return (neg ? "ลบ" : "") + text;
}
