export const metadata = { title: "ออฟไลน์ · Asbuilt" };

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-3 px-6">
      <h1 className="text-[26px] font-normal">ไม่มีสัญญาณอินเทอร์เน็ต</h1>
      <p className="text-ink-2">หน้านี้ยังไม่เคยเปิดในเครื่องนี้ จึงยังไม่มีสำเนาให้ใช้ตอนออฟไลน์</p>
      <p className="text-ink-2">หน้าที่เคยเปิดแล้วยังใช้ได้ และสิ่งที่บันทึกระหว่างออฟไลน์จะถูกส่งขึ้นระบบเองเมื่อกลับมาออนไลน์</p>
      <a href="/m" className="mt-2 inline-flex h-10 w-fit items-center rounded-[8px] bg-ink px-4 text-[14px] font-medium text-card">
        กลับไปหน้าหน้างาน
      </a>
    </main>
  );
}
