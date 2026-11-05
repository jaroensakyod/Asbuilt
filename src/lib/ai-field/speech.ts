// Speech-to-text clean-up for Thai dictation (Web Speech API, lang th-TH).
// Chrome usually returns digits already, but number words, Thai digits, "เปอร์เซ็นต์" and "จุด"
// still come through; normalise them so the AI and the user see "เทพื้น 70% ปูน 20 ถุง".

const DIGIT: Record<string, number> = { ศูนย์: 0, หนึ่ง: 1, เอ็ด: 1, สอง: 2, ยี่: 2, สาม: 3, สี่: 4, ห้า: 5, หก: 6, เจ็ด: 7, แปด: 8, เก้า: 9 };
const UNIT: Record<string, number> = { สิบ: 10, ร้อย: 100, พัน: 1000, หมื่น: 10000, แสน: 100000 };
const WORD_RE = "(?:ศูนย์|หนึ่ง|เอ็ด|สอง|ยี่|สาม|สี่|ห้า|หก|เจ็ด|แปด|เก้า|สิบ|ร้อย|พัน|หมื่น|แสน)+";
/** units after which a number word is safe to convert ("สี่เหลี่ยม" must stay) */
const UNITS = "คน|ถุง|ชั่วโมง|ชม\\.?|เปอร์เซ็นต์|เปอร์เซนต์|%|คิว|ลบ\\.ม\\.|ตัน|เส้น|แผ่น|ก้อน|ลูก|วัน|เมตร|ม\\.|ตร\\.ม\\.|ท่อน|คัน|เครื่อง|ชั้น|ห้อง|จุด|นาที|โมง|ตัว|ชุด|กล่อง|ถัง|กระป๋อง|ม้วน|เที่ยว|รถ";

/** "ยี่สิบห้า" → 25, "หนึ่งร้อยยี่สิบ" → 120, "สิบเอ็ด" → 11; undefined when not a clean number */
export function thaiWordsToNumber(w: string): number | undefined {
  let total = 0;
  let cur = 0;
  let i = 0;
  let any = false;
  while (i < w.length) {
    const d = Object.keys(DIGIT).find((k) => w.startsWith(k, i));
    if (d) {
      if (cur) return undefined; // two digits in a row: "สองสาม" is not a number
      cur = DIGIT[d];
      i += d.length;
      any = true;
      continue;
    }
    const u = Object.keys(UNIT).find((k) => w.startsWith(k, i));
    if (u) {
      total += (cur || 1) * UNIT[u];
      cur = 0;
      i += u.length;
      any = true;
      continue;
    }
    return undefined;
  }
  return any ? total + cur : undefined;
}

export function normalizeSpeech(raw: string): string {
  let s = raw.replace(/[๐-๙]/g, (c) => String(c.charCodeAt(0) - 0x0e50));
  // number words directly before a unit
  s = s.replace(new RegExp(`(${WORD_RE})(\\s*)(?=${UNITS})`, "g"), (m: string, w: string, sp: string, at: number, whole: string) => {
    const n = thaiWordsToNumber(w);
    if (n === undefined) return m;
    const lead = at > 0 && !/\s/.test(whole[at - 1]) ? " " : "";
    return `${lead}${n}${sp || " "}`;
  });
  // "2 จุด 5" → "2.5"
  s = s.replace(/(\d)\s*จุด\s*(\d)/g, "$1.$2");
  // percent words
  s = s.replace(/\s*(เปอร์เซ็นต์|เปอร์เซนต์|เปอร์เซ็น|percent)/gi, "%");
  // "ไป 70 %" → "70%"
  s = s.replace(/(\d)\s+%/g, "$1%");
  return s.replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").trim();
}

/** append a new final transcript chunk to what is already in the box */
export function appendTranscript(prev: string, chunk: string): string {
  const c = normalizeSpeech(chunk);
  if (!c) return prev;
  if (!prev.trim()) return c;
  return /[\s\n]$/.test(prev) ? prev + c : `${prev} ${c}`;
}
