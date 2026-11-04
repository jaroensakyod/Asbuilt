import { thDate } from "@/lib/data";
import { DOC_CATEGORY_LABEL, DOC_TYPE_LABEL, docSize, type DocItem } from "@/lib/docs-data";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** A drawing-style cover sheet (A4 portrait) standing in for demo files without real content */
export function coverSvg(d: DocItem, projectName: string, company: string) {
  const W = 595;
  const H = 842;
  const lines: string[] = [];
  // faint drafting grid
  for (let x = 40; x <= W - 40; x += 20) lines.push(`<line x1="${x}" y1="40" x2="${x}" y2="${H - 200}" stroke="#1f1b16" stroke-opacity="0.05"/>`);
  for (let y = 40; y <= H - 200; y += 20) lines.push(`<line x1="40" y1="${y}" x2="${W - 40}" y2="${y}" stroke="#1f1b16" stroke-opacity="0.05"/>`);
  const row = (y: number, k: string, v: string) =>
    `<text x="56" y="${y}" font-size="11" fill="#7b7266">${esc(k)}</text><text x="190" y="${y}" font-size="12" fill="#1f1b16" font-family="ui-monospace, monospace">${esc(v)}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="'IBM Plex Sans Thai', system-ui, sans-serif">
<rect width="${W}" height="${H}" fill="#fdfbf7"/>
<rect x="24" y="24" width="${W - 48}" height="${H - 48}" fill="none" stroke="#1f1b16" stroke-width="1.2"/>
${lines.join("")}
<text x="56" y="96" font-size="13" fill="#7b7266">${esc(DOC_CATEGORY_LABEL[d.category])} · ${esc(d.projectId)}</text>
<text x="56" y="132" font-size="24" fill="#1f1b16">${esc(d.title.length > 34 ? d.title.slice(0, 33) + "…" : d.title)}</text>
<text x="56" y="160" font-size="14" fill="#5e554a">${esc(projectName)}</text>
<rect x="40" y="${H - 200}" width="${W - 80}" height="160" fill="#efe9df" stroke="#1f1b16" stroke-opacity="0.3"/>
<line x1="40" y1="${H - 160}" x2="${W - 40}" y2="${H - 160}" stroke="#1f1b16" stroke-opacity="0.2"/>
<text x="56" y="${H - 175}" font-size="13" fill="#1f1b16">${esc(company)}</text>
${row(H - 136, "ไฟล์", d.file)}
${row(H - 114, "ชนิด / ขนาด", `${DOC_TYPE_LABEL[d.type]} · ${docSize(d.sizeKb)}`)}
${row(H - 92, "ผู้จัดทำ", d.by)}
${row(H - 70, "วันที่", thDate(d.date))}
<text x="${W - 56}" y="${H - 70}" font-size="10" fill="#7b7266" text-anchor="end">ตัวอย่างเอกสาร ไม่ใช่ไฟล์ต้นฉบับ</text>
</svg>`;
}

export function svgDataUrl(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
