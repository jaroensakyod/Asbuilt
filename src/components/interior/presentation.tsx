"use client";

// Printable client presentation: one page per room board with the products and client prices.

import { PrintSheet } from "@/components/accounting/bits";
import { COMPANY_INFO, TODAY } from "@/lib/data";
import { ffeItems, ffeSell, moodBoards, products, type InteriorProject } from "@/lib/interior";
import { dateOr } from "@/components/design/bits";
import { BoardTileView } from "./boards";

export function PresentationSheet({ p, open, onClose }: { p: InteriorProject; open: boolean; onClose: () => void }) {
  const boards = moodBoards.use().filter((b) => b.interiorId === p.id);
  const prods = products.use();
  const items = ffeItems.use().filter((i) => i.interiorId === p.id);
  const rooms = p.rooms.map((r) => r.name);
  const grand = items.reduce((t, i) => t + ffeSell(i), 0);
  return (
    <PrintSheet open={open} onClose={onClose} title="พรีเซนต์ลูกค้า">
      <div className="text-[12.5px]">
        <div className="border-b border-ink pb-4">
          <p className="text-ink-3">{COMPANY_INFO.name}</p>
          <h1 className="mt-6 text-[28px] font-normal leading-tight">{p.name}</h1>
          <p className="mt-1 text-[14px] text-ink-2">
            นำเสนอคุณ{p.client.replace(/^คุณ/, "")} · โดย {p.designer} · {dateOr(TODAY)}
          </p>
        </div>
        {rooms.map((room) => {
          const rb = boards.filter((b) => b.room === room);
          const ri = items.filter((i) => i.room === room);
          if (!rb.length && !ri.length) return null;
          return (
            <section key={room} className="mt-8" style={{ breakBefore: "page" }}>
              <h2 className="text-[20px] font-normal">{room}</h2>
              {rb.map((b) => (
                <div key={b.id} className="avoid-break mt-3">
                  <p className="text-[14px] font-medium">{b.title}</p>
                  {b.notes && <p className="mt-0.5 text-ink-2">{b.notes}</p>}
                  <div className="mt-3 grid grid-cols-4 gap-3">
                    {b.tiles.map((t) => (
                      <BoardTileView key={t.id} t={t} prods={prods} showPrice />
                    ))}
                  </div>
                </div>
              ))}
              {ri.length > 0 && (
                <table className="avoid-break mt-4 w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-line-strong text-ink-3">
                      <th className="py-1 pr-2 font-normal">รายการ</th>
                      <th className="py-1 pr-2 text-right font-normal">จำนวน</th>
                      <th className="py-1 text-right font-normal">ราคา (ก่อน VAT)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ri.map((i) => (
                      <tr key={i.id} className="border-b border-line">
                        <td className="py-1 pr-2">{i.description}</td>
                        <td className="num py-1 pr-2 text-right font-mono">
                          {i.qty} {i.unit}
                        </td>
                        <td className="num py-1 text-right font-mono">{Math.round(ffeSell(i)).toLocaleString("th-TH")}</td>
                      </tr>
                    ))}
                    <tr>
                      <td className="py-1 font-medium" colSpan={2}>
                        รวม{room}
                      </td>
                      <td className="num py-1 text-right font-mono font-medium">{Math.round(ri.reduce((t, i) => t + ffeSell(i), 0)).toLocaleString("th-TH")}</td>
                    </tr>
                  </tbody>
                </table>
              )}
            </section>
          );
        })}
        <p className="mt-8 border-t border-ink pt-3 text-right text-[14px]">
          รวมทั้งงาน (ก่อน VAT) <span className="num font-mono font-medium">{Math.round(grand).toLocaleString("th-TH")}</span> บาท
        </p>
        <p className="mt-1 text-right text-ink-3">ราคานี้ยังไม่รวมค่าออกแบบ {Math.round(p.designFee).toLocaleString("th-TH")} บาท</p>
      </div>
    </PrintSheet>
  );
}
