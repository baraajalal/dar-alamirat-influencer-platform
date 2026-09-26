import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import { normalizeAppLocale } from "@/lib/i18n/app";
import { getAppDictionary } from "@/lib/i18n/app-dictionary";
import { getLegalDocument } from "@/lib/legal/content";

export default async function PrivacyPage() {
  const store = await cookies();
  const locale = normalizeAppLocale(
    store.get("app_locale")?.value ?? store.get("dashboard_locale")?.value,
  );
  const document = getLegalDocument("privacy", locale);
  const copy = getAppDictionary(locale).legal;

  return (
    <main className="min-h-screen bg-[#F8F6FA] px-4 py-8 text-[#432A57] sm:px-6" data-no-auto-translate>
      <article className="mx-auto max-w-4xl rounded-[30px] border border-[#E8DDED] bg-white p-6 shadow-[0_20px_60px_rgba(86,55,104,.08)] sm:p-10">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#F0E8F3] pb-6">
          <Image src="/da-logo.png" alt="Dar Al Amirat" width={150} height={72} className="h-14 w-auto object-contain" />
          <Link href="/portal-access/request" className="rounded-xl border border-[#DCCDE4] px-4 py-2 text-sm font-black text-[#8A58A3]">
            {copy.backToRegistration}
          </Link>
        </header>
        <p className="mt-8 text-sm font-black text-[#A170BA]">{document.versionLabel}</p>
        <h1 className="mt-2 text-3xl font-black leading-tight sm:text-4xl">{document.title}</h1>
        <p className="mt-4 text-sm font-semibold leading-8 text-[#74657B] sm:text-base">{document.intro}</p>
        <div className="mt-8 space-y-7">
          {document.sections.map((section) => (
            <section key={section.heading} className="rounded-2xl bg-[#FCFAFD] p-5">
              <h2 className="text-lg font-black">{section.heading}</h2>
              <div className="mt-3 space-y-3 text-sm font-semibold leading-8 text-[#6E6175]">
                {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </div>
            </section>
          ))}
        </div>
        <p className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-bold leading-6 text-amber-900">
          {copy.betaNotice}
        </p>
      </article>
    </main>
  );
}
