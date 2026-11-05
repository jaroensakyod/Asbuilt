"use client";
import { Menu } from "lucide-react";
export function MobileMenu() {
 return <button type="button" aria-label="เปิดเมนูหลัก" className="mobile-menu rounded-lg p-2 text-ink-2" onClick={() => window.dispatchEvent(new Event("asbuilt:mobile-nav"))}><Menu size={21} /></button>;
}
