import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Thai, IBM_Plex_Mono } from "next/font/google";
import { Suspense } from "react";
import { AppFrame } from "@/components/shell/app-frame";
import "./globals.css";

const plexThai = IBM_Plex_Sans_Thai({
  variable: "--font-plex-thai",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Asbuilt · แฟ้มบ้าน",
  description: "แบบ อุปกรณ์ การตรวจ และแจ้งซ่อมของบ้านทุกหลัง ในที่เดียว",
  appleWebApp: { capable: true, title: "Asbuilt", statusBarStyle: "default" },
  icons: { icon: "/icon.svg", apple: "/apple-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#1f1b16",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={`${plexThai.variable} ${plexMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <Suspense fallback={null}>
          <AppFrame>{children}</AppFrame>
        </Suspense>
      </body>
    </html>
  );
}
