"use client";

import { useState } from "react";
import { Heart, Plus, Share2, X } from "lucide-react";
import { Card, CardHead, cx, Field, inputCls } from "@/components/ui";
import { Btn, Empty, I, Modal, Pill, Select, areaCls } from "@/components/ops/bits";
import { MediaField } from "@/components/media/media-field";
import { TODAY } from "@/lib/data";
import { moodBoards, products, type BoardTile, type InteriorProject, type MoodBoard, type Product } from "@/lib/interior";
import { Amt, Swatch, dateOr, usePerms } from "@/components/design/bits";

/** One tile of a board: product photo / colour chip, or an uploaded reference image */
export function BoardTileView({ t, prods, showPrice, className }: { t: BoardTile; prods: Product[]; showPrice?: boolean; className?: string }) {
  const pr = t.productId ? prods.find((x) => x.id === t.productId) : undefined;
  return (
    <figure className={cx("flex flex-col gap-1", className)}>
      <Swatch image={t.image ?? pr?.images[0]} color={pr?.swatch} label={t.caption ?? pr?.name ?? "ภาพอ้างอิง"} className="aspect-square w-full" />
      <figcaption className="text-[12px] leading-snug">
        <span className="block text-ink">{t.caption ?? pr?.name ?? "ภาพอ้างอิง"}</span>
        {pr && (
          <span className="block text-ink-3">
            {[pr.finish, pr.colour].filter(Boolean).join(" · ")}
            {showPrice && (
              <>
                {" · "}
                <Amt n={pr.clientPrice} />
              </>
            )}
          </span>
        )}
      </figcaption>
    </figure>
  );
}

export function BoardsTab({ p }: { p: InteriorProject }) {
  const { edit } = usePerms("interior");
  const all = moodBoards.use();
  const prods = products.use();
  const boards = all.filter((b) => b.interiorId === p.id);
  const [creating, setCreating] = useState(false);
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-ink-2">{p.projectId ? "บอร์ดที่แชร์จะแสดงในพอร์ทัลเจ้าของบ้าน ลูกค้ากดชอบหรือแสดงความเห็นได้" : "ลูกค้าภายนอกไม่มีพอร์ทัล ใช้ “พรีเซนต์ลูกค้า” เพื่อพิมพ์หรือบันทึก PDF ส่งให้ลูกค้า"}</p>
        {edit && (
          <Btn primary onClick={() => setCreating(true)}>
            <Plus {...I} />
            บอร์ดใหม่
          </Btn>
        )}
      </div>
      {boards.length === 0 && (
        <Card>
          <Empty>ยังไม่มีบอร์ด</Empty>
        </Card>
      )}
      <div className="grid gap-4 xl:grid-cols-2">
        {boards.map((b) => (
          <Board key={b.id} b={b} prods={prods} edit={edit} portal={!!p.projectId} />
        ))}
      </div>
      {creating && <NewBoard p={p} onClose={() => setCreating(false)} />}
    </>
  );
}

