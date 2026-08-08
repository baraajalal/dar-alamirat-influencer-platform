import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "بوابة المؤثرين | دار الأميرات",
  description: "إدارة المؤثرين والحملات الإعلانية والمحتوى والمدفوعات.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className="h-full antialiased" data-scroll-behavior="smooth">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
