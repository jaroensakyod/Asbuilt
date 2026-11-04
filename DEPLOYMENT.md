# คู่มือติดตั้งและเปิดใช้งาน Asbuilt

## 1. รันบนเครื่อง

ต้องมี Node.js 20 ขึ้นไป

```bash
npm install
cp .env.example .env.local   # ถ้ายังไม่มี
npm run dev                  # เปิด http://localhost:3000
```

ตรวจโค้ดก่อน deploy: `npx tsc --noEmit`, `npm run lint`, `npm run build`

## 2. โหมดตัวอย่าง (demo) กับโหมดใช้งานจริง (live)

| | demo | live |
|---|---|---|
| เงื่อนไข | ไม่มีค่า Supabase หรือตั้ง `NEXT_PUBLIC_ASBUILT_MODE=demo` | มี `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` และ **ไม่มี** `NEXT_PUBLIC_ASBUILT_MODE=demo` |
| เข้าสู่ระบบ | ไม่ต้อง (เลือกบทบาทจากเมนู "ดูในบทบาท") | ต้องสมัคร/เข้าสู่ระบบ แล้วสร้างหรือเข้าร่วมบริษัท |
| ข้อมูล | ข้อมูลตัวอย่าง + การแก้ไขเก็บใน localStorage ของเบราว์เซอร์ | ตารางใน Supabase แยกตามบริษัทด้วย RLS |
| พอร์ทัลลูกค้า | ลิงก์คงที่ `/portal/demo-<รหัสโครงการ>` | ลิงก์สุ่มจากตาราง `portal_links` ยกเลิก/สร้างใหม่ได้ |

ค่า `NEXT_PUBLIC_*` ถูกฝังตอน build ต้อง build ใหม่ทุกครั้งที่เปลี่ยน

## 3. ตั้งค่า Supabase

