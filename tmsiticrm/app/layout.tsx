import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TMSITI CRM",
  description: "TMSITI korporativ boshqaruv tizimi",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="uz" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
