import Link from "next/link";
import { cookies } from "next/headers";
import { requireInfluencerAccount } from "@/lib/influencer-portal/require-influencer-account";
import { normalizeAppLocale, type AppLocale } from "@/lib/i18n/app";
import { getAppDictionary } from "@/lib/i18n/app-dictionary";
import { markAllNotificationsRead } from "./actions";

export const dynamic = "force-dynamic";

export default async function InfluencerNotificationsPage() {
  const store = await cookies();
  const locale = normalizeAppLocale(
    store.get("app_locale")?.value ?? store.get("dashboard_locale")?.value,
  );
  const copy = getAppDictionary(locale).notifications;
  const { influencer, admin } = await requireInfluencerAccount();
  const { data: notifications, error } = await admin
    .from("influencer_notifications")
    .select("id,type,title,body,action_url,read_at,created_at")
    .eq("influencer_id", influencer.id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  const unread = (notifications ?? []).filter((row) => !row.read_at).length;

  return (
    <div className="space-y-5" data-no-auto-translate>
      <section className="rounded-[28px] bg-[linear-gradient(135deg,#5A6BC3,#96A2E5)] p-6 text-white shadow-[0_20px_58px_rgba(68,82,170,.18)]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black text-white/70">{copy.eyebrow}</p>
            <h1 className="mt-2 text-2xl font-black">{copy.title}</h1>
            <p className="mt-2 text-sm font-bold text-white/80">{copy.description}</p>
          </div>
          <span className="rounded-full bg-white/16 px-4 py-2 text-sm font-black ring-1 ring-white/20">
            {replace(copy.unread, { count: number(unread, locale) })}
          </span>
        </div>
      </section>

      {unread > 0 ? (
        <form action={markAllNotificationsRead}>
          <button className="rounded-xl border border-[#ECE1F1] bg-white px-5 py-3 text-sm font-black text-[#9362AD]">
            {copy.markAll}
          </button>
        </form>
      ) : null}

      <section className="space-y-3">
        {(notifications ?? []).map((notification) => (
          <article
            key={notification.id}
            className={`rounded-[22px] border p-5 shadow-[0_12px_36px_rgba(67,82,155,.06)] ${
              notification.read_at
                ? "border-[#F2ECF5] bg-white"
                : "border-[#BFC8EF] bg-[#FCF9FD]"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-black text-[#4F3762]">{notification.title}</h2>
                <p className="mt-2 text-sm font-bold leading-7 text-[#705E7B]">{notification.body}</p>
              </div>
              <span className="text-xs font-bold text-[#95849D]">
                {formatDate(notification.created_at, locale)}
              </span>
            </div>
            {notification.action_url ? (
              <Link
                href={notification.action_url}
                className="mt-4 inline-flex rounded-xl bg-[#F7F0FA] px-4 py-2 text-xs font-black text-[#9362AD]"
              >
                {copy.openRelated}
              </Link>
            ) : null}
          </article>
        ))}
        {(notifications ?? []).length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-[#E5D5EC] bg-white p-10 text-center text-sm font-black text-[#8D7B95]">
            {copy.empty}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function formatDate(value: string, locale: AppLocale) {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Riyadh",
  }).format(new Date(value));
}

function number(value: number, locale: AppLocale) {
  return new Intl.NumberFormat(locale === "ar" ? "ar-SA" : "en-US").format(value);
}

function replace(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`));
}
