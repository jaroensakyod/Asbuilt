import type { MetadataRoute } from "next";

// Installable web app (PWA): "เพิ่มลงหน้าจอหลัก" on phones, opens without the browser bar.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Asbuilt · แฟ้มบ้าน",
    short_name: "Asbuilt",
    description: "บริหารงานก่อสร้าง หน้างาน และหลังการขาย",
    lang: "th",
    start_url: "/m",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f4f6fa",
    theme_color: "#13243b",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    shortcuts: [
      { name: "รายงานประจำวัน", url: "/m/diary" },
      { name: "ลงเวลา", url: "/m/clock" },
      { name: "แจ้งซ่อม", url: "/repairs?new=" },
    ],
  };
}
