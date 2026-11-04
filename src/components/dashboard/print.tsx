"use client";

import { Printer } from "lucide-react";

/**
 * Print stylesheet for summary pages: hides the app chrome (sidebar, top bar,
 * buttons marked data-noprint) and lets cards flow on A4.
 */
export function PrintStyles() {
  return (
    <style>{`
@media print {
  @page { size: A4; margin: 12mm; }
  html, body { background: #fff !important; }
  aside, body > div > div > header.sticky, [data-noprint] { display: none !important; }
  main { max-width: none !important; padding: 0 !important; }
  section { break-inside: avoid; box-shadow: none !important; }
  .leaflet-container { display: none !important; }
  [data-printonly] { display: block !important; }
}
[data-printonly] { display: none; }
`}</style>
  );
}

export function PrintButton({ label = "พิมพ์สรุป" }: { label?: string }) {
  return (
    <button
      type="button"
      data-noprint
      onClick={() => window.print()}
      className="inline-flex h-9 items-center gap-2 rounded-[8px] border border-line-strong bg-card px-4 text-[14px] font-medium text-ink transition-[background-color,transform] duration-150 hover:bg-raised active:scale-[0.98]"
    >
      <Printer size={16} strokeWidth={1.5} />
      {label}
    </button>
  );
}
