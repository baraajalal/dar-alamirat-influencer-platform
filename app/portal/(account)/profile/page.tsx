import Link from "next/link";
import { cookies } from "next/headers";
import { requireInfluencerAccount } from "@/lib/influencer-portal/require-influencer-account";
import { normalizeAppLocale, type AppLocale } from "@/lib/i18n/app";
import { getAppDictionary, type AppDictionary } from "@/lib/i18n/app-dictionary";

type SocialAccountRow = {
  id: string;
  platform: string;
  username: string;
  profile_url: string | null;
  followers_count: number | string | null;
  last_checked_at: string | null;
};
type Copy = AppDictionary["profile"];

export default async function InfluencerProfilePage() {
  const store = await cookies();
  const locale = normalizeAppLocale(
    store.get("app_locale")?.value ?? store.get("dashboard_locale")?.value,
  );
  const copy = getAppDictionary(locale).profile;
  const { admin, influencer } = await requireInfluencerAccount();
  const { data: socialAccounts } = await admin
    .from("social_accounts")
    .select("id,platform,username,profile_url,followers_count,last_checked_at")
    .eq("influencer_id", influencer.id)
    .order("followers_count", { ascending: false });

  const accounts = (socialAccounts ?? []) as SocialAccountRow[];

  return (
    <div className="space-y-5" data-no-auto-translate>
      <section className="rounded-[28px] bg-[linear-gradient(135deg,#9C68B9,#BE95D0)] p-6 text-white shadow-[0_20px_60px_rgba(70,90,175,0.20)]">
        <p className="text-sm font-black text-white/70">{copy.eyebrow}</p>
        <h1 className="mt-2 text-2xl font-black">{copy.title}</h1>
        <p className="mt-3 max-w-3xl text-sm font-semibold leading-7 text-white/78">
          {copy.description}
        </p>
      </section>

      <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[28px] border border-white bg-white/90 p-6 shadow-[0_16px_45px_rgba(68,82,140,0.08)]">
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-[26px] bg-[#F7F0FA] text-2xl font-black text-[#9A68B5]">
              {initials(influencer.full_name)}
            </div>
            <div>
              <p className="text-xl font-black text-[#4A315C]">{influencer.full_name}</p>
              <p className="mt-1 text-sm font-bold text-[#8D7C94]">{copy.activeAccount}</p>
            </div>
          </div>

          <div className="mt-6 space-y-4 rounded-2xl bg-[#FCF9FD] p-5">
            <Info label={copy.email} value={maskEmail(influencer.email, copy.maskedEmailFallback, copy.notAdded)} ltr />
            <Info label={copy.mobile} value={maskMobile(influencer.mobile_e164)} ltr />
            <Info label={copy.city} value={influencer.city || copy.notAdded} />
            <Info label={copy.country} value={influencer.country || copy.defaultCountry} />
            <Info label={copy.completion} value={`${influencer.profile_completion ?? 0}%`} />
          </div>

          <Link
            href="/portal/profile/payment-details"
            className="mt-5 flex h-13 items-center justify-center rounded-2xl bg-[#9A68B5] px-5 py-3 text-sm font-black text-white"
          >
            {copy.openBank}
          </Link>
        </div>

        <div className="rounded-[28px] border border-white bg-white/90 p-6 shadow-[0_16px_45px_rgba(68,82,140,0.08)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-[#9F6EB8]">{copy.socialEyebrow}</p>
              <h2 className="mt-1 text-xl font-black">{copy.socialTitle}</h2>
            </div>
            <span className="rounded-full bg-[#F7F0FA] px-3 py-1.5 text-xs font-black text-[#9362AD]">
              {replace(copy.accountCount, { count: number(accounts.length, locale) })}
            </span>
          </div>

          <div className="mt-5 space-y-3">
            {accounts.length === 0 ? (
              <Empty text={copy.empty} />
            ) : (
              accounts.map((account) => (
                <article
                  key={account.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#F3EDF7] bg-[#FEFCFF] p-4"
                >
                  <div>
                    <p className="font-black text-[#4A315C]">{platformLabel(account.platform, copy)}</p>
                    <p className="mt-1 text-xs font-bold text-[#8D7C94]" dir="ltr">
                      @{account.username}
                    </p>
                  </div>
                  <div className="text-end">
                    <p className="font-black text-[#5C456B]">
                      {number(Number(account.followers_count ?? 0), locale)}
                    </p>
                    <p className="mt-1 text-[11px] font-bold text-[#9AA2B9]">{copy.followers}</p>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function Info({ label, value, ltr = false }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs font-bold text-[#94839C]">{label}</span>
      <span className="text-sm font-black text-[#5C456B]" dir={ltr ? "ltr" : "auto"}>
        {value}
      </span>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#EADFF0] bg-[#FDFBFE] px-4 py-10 text-center text-sm text-[#8C7B94]">
      {text}
    </div>
  );
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("");
}

function maskEmail(value: string | null, fallback: string, notAdded: string) {
  if (!value) return notAdded;
  const [name, domain] = value.split("@");
  if (!name || !domain) return fallback;
  return `${name.slice(0, 2)}${"•".repeat(Math.max(3, name.length - 2))}@${domain}`;
}

function maskMobile(value: string) {
  const digits = value.replace(/\D/g, "");
  return `+${digits.slice(0, 3)} •• ••• •${digits.slice(-3)}`;
}

function platformLabel(value: string, copy: Copy) {
  return (copy.platforms as Record<string, string>)[value] ?? value;
}

function number(value: number, locale: AppLocale) {
  return new Intl.NumberFormat(locale === "ar" ? "ar-SA" : "en-US", {
    maximumFractionDigits: 0,
  }).format(value);
}

function replace(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`));
}
