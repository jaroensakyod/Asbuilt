"use client";

import { sheetDxf, standaloneSvg, THEME, toDxf, type Sheet } from "@/lib/drawing";

export function download(name: string, body: string, type: string) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const fileBase = (modelCode: string, modelName: string) => `${modelCode}_${modelName.replace(/\s+/g, "-")}`;

export function downloadSvg(sheet: Sheet, hidden: Iterable<string> = []) {
  download(`${sheet.code}.svg`, standaloneSvg(sheet, THEME.paper, hidden), "image/svg+xml");
}

export function downloadDxf(sheet: Sheet, hidden: Iterable<string> = []) {
  download(`${sheet.code}.dxf`, sheetDxf(sheet, hidden), "application/dxf");
}

export function downloadSetDxf(name: string, parts: { sheet: Sheet; x: number; y: number }[], hidden: Iterable<string> = [], frozen: Iterable<string> = []) {
  download(`${name}.dxf`, toDxf(parts.map((p) => ({ prims: p.sheet.prims, dx: p.x, dy: p.y })), { hidden, frozen }), "application/dxf");
}

/** Open a print window with one A3 landscape page per sheet */
export function printSheets(sheets: Sheet[], title: string, hidden: Iterable<string> = []) {
  const w = window.open("", "_blank", "width=1100,height=800");
  if (!w) return false;
  const pages = sheets.map((s) => `<div class="pg">${standaloneSvg(s, THEME.paper, hidden).replace(/^<\?xml[^>]*>\s*/, "")}</div>`).join("");
  w.document.open();
  w.document.write(
    `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${title}</title><style>@page{size:A3 landscape;margin:0}html,body{margin:0;background:#fff}.pg{width:420mm;height:297mm;page-break-after:always;break-after:page;overflow:hidden}.pg svg{display:block;width:420mm;height:297mm}</style></head><body>${pages}<script>window.onload=function(){setTimeout(function(){window.focus();window.print();},250)}</script></body></html>`,
  );
  w.document.close();
  return true;
}
