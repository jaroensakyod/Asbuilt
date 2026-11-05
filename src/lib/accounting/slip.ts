// Ported from ZettaFlow (src/lib/slip.ts) — only the pure parts. Image QR decoding (jsqr) is not ported;
// the user pastes the text of the slip's mini-QR (from any QR reader) to record the transfer reference.
// Payload is EMVCo-style TLV: tag 00 holds sub-tags 01 (API id), 02 (sending bank), 03 (transaction ref);
// tag 51 = country "TH"; tag 91 = CRC16-CCITT of everything before its value.

export function parseTlv(s: string) {
  const out: Record<string, string> = {};
  let i = 0;
  while (i + 4 <= s.length) {
    const tag = s.slice(i, i + 2),
      len = Number(s.slice(i + 2, i + 4));
    if (!/^\d{2}$/.test(tag) || !Number.isInteger(len) || i + 4 + len > s.length) return null;
    out[tag] = s.slice(i + 4, i + 4 + len);
    i += 4 + len;
  }
  return i === s.length ? out : null;
}

export function crc16(s: string) {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(s)) {
    crc ^= byte << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export const bankCodes: Record<string, string> = {
  "002": "ธนาคารกรุงเทพ",
  "004": "ธนาคารกสิกรไทย",
  "006": "ธนาคารกรุงไทย",
  "011": "ธนาคารทหารไทยธนชาต",
  "014": "ธนาคารไทยพาณิชย์",
  "025": "ธนาคารกรุงศรีอยุธยา",
  "030": "ธนาคารออมสิน",
  "034": "ธ.ก.ส.",
  "069": "ธนาคารเกียรตินาคินภัทร",
  "022": "ธนาคารซีไอเอ็มบี",
  "024": "ธนาคารยูโอบี",
  "067": "ธนาคารทิสโก้",
  "073": "ธนาคารแลนด์ แอนด์ เฮ้าส์",
};

export type SlipQr = { transRef: string; sendingBank: string; bankName: string; raw: string };
/** Parse and checksum-verify a slip mini-QR payload. Returns null if it is not a valid slip QR. */
export function parseSlipQr(raw: string): SlipQr | null {
  const text = raw.trim();
  const top = parseTlv(text);
  if (!top || !top["00"] || !top["91"]) return null;
  const crcIndex = text.lastIndexOf("91" + "04" + top["91"]);
  if (crcIndex < 0 || crc16(text.slice(0, crcIndex + 4)) !== top["91"].toUpperCase()) return null;
  if (top["51"] && top["51"] !== "TH") return null;
  const inner = parseTlv(top["00"]);
  if (!inner || !inner["02"] || !inner["03"]) return null;
  if (!/^\d{3}$/.test(inner["02"]) || !/^[A-Za-z0-9]{6,40}$/.test(inner["03"])) return null;
  return { transRef: inner["03"], sendingBank: inner["02"], bankName: bankCodes[inner["02"]] || "ธนาคาร " + inner["02"], raw: text };
}
