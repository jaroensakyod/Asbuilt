// PromptPay QR payload (Thai QR Payment, EMVCo merchant-presented) — pure, unit-tested.
//   promptPayPayload("0812345678", 1500) → "000201010212…6304XXXX"
// id: mobile number (10 digits), national/tax id (13 digits) or e-wallet id (15 digits).

const tlv = (tag: string, value: string) => `${tag}${String(value.length).padStart(2, "0")}${value}`;

/** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF) as 4 upper-case hex digits */
export function crc16(s: string): string {
  let crc = 0xffff;
  for (let i = 0; i < s.length; i++) {
    crc ^= s.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export type PromptPayKind = "phone" | "taxId" | "ewallet";
export function promptPayKind(id: string): PromptPayKind | null {
  const d = id.replace(/\D/g, "");
  if (d.length === 10 && d.startsWith("0")) return "phone";
  if (d.length === 13) return "taxId";
  if (d.length === 15) return "ewallet";
  return null;
}

/** Build the payload string. amount ≤ 0 or undefined → static QR (payer types the amount). */
export function promptPayPayload(id: string, amount?: number): string {
  const d = id.replace(/\D/g, "");
  const kind = promptPayKind(d);
  if (!kind) throw new Error("PromptPay id must be a 10-digit phone, 13-digit tax id or 15-digit e-wallet id");
  const target = kind === "phone" ? tlv("01", `0066${d.slice(1)}`) : kind === "taxId" ? tlv("02", d) : tlv("03", d);
  const merchant = tlv("29", tlv("00", "A000000677010111") + target);
  const dynamic = amount !== undefined && amount > 0;
  let out = tlv("00", "01") + tlv("01", dynamic ? "12" : "11") + merchant + tlv("58", "TH") + tlv("53", "764");
  if (dynamic) out += tlv("54", (Math.round(amount * 100) / 100).toFixed(2));
  out += "6304";
  return out + crc16(out);
}
