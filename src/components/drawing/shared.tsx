"use client";

import { memo, useSyncExternalStore } from "react";
import { sheetMarkup, type Sheet } from "@/lib/drawing";

const noop = () => () => {};

/** false during SSR/prerender, true in the browser — heavy drawing markup only renders client-side */
export function useIsClient() {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

/** Memoised sheet markup; only re-renders when the sheet object or level of detail changes */
export const SheetMarkup = memo(function SheetMarkup({ sheet, lite, transform }: { sheet: Sheet; lite?: boolean; transform?: string }) {
  return <g transform={transform} dangerouslySetInnerHTML={{ __html: sheetMarkup(sheet, lite) }} />;
});

export function fmt(v: number, d = 2) {
  return v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}
