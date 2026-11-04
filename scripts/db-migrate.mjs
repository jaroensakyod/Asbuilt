// Apply supabase/migrations/*.sql to the database in SUPABASE_DB_URL (from .env.local).
// Usage: npm run db:migrate
// Each file runs once; applied files are tracked in public._asbuilt_migrations.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  const file = join(root, ".env.local");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

loadEnv();
const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error("SUPABASE_DB_URL is not set. Add it to .env.local (Supabase → Project Settings → Database → Connection string, session pooler).");
  console.error("Or paste supabase/migrations/*.sql into the Supabase SQL editor instead.");
  process.exit(1);
}

const sql = postgres(url, { ssl: "require", max: 1, onnotice: () => {} });
const dir = join(root, "supabase", "migrations");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

try {
  await sql`create table if not exists public._asbuilt_migrations (name text primary key, applied_at timestamptz not null default now())`;
  const done = new Set((await sql`select name from public._asbuilt_migrations`).map((r) => r.name));
  let applied = 0;
  for (const f of files) {
    if (done.has(f)) continue;
    const body = readFileSync(join(dir, f), "utf8");
    process.stdout.write(`applying ${f} … `);
    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`insert into public._asbuilt_migrations (name) values (${f})`;
    });
    console.log("ok");
    applied++;
  }
  console.log(applied ? `${applied} migration(s) applied` : "database is up to date");
} catch (e) {
  console.error("\nmigration failed:", e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
