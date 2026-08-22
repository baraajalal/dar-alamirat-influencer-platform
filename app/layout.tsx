import type { Metadata } from "next";
import { cookies } from "next/headers";
import { AppLanguageSwitcher } from "@/components/i18n/language-switcher";
import { GlobalTranslator } from "@/components/i18n/global-translator";
import { appDirection, normalizeAppLocale } from "@/lib/i18n/app";
import "./globals.css";
import "./brand-theme.css";

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const locale = normalizeAppLocale(cookieStore.get("app_locale")?.value ?? cookieStore.get("dashboard_locale")?.value);
  return locale === "en"
    ? {
        title: "Dar Al Ameerat | Creator Community",
        description: "Creator community, campaigns, collaborations, content, and payments at Dar Al Ameerat.",
      }
    : {
        title: "مجتمع صُنّاع المحتوى | دار الأميرات",
        description: "مجتمع صُنّاع المحتوى والحملات والتعاونات والمحتوى والمستحقات في دار الأميرات.",
      };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const locale = normalizeAppLocale(cookieStore.get("app_locale")?.value ?? cookieStore.get("dashboard_locale")?.value);
  const direction = appDirection(locale);

  return (
    <html lang={locale} dir={direction} data-locale={locale} data-scroll-behavior="smooth" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <GlobalTranslator locale={locale} />
        <AppLanguageSwitcher locale={locale} />
        {children}
      </body>
    </html>
  );
}
