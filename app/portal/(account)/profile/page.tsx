import Link from "next/link";
import { requireInfluencerAccount } from "@/lib/influencer-portal/require-influencer-account";

type SocialAccountRow = {
  id: string;
  platform: string;
  username: string;
  profile_url: string | null;
  followers_count: number | string | null;
  last_checked_at: string | null;
};

export default async function InfluencerProfilePage() {
  const { admin, influencer } = await requireInfluencerAccount();
  const { data: socialAccounts } = await admin
    .from("social_accounts")
    .select("id,platform,username,profile_url,followers_count,last_checked_at")
    .eq("influencer_id", influencer.id)
    .order("followers_count", { ascending: false });

  const accounts = (socialAccounts ?? []) as SocialAccountRow[];

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] bg-[linear-gradient(135deg,#5F73D5,#8290E2)] p-6 text-white shadow-[0_20px_60px_rgba(70,90,175,0.20)]">
        <p className="text-sm font-black text-white/70">ملفي</p>
        <h1 className="mt-2 text-2xl font-black">البيانات والحسابات المرتبطة</h1>
        <p className="mt-3 max-w-3xl text-sm font-semibold leading-7 text-white/78">
          راجعي بياناتك الأساسية وحسابات التواصل، وانتقلي إلى الملف المالي لتأكيد
          البنك والآيبان أو إرسال تحديث للمالية.
        </p>
      </section>

      <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[28px] border border-white bg-white/90 p-6 shadow-[0_16px_45px_rgba(68,82,140,0.08)]">
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-[26px] bg-[#EEF1FF] text-2xl font-black text-[#6072CB]">
              {initials(influencer.full_name)}
            </div>
            <div>
              <p className="text-xl font-black text-[#344578]">{influencer.full_name}</p>
              <p className="mt-1 text-sm font-bold text-[#8991AA]">
                حساب مؤثر مفعل
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-4 rounded-2xl bg-[#F8F9FF] p-5">
            <Info label="البريد" value={maskEmail(influencer.email)} ltr />
            <Info label="الجوال" value={maskMobile(influencer.mobile_e164)} ltr />
            <Info label="المدينة" value={influencer.city || "غير مضافة"} />
            <Info label="الدولة" value={influencer.country || "Saudi Arabia"} />
            <Info label="اكتمال الملف" value={`${influencer.profile_completion ?? 0}%`} />
          </div>

          <Link
            href="/portal/profile/payment-details"
            className="mt-5 flex h-13 items-center justify-center rounded-2xl bg-[#6072CB] px-5 py-3 text-sm font-black text-white"
          >
            فتح بيانات البنك الآمنة
          </Link>
        </div>

        <div className="rounded-[28px] border border-white bg-white/90 p-6 shadow-[0_16px_45px_rgba(68,82,140,0.08)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-[#6676C9]">حسابات التواصل</p>
              <h2 className="mt-1 text-xl font-black">الحسابات المرتبطة بالملف</h2>
            </div>
            <span className="rounded-full bg-[#EEF1FF] px-3 py-1.5 text-xs font-black text-[#596BC4]">
              {accounts.length} حساب
            </span>
          </div>

          <div className="mt-5 space-y-3">
            {accounts.length === 0 ? (
              <Empty text="لا توجد حسابات تواصل مرتبطة بالملف." />
            ) : (
              accounts.map((account) => (
                <article
                  key={account.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#E7EAF7] bg-[#FBFCFF] p-4"
                >
                  <div>
                    <p className="font-black text-[#344578]">
                      {platformLabel(account.platform)}
                    </p>
                    <p className="mt-1 text-xs font-bold text-[#8991AA]">
                      @{account.username}
                    </p>
                  </div>
                  <div className="text-left">
                    <p className="font-black text-[#465681]">
                      {number(Number(account.followers_count ?? 0))}
                    </p>
                    <p className="mt-1 text-[11px] font-bold text-[#9AA2B9]">متابع</p>
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

function Info({
  label,
  value,
  ltr = false,
}: {
  label: string;
  value: string;
  ltr?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs font-bold text-[#9199B3]">{label}</span>
      <span className="text-sm font-black text-[#465681]" dir={ltr ? "ltr" : "rtl"}>
        {value}
      </span>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#DCE1F4] bg-[#FAFBFF] px-4 py-10 text-center text-sm text-[#8790AA]">
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

function maskEmail(value: string | null) {
  if (!value) return "غير مضاف";
  const [name, domain] = value.split("@");
  if (!name || !domain) return "بريد مسجل";
  return `${name.slice(0, 2)}${"•".repeat(Math.max(3, name.length - 2))}@${domain}`;
}

function maskMobile(value: string) {
  const digits = value.replace(/\D/g, "");
  return `+${digits.slice(0, 3)} •• ••• •${digits.slice(-3)}`;
}

function platformLabel(value: string) {
  const labels: Record<string, string> = {
    instagram: "إنستغرام",
    tiktok: "تيك توك",
    snapchat: "سناب شات",
    youtube: "يوتيوب",
    x: "X",
    facebook: "فيسبوك",
    other: "أخرى",
  };
  return labels[value] ?? value;
}

function number(value: number) {
  return new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 0 }).format(value);
}