function Board({ b, prods, edit, portal }: { b: MoodBoard; prods: Product[]; edit: boolean; portal: boolean }) {
  const [adding, setAdding] = useState(false);
  const save = (patch: Partial<MoodBoard>) => moodBoards.upsert({ ...b, ...patch });
  return (
    <Card>
      <CardHead
        title={b.title}
        meta={b.room}
        action={
          <div className="flex items-center gap-2">
            {b.shared ? <Pill tone="pos">แชร์แล้ว {dateOr(b.sharedAt)}</Pill> : <Pill>ยังไม่แชร์</Pill>}
            {edit && portal && (
              <Btn small onClick={() => save({ shared: !b.shared, sharedAt: b.shared ? b.sharedAt : TODAY })}>
                <Share2 {...I} />
                {b.shared ? "เลิกแชร์" : "แชร์ให้ลูกค้า"}
              </Btn>
            )}
          </div>
        }
      />
      <div className="grid grid-cols-3 gap-3 px-5 py-4 sm:grid-cols-4">
        {b.tiles.map((t) => (
          <div key={t.id} className="group relative">
            <BoardTileView t={t} prods={prods} />
            {edit && (
              <button type="button" aria-label="นำออก" onClick={() => save({ tiles: b.tiles.filter((x) => x.id !== t.id) })} className="absolute right-1 top-1 hidden size-6 items-center justify-center rounded-full bg-card text-ink-3 shadow group-hover:flex hover:text-neg">
                <X size={14} strokeWidth={1.5} />
              </button>
            )}
          </div>
        ))}
        {edit && (
          <button type="button" onClick={() => setAdding(true)} className="flex aspect-square flex-col items-center justify-center gap-1 rounded-[8px] border border-dashed border-line-strong text-[12px] text-ink-3 hover:bg-raised hover:text-ink">
            <Plus {...I} />
            เพิ่มภาพ
          </button>
        )}
      </div>
      <div className="border-t border-line px-5 py-3 text-[13px]">
        {edit ? <textarea defaultValue={b.notes ?? ""} onBlur={(e) => e.target.value !== (b.notes ?? "") && save({ notes: e.target.value || undefined })} placeholder="แนวคิดของห้อง โทนสี วัสดุ" className={cx(areaCls, "w-full")} /> : <p className="text-ink-2">{b.notes}</p>}
      </div>
      {(b.clientComment || b.clientLiked) && (
        <div className="border-t border-line bg-raised/40 px-5 py-3 text-[13px]">
          <p className="flex items-center gap-1.5 text-ink-3">
            {b.clientLiked && <Heart size={14} strokeWidth={1.5} className="fill-accent text-accent" />}
            ความเห็นลูกค้า{b.clientCommentAt ? ` · ${dateOr(b.clientCommentAt)}` : ""}
          </p>
          {b.clientComment && <p className="mt-0.5 text-ink">{b.clientComment}</p>}
        </div>
      )}
      {adding && <AddTile b={b} prods={prods} onClose={() => setAdding(false)} />}
    </Card>
  );
}

function AddTile({ b, prods, onClose }: { b: MoodBoard; prods: Product[]; onClose: () => void }) {
  const [productId, setProductId] = useState(prods[0]?.id ?? "");
  const [images, setImages] = useState<NonNullable<BoardTile["image"]>[]>([]);
  const [caption, setCaption] = useState("");
  const add = () => {
    const tiles: BoardTile[] = images.length ? images.map((image, i) => ({ id: `T${Date.now().toString(36)}${i}`, image, caption: caption || undefined, productId: productId || undefined })) : [{ id: `T${Date.now().toString(36)}`, productId, caption: caption || undefined }];
    moodBoards.upsert({ ...b, tiles: [...b.tiles, ...tiles] });
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`เพิ่มภาพในบอร์ด ${b.room}`}
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary disabled={!productId && !images.length} onClick={add}>
            เพิ่ม
          </Btn>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="สินค้าจากแคตตาล็อก">
          <Select label="สินค้า" value={productId} onChange={setProductId}>
            <option value="">– ภาพอ้างอิงอย่างเดียว –</option>
            {prods.map((x) => (
              <option key={x.id} value={x.id}>
                {x.sku} · {x.name}
              </option>
            ))}
          </Select>
        </Field>
        <MediaField value={images} onChange={setImages} label="หรืออัปโหลดภาพ (แทนรูปสินค้า)" photosOnly geotag={false} max={8} />
        <Field label="คำบรรยายภาพ">
          <input value={caption} onChange={(e) => setCaption(e.target.value)} className={inputCls} />
        </Field>
      </div>
    </Modal>
  );
}

function NewBoard({ p, onClose }: { p: InteriorProject; onClose: () => void }) {
  const [room, setRoom] = useState(p.rooms[0]?.name ?? "");
  const [title, setTitle] = useState("");
  const save = () => {
    const n = moodBoards.all().filter((b) => b.interiorId === p.id).length + 1;
    moodBoards.upsert({ id: `MB-${p.id}-${n}-${Date.now().toString(36).slice(-3)}`, interiorId: p.id, projectId: p.projectId, room, title: title.trim() || room, tiles: [], shared: false });
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="บอร์ดใหม่"
      width={480}
      footer={
        <>
          <Btn onClick={onClose}>ยกเลิก</Btn>
          <Btn primary disabled={!room} onClick={save}>
            สร้าง
          </Btn>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="ห้อง">
          <Select label="ห้อง" value={room} onChange={setRoom}>
            {p.rooms.map((r) => (
              <option key={r.name}>{r.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="ชื่อบอร์ด">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="เช่น ห้องนั่งเล่น · Warm minimal" className={inputCls} />
        </Field>
      </div>
    </Modal>
  );
}
