// POST /api/skp — convert a SketchUp file to GLB for the 3D viewer.
//   body = the .skp bytes (application/octet-stream)  → responds with the GLB bytes; info in the
//          "x-skp-info" header (URI-encoded JSON). Used in demo mode and local dev.
//   body = JSON { path }  (live mode)                  → reads the .skp from Supabase Storage
//          (bucket "documents", RLS applies), writes "<same folder>/<name>.glb", responds with
//          JSON { path, size, info }. Hosting platforms cap request bodies (Vercel ~4.5 MB),
//          so large files must go through Storage.

import { connection } from "next/server";
import { LIVE } from "@/lib/supabase/env";
import { serverSupabase } from "@/lib/supabase/server";
import { convertSkp, SkpError } from "@/lib/model3d/skp";

export const maxDuration = 300;

const MAX_BYTES = 200 * 1024 * 1024;

const fail = (error: string, status: number) => Response.json({ error }, { status });

export async function POST(request: Request) {
  await connection();
  const sb = LIVE ? await serverSupabase() : null;
  if (LIVE) {
    const { data } = (await sb?.auth.getUser()) ?? { data: { user: null } };
    if (!data.user) return fail("ต้องเข้าสู่ระบบก่อน", 401);
  }

  const type = request.headers.get("content-type") ?? "";
  try {
    if (type.includes("application/json")) {
      if (!sb) return fail("โหมดนี้ใช้ได้เมื่อเชื่อม Supabase", 400);
      const { path } = (await request.json()) as { path?: string };
      if (!path || !/\.skp$/i.test(path) || path.includes("..")) return fail("ต้องระบุ path ของไฟล์ .skp", 400);
      const dl = await sb.storage.from("documents").download(path);
      if (dl.error || !dl.data) return fail("อ่านไฟล์จากที่เก็บไม่ได้", 404);
      const { glb, info } = convertSkp(new Uint8Array(await dl.data.arrayBuffer()));
      const out = path.replace(/\.skp$/i, ".glb");
      const up = await sb.storage.from("documents").upload(out, glb, { contentType: "model/gltf-binary", upsert: true });
      if (up.error) return fail(`บันทึกไฟล์ 3D ไม่ได้: ${up.error.message}`, 500);
      return Response.json({ path: out, size: glb.byteLength, info });
    }

    const size = Number(request.headers.get("content-length") ?? 0);
    if (size > MAX_BYTES) return fail(`ไฟล์ใหญ่เกิน ${MAX_BYTES / 1048576} MB`, 413);
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (!bytes.length) return fail("ไม่มีข้อมูลไฟล์", 400);
    const { glb, info } = convertSkp(bytes);
    return new Response(glb as unknown as BodyInit, {
      headers: { "content-type": "model/gltf-binary", "content-length": String(glb.byteLength), "x-skp-info": encodeURIComponent(JSON.stringify(info)) },
    });
  } catch (e) {
    if (e instanceof SkpError) return fail(e.message, 422);
    console.error("skp convert:", e);
    return fail("แปลงไฟล์ .skp ไม่สำเร็จ", 500);
  }
}
