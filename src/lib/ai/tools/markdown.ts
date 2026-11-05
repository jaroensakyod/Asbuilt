// Tiny markdown parser for assistant answers (pure; rendered by components/ai/markdown.tsx).
// Supports: headings, paragraphs, bullet / numbered lists (with indent depth), tables,
// fenced code, horizontal rules; inline **bold**, *italic*, `code`, [links](href).

export type Inline = { t: "text"; v: string } | { t: "b"; c: Inline[] } | { t: "i"; c: Inline[] } | { t: "code"; v: string } | { t: "link"; href: string; internal: boolean; c: Inline[] } | { t: "br" };

/** `num` is the number of a numbered item (bullets have none) */
export type ListItem = { depth: number; c: Inline[]; num?: number };
export type Block =
  | { t: "h"; level: number; c: Inline[] }
  | { t: "p"; c: Inline[] }
  | { t: "ul"; items: ListItem[] }
  | { t: "ol"; start: number; items: ListItem[] }
  | { t: "table"; head: Inline[][]; rows: Inline[][][]; align: ("left" | "right" | "center")[] }
  | { t: "code"; v: string }
  | { t: "hr" };

/** only same-site paths and ordinary web/mail/phone links are made clickable */
export function safeHref(href: string): { href: string; internal: boolean } | null {
  const h = href.trim();
  if (/^\/(?!\/)/.test(h)) return { href: h, internal: true };
  if (/^(https?:|mailto:|tel:)/i.test(h)) return { href: h, internal: false };
  return null;
}

export function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  let buf = "";
  const flush = () => {
    if (buf) out.push({ t: "text", v: buf });
    buf = "";
  };
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    const rest = src.slice(i);
    if (ch === "\\" && i + 1 < src.length && /[*_`[\]()\\|]/.test(src[i + 1])) {
      buf += src[i + 1];
      i += 2;
      continue;
    }
    if (ch === "`") {
      const end = src.indexOf("`", i + 1);
      if (end > i) {
        flush();
        out.push({ t: "code", v: src.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }
    if (rest.startsWith("**") || rest.startsWith("__")) {
      const mark = rest.slice(0, 2);
      const end = src.indexOf(mark, i + 2);
      if (end > i + 2) {
        flush();
        out.push({ t: "b", c: parseInline(src.slice(i + 2, end)) });
        i = end + 2;
        continue;
      }
    }
    if ((ch === "*" || ch === "_") && src[i + 1] && src[i + 1] !== " " && src[i + 1] !== ch) {
      const end = src.indexOf(ch, i + 1);
      // "_" inside words (snake_case ids) is not emphasis
      const wordy = ch === "_" && i > 0 && /\w/.test(src[i - 1]);
      if (end > i + 1 && !wordy && src[end - 1] !== " ") {
        flush();
        out.push({ t: "i", c: parseInline(src.slice(i + 1, end)) });
        i = end + 1;
        continue;
      }
    }
    if (ch === "[") {
      const m = rest.match(/^\[([^\]]+)\]\(([^)\s]+)\)/);
      if (m) {
        const link = safeHref(m[2]);
        flush();
        if (link) out.push({ t: "link", href: link.href, internal: link.internal, c: parseInline(m[1]) });
        else out.push(...parseInline(m[1]));
        i += m[0].length;
        continue;
      }
    }
    if (ch === "<" && /^<br\s*\/?>/i.test(rest)) {
      flush();
      out.push({ t: "br" });
      i += rest.match(/^<br\s*\/?>/i)![0].length;
      continue;
    }
    buf += ch;
    i++;
  }
  flush();
  return out;
}

const splitRow = (line: string) => {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|") && !s.endsWith("\\|")) s = s.slice(0, -1);
  const cells: string[] = [];
  let cur = "";
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "\\" && s[i + 1] === "|") {
      cur += "|";
      i++;
    } else if (s[i] === "|") {
      cells.push(cur.trim());
      cur = "";
    } else cur += s[i];
  }
  cells.push(cur.trim());
  return cells;
};
const isSep = (line: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line);
const BULLET = /^(\s*)[-*+•]\s+(.*)$/;
const NUMBERED = /^(\s*)(\d+)[.)]\s+(.*)$/;

export function parseMarkdown(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];
  const flushPara = () => {
    if (para.length) blocks.push({ t: "p", c: parseInline(para.join("\n")).flatMap((n) => (n.t === "text" && n.v.includes("\n") ? splitBreaks(n.v) : [n])) });
    para = [];
  };
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      flushPara();
      i++;
      continue;
    }
    if (/^\s*```/.test(line)) {
      flushPara();
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) body.push(lines[i++]);
      i++;
      blocks.push({ t: "code", v: body.join("\n") });
      continue;
    }
    const h = line.match(/^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/);
    if (h) {
      flushPara();
      blocks.push({ t: "h", level: h[1].length, c: parseInline(h[2]) });
      i++;
      continue;
    }
    if (/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(line)) {
      flushPara();
      blocks.push({ t: "hr" });
      i++;
      continue;
    }
    if (line.includes("|") && i + 1 < lines.length && isSep(lines[i + 1])) {
      flushPara();
      const head = splitRow(line);
      const align = splitRow(lines[i + 1]).map((c) => (c.startsWith(":") && c.endsWith(":") ? "center" : c.endsWith(":") ? "right" : "left") as "left" | "right" | "center");
      i += 2;
      const rows: Inline[][][] = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) {
        const cells = splitRow(lines[i]);
        rows.push(head.map((_, k) => parseInline(cells[k] ?? "")));
        i++;
      }
      blocks.push({ t: "table", head: head.map(parseInline), rows, align: head.map((_, k) => align[k] ?? "left") });
      continue;
    }
    const b = line.match(BULLET);
    const n = line.match(NUMBERED);
    if (b || n) {
      flushPara();
      const ordered = !b && !!n;
      const items: ListItem[] = [];
      const start = n && !b ? Number(n[2]) : 1;
      while (i < lines.length) {
        const l = lines[i];
        const mb = l.match(BULLET);
        const mn = l.match(NUMBERED);
        const m = ordered ? (mn ?? (mb && mb[1].length >= 2 ? mb : null)) : (mb ?? (mn && mn[1].length >= 2 ? mn : null));
        if (m) {
          const indent = m[1].length;
          const text = m === mn ? mn![3] : mb![2];
          items.push({ depth: Math.min(3, Math.floor(indent / 2)), c: parseInline(text), ...(m === mn ? { num: Number(mn![2]) } : {}) });
          i++;
        } else if (l.trim() && /^\s{2,}\S/.test(l) && items.length) {
          // continuation line of the previous item
          items[items.length - 1].c.push({ t: "br" }, ...parseInline(l.trim()));
          i++;
        } else break;
      }
      blocks.push(ordered ? { t: "ol", start, items } : { t: "ul", items });
      continue;
    }
    para.push(line);
    i++;
  }
  flushPara();
  return blocks;
}

function splitBreaks(v: string): Inline[] {
  const out: Inline[] = [];
  v.split("\n").forEach((part, k) => {
    if (k) out.push({ t: "br" });
    if (part) out.push({ t: "text", v: part });
  });
  return out;
}

/** plain text of a markdown answer (for copying without symbols) */
export function inlineText(c: Inline[]): string {
  return c.map((n) => (n.t === "text" || n.t === "code" ? n.v : n.t === "br" ? "\n" : inlineText(n.c))).join("");
}
