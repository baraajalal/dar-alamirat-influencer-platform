import Link from "next/link";
import { cookies } from "next/headers";
import { requireInfluencerAccount } from "@/lib/influencer-portal/require-influencer-account";
import { normalizeAppLocale, type AppLocale } from "@/lib/i18n/app";
import { getAppDictionary, type AppDictionary } from "@/lib/i18n/app-dictionary";

type CampaignRow = { name: string; brand: string | null };
type AssignmentRow = {
  id: string;
  campaigns: CampaignRow | CampaignRow[] | null;
};
type Copy = AppDictionary["payments"];

export default async function InfluencerPaymentsPage() {
  const store = await cookies();
  const locale = normalizeAppLocale(
    store.get("app_locale")?.value ?? store.get("dashboard_locale")?.value,
  );
  const copy = getAppDictionary(locale).payments;
  const { admin, influencer } = await requireInfluencerAccount();

  const [{ data: assignments }, { data: financial }] = await Promise.all([
    admin
      .from("campaign_assignments")
      .select("id,campaigns(name,brand)")
      .eq("influencer_id", influencer.id),
    admin
      .from("influencer_financial_profiles")
      .select(
        "bank_name,iban,iban_last4,account_holder_name,bank_profile_status,influencer_confirmed_at,finance_reviewed_at,finance_review_notes",
      )
      .eq("influencer_id", influencer.id)
      .maybeSingle(),
  ]);

  const assignmentRows = (assignments ?? []) as AssignmentRow[];
  const assignmentIds = assignmentRows.map((row) => row.id);
  const campaignByAssignment = new Map<string, { name: string; brand: string | null }>();

  for (const assignment of assignmentRows) {
    const campaign = relation(assignment.campaigns);
    if (campaign) campaignByAssignment.set(assignment.id, campaign);
  }

  let payments: Array<{
    id: string;
    assignment_id: string;
    type: string;
    expected_amount: number | string | null;
    amount: number | string | null;
    paid_amount: number | string | null;
    status: string;
    due_at: string | null;
    paid_at: string | null;
    voucher_status: string | null;
    product_status: string | null;
  }> = [];

  if (assignmentIds.length > 0) {
    const { data } = await admin
      .from("payments")
      .select(
        "id,assignment_id,type,expected_amount,amount,paid_amount,status,due_at,paid_at,voucher_status,product_status",
      )
      .in("assignment_id", assignmentIds)
      .order("created_at", { ascending: false });
    payments = (data ?? []) as typeof payments;
  }

  const totalExpected = payments.reduce(
    (sum, row) => sum + Number(row.expected_amount ?? row.amount ?? 0),
    0,
  );
  const totalPaid = payments.reduce(
    (sum, row) => sum + Number(row.paid_amount ?? 0),
    0,
  );
  const totalRemaining = Math.max(0, totalExpected - totalPaid);

  return (
    <div className="space-y-5" data-no-auto-translate>
      <section className="rounded-[28px] bg-[linear-gradient(135deg,#9C68B9,#BE95D0)] p-6 text-white shadow-[0_20px_60px_rgba(70,90,175,0.20)]">
        <p className="text-sm font-black text-white/70">{copy.eyebrow}</p>
        <h1 className="mt-2 text-2xl font-black">{copy.title}</h1>
        <p className="mt-3 max-w-3xl text-sm font-semibold leading-7 text-white/78">
          {copy.description}
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <Metric label={copy.totalExpected} value={`${money(totalExpected, locale)} ${copy.currency}`} />
        <Metric label={copy.totalPaid} value={`${money(totalPaid, locale)} ${copy.currency}`} />
        <Metric label={copy.remaining} value={`${money(totalRemaining, locale)} ${copy.currency}`} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-[28px] border border-white bg-white/90 p-6 shadow-[0_16px_45px_rgba(68,82,140,0.08)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-[#9F6EB8]">{copy.financialProfile}</p>
              <h2 className="mt-1 text-xl font-black">{copy.maskedBank}</h2>
            </div>
            <StatusBadge status={financial?.bank_profile_status ?? "incomplete"} copy={copy} />
          </div>

          <div className="mt-5 space-y-4 rounded-2xl bg-[#FCF9FD] p-5">
            <Info label={copy.bankName} value={financial?.bank_name || copy.notAdded} />
            <Info label={copy.accountHolder} value={maskName(financial?.account_holder_name ?? null, copy.notAdded)} />
            <Info
              label={copy.iban}
              value={maskIban(financial?.iban ?? null, financial?.iban_last4 ?? null)}
              ltr
            />
            <Info
              label={copy.creatorConfirmation}
              value={financial?.influencer_confirmed_at ? copy.confirmed : copy.awaitingConfirmation}
            />
            <Info
              label={copy.financeReview}
              value={financial?.finance_reviewed_at ? copy.reviewed : copy.awaitingReview}
            />
          </div>

          {financial?.finance_review_notes ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-7 text-amber-800">
              {financial.finance_review_notes}
            </div>
          ) : null}

          <Link
            href="/portal/profile/payment-details"
            className="mt-5 flex h-13 items-center justify-center rounded-2xl bg-[#9A68B5] px-5 py-3 text-sm font-black text-white"
          >
            {copy.updateBank}
          </Link>
        </div>

        <div className="rounded-[28px] border border-white bg-white/90 p-6 shadow-[0_16px_45px_rgba(68,82,140,0.08)]">
          <p className="text-sm font-bold text-[#9F6EB8]">{copy.historyEyebrow}</p>
          <h2 className="mt-1 text-xl font-black">{copy.historyTitle}</h2>

          <div className="mt-5 space-y-3">
            {payments.length === 0 ? (
              <Empty text={copy.empty} />
            ) : (
              payments.map((payment) => {
                const campaign = campaignByAssignment.get(payment.assignment_id);
                const expected = Number(payment.expected_amount ?? payment.amount ?? 0);
                const paid = Number(payment.paid_amount ?? 0);
                return (
                  <article
                    key={payment.id}
                    className="rounded-2xl border border-[#F3EDF7] bg-[#FEFCFF] p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="font-black text-[#4A315C]">
                          {campaign?.name ?? copy.campaignFallback}
                        </p>
                        <p className="mt-1 text-xs font-bold text-[#8D7C94]">
                          {campaign?.brand ?? copy.brandFallback} · {typeLabel(payment.type, copy)}
                        </p>
                      </div>
                      <StatusBadge status={payment.status} copy={copy} />
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <Mini label={copy.expected} value={`${money(expected, locale)} ${copy.currency}`} />
                      <Mini label={copy.paid} value={`${money(paid, locale)} ${copy.currency}`} />
                      <Mini label={copy.remaining} value={`${money(Math.max(0, expected - paid), locale)} ${copy.currency}`} />
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function relation<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-white bg-white/90 p-5 shadow-[0_14px_40px_rgba(68,82,140,0.08)]">
      <p className="text-sm text-[#7D86A1]">{label}</p>
      <p className="mt-2 text-2xl font-black text-[#3D274F]">{value}</p>
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

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white p-3">
      <p className="text-[11px] font-bold text-[#929AB4]">{label}</p>
      <p className="mt-1 text-sm font-black text-[#5C456B]">{value}</p>
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

function StatusBadge({ status, copy }: { status: string; copy: Copy }) {
  const positive = ["approved", "paid"].includes(status);
  return (
    <span
      className={`rounded-full px-3 py-1.5 text-xs font-black ${
        positive ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"
      }`}
    >
      {(copy.statuses as Record<string, string>)[status] ?? status}
    </span>
  );
}

function maskIban(value: string | null, fallbackLast4: string | null) {
  const clean = String(value ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const last4 = clean.slice(-4) || fallbackLast4 || "••••";
  return `SA•• •••• •••• •••• ••${last4}`;
}

function maskName(value: string | null, fallback: string) {
  if (!value?.trim()) return fallback;
  return value
    .trim()
    .split(/\s+/)
    .map((part) => `${part.charAt(0)}${"•".repeat(Math.min(5, Math.max(1, part.length - 1)))}`)
    .join(" ");
}

function money(value: number, locale: AppLocale) {
  return new Intl.NumberFormat(locale === "ar" ? "ar-SA" : "en-US", {
    maximumFractionDigits: 0,
  }).format(value);
}

function typeLabel(value: string, copy: Copy) {
  return (copy.types as Record<string, string>)[value] ?? value;
}