1. สร้างโปรเจกต์ที่ [supabase.com](https://supabase.com) (แนะนำ region Singapore)
2. **รัน migration** ตามลำดับ `0001_init.sql` แล้ว `0002_records.sql` เลือกวิธีใดวิธีหนึ่ง
   - เปิด SQL Editor วางเนื้อหาไฟล์ใน `supabase/migrations/` ทีละไฟล์แล้วกด Run
   - หรือใส่ `SUPABASE_DB_URL` (Project Settings → Database → Connection string แบบ session pooler) ใน `.env.local` แล้วรัน `npm run db:migrate` สคริปต์จะจำไฟล์ที่รันแล้วในตาราง `_asbuilt_migrations`
3. **API keys**: Project Settings → API คัดลอก Project URL และ publishable key ใส่ใน `.env.local`
4. **Auth → URL Configuration**
   - Site URL: โดเมนจริง เช่น `https://app.example.co.th`
   - Redirect URLs: เพิ่ม `https://app.example.co.th/auth/callback` และ `http://localhost:3000/auth/callback` (ใช้กับยืนยันอีเมล ลืมรหัสผ่าน และคำเชิญ)
5. **Auth → Providers → Email**: ช่วงทดสอบปิด "Confirm email" ได้ ก่อนเปิดใช้งานจริงต้องเปิด (ดูข้อ 5)
6. **อีเมล**: อีเมลในตัวของ Supabase ส่งได้จำกัดต่อชั่วโมง ก่อนใช้งานจริงตั้ง SMTP ของบริษัทที่ Auth → SMTP Settings
7. Storage bucket `documents` (private) ถูกสร้างใน `0001_init.sql` แล้ว ตรวจว่ามีอยู่ใน Storage

## 4. Deploy ขึ้น Vercel

1. push โค้ดขึ้น GitHub แล้ว Import โปรเจกต์ใน Vercel (Framework: Next.js ไม่ต้องแก้คำสั่ง build)
2. Settings → Environment Variables ใส่
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `NEXT_PUBLIC_ASBUILT_MODE=demo` เฉพาะสภาพแวดล้อมที่ต้องการให้เป็นเดโม (เช่น Preview)
   - **ห้าม** ใส่ `SUPABASE_DB_URL` หรือ service role key ใน Vercel
3. Settings → Domains เพิ่มโดเมน ตั้ง DNS ตามที่ Vercel บอก (CNAME `cname.vercel-dns.com` หรือ A record)
4. กลับไปแก้ Site URL / Redirect URLs ใน Supabase ให้ตรงกับโดเมนจริง
5. Redeploy แล้วลองสมัคร เข้าสู่ระบบ สร้างบริษัท และเปิดลิงก์พอร์ทัลจากหน้าโครงการในหน้าต่างไม่ระบุตัวตน

## 5. เช็กลิสต์ก่อนเปิดใช้งานจริง

- [ ] ลบ `NEXT_PUBLIC_ASBUILT_MODE=demo` ออกจาก Production แล้ว redeploy
- [ ] เปิด Confirm email และตั้ง SMTP ของบริษัท
- [ ] Site URL และ Redirect URLs ชี้โดเมนจริง ไม่มี localhost ใน Production project
- [ ] สำรองข้อมูล: เปิด Point-in-Time Recovery หรือแพ็กเกจที่มี daily backup และทดลองกู้คืนอย่างน้อยหนึ่งครั้ง
- [ ] **ทดสอบ RLS ด้วยสองบริษัท**: สมัครผู้ใช้ A สร้างบริษัท 1 และผู้ใช้ B สร้างบริษัท 2 ใส่ข้อมูลตัวอย่างทั้งคู่ แล้วตรวจว่า B มองไม่เห็นโครงการ เอกสาร ไฟล์ใน Storage และ records ของ A (และกลับกัน)
- [ ] ทดสอบสิทธิ์ตามบทบาท เช่น โฟร์แมนต้องไม่เห็นต้นทุน ผู้ใช้ที่ไม่มีสิทธิ์ต้นทุนต้องไม่เห็นตัวเลขเงินในหน้าผู้บริหาร
- [ ] พอร์ทัลลูกค้า: เปิดลิงก์ในหน้าต่างไม่ระบุตัวตน ต้องเห็นเฉพาะโครงการนั้น ยกเลิกลิงก์แล้วต้องเปิดไม่ได้
- [ ] Supabase → Advisors ไม่มีคำเตือน security ค้างอยู่
- [ ] ตั้งค่าข้อมูลบริษัท (ชื่อ เลขผู้เสียภาษี สายด่วน LINE) ที่หน้า ผู้ใช้/ทีมงาน

## 6. สิ่งที่ยังไม่ได้ทำ

- **LINE OA**: ยังไม่ส่งแจ้งเตือนผ่าน LINE แสดงเพียง LINE ID เป็นข้อความในพอร์ทัล
- **ชำระเงินออนไลน์**: หน้าแพ็กเกจบันทึกเฉพาะแพ็กเกจที่เลือก ยังไม่มีการเรียกเก็บเงิน ราคาในระบบเป็นราคาตัวอย่าง ใบแจ้งหนี้ในโหมดเดโมเป็นข้อมูลตัวอย่าง ต้องเชื่อมผู้ให้บริการชำระเงิน (เช่น Omise/Stripe) และบังคับใช้ขีดจำกัดแพ็กเกจฝั่งเซิร์ฟเวอร์
- **เอกสารในพอร์ทัล (live)**: RPC `portal_view` ยังไม่ส่งรายการเอกสาร พอร์ทัลจึงแนะนำให้ขอเอกสารจากผู้จัดการโครงการ
- **กันสแปมแจ้งซ่อม**: `portal_report_repair` เปิดให้ผู้ถือลิงก์เรียกได้ไม่จำกัด ควรเพิ่ม rate limit / CAPTCHA ก่อนแจกลิงก์จำนวนมาก
