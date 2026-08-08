import Link from "next/link";
import { requireRole } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { reviewAdvertisementPayment } from "./actions";

export const dynamic = "force-dynamic";

type Payment = {
  id: string;
  assignment_id: string;
  expected_amount: number | string | null;
  amount: number | string | null;
  finance_review_status: string;
  finance_review_notes: string | null;
  status: string;
  created_at: string;
};

type Assignment = {
  id: string;
  influencer_id: string;
  campaign_id: string;
  payment_timing: string | null;
  has_contract: boolean | null;
  requires_content: boolean | null;
};

type Campaign = { id: string; name: string; brand: string | null };
type Influencer = { id: string; full_name: string; mobile_e164: string };
type BankProfile = { influencer_id: string; bank_profile_status: string; bank_name: string | null; iban_last4: string | null; identity_number: string | null; national_id: string | null };
type Platform = { id: string; assignment_id: string };
type ContentItem = { id: string; assignment_platform_id: string; status: string; post_url: string | null; publication_verified_at: string | null };

function amount(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number) {
  return new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR", maximumFractionDigits: 2 }).format(value);
}

function badge(ok: boolean, yes: string, no: string) {
  return (
    <span className={`rounded-full px-3 py-1.5 text-xs font-black ${ok ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
      {ok ? yes : no}
    </span>
  );
}

export default async function AdvertisementPaymentApprovalsPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string; success?: string; error?: string }>;
}) {
  const params = (await searchParams) ?? {};
  await requireRole(["admin", "finance"]);
  const admin = createAdminClient();

  let paymentQuery = admin
    .from("payments")
    .select("id,assignment_id,expected_amount,amount,finance_review_status,finance_review_notes,status,created_at")
    .eq("type", "bank_transfer")
    .order("created_at", { ascending: false })
    .limit(500);
  if (params.status) paymentQuery = paymentQuery.eq("finance_review_status", params.status);
  const { data: paymentRows, error } = await paymentQuery;
  if (error) throw new Error(error.message);
  const payments = (paymentRows ?? []) as Payment[];

  const assignmentIds = [...new Set(payments.map((row) => row.assignment_id))];
  const { data: assignmentRows } = assignmentIds.length
    ? await admin.from("campaign_assignments").select("id,influencer_id,campaign_id,payment_timing,has_contract,requires_content").in("id", assignmentIds)
    : { data: [] };
  const assignments = (assignmentRows ?? []) as Assignment[];
  const assignmentMap = new Map(assignments.map((row) => [row.id, row]));

  const campaignIds = [...new Set(assignments.map((row) => row.campaign_id))];
  const influencerIds = [...new Set(assignments.map((row) => row.influencer_id))];
  const [{ data: campaignRows }, { data: influencerRows }, { data: profileRows }, { data: platformRows }] = await Promise.all([
    campaignIds.length ? admin.from("campaigns").select("id,name,brand").in("id", campaignIds) : Promise.resolve({ data: [] }),
    influencerIds.length ? admin.from("influencers").select("id,full_name,mobile_e164").in("id", influencerIds) : Promise.resolve({ data: [] }),
    influencerIds.length ? admin.from("influencer_financial_profiles").select("influencer_id,bank_profile_status,bank_name,iban_last4,identity_number,national_id").in("influencer_id", influencerIds) : Promise.resolve({ data: [] }),
    assignmentIds.length ? admin.from("assignment_platforms").select("id,assignment_id").in("assignment_id", assignmentIds) : Promise.resolve({ data: [] }),
  ]);

  const campaigns = (campaignRows ?? []) as Campaign[];
  const influencers = (influencerRows ?? []) as Influencer[];
  const profiles = (profileRows ?? []) as BankProfile[];
  const platforms = (platformRows ?? []) as Platform[];
  const campaignMap = new Map(campaigns.map((row) => [row.id, row]));
  const influencerMap = new Map(influencers.map((row) => [row.id, row]));
  const profileMap = new Map(profiles.map((row) => [row.influencer_id, row]));
  const platformIds = platforms.map((row) => row.id);
  const platformAssignmentMap = new Map(platforms.map((row) => [row.id, row.assignment_id]));
  const { data: contentRows } = platformIds.length
    ? await admin.from("content_items").select("id,assignment_platform_id,status,post_url,publication_verified_at").in("assignment_platform_id", platformIds)
    : { data: [] };
  const contents = (contentRows ?? []) as ContentItem[];

  const contentByAssignment = new Map<string, ContentItem[]>();
  for (const item of contents) {
    const assignmentId = platformAssignmentMap.get(item.assignment_platform_id);
    if (!assignmentId) continue;
    contentByAssignment.set(assignmentId, [...(contentByAssignment.get(assignmentId) ?? []), item]);
  }

  const errorMessages: Record<string, string> = {
    notes_required: "الملاحظة إلزامية عند الإرجاع أو الرفض.",
    bank_profile_required: "بيانات البنك غير مكتملة أو غير معتمدة.",
    contract_required: "الدفع المسبق يحتاج عقدًا معتمدًا وتأكيد مربع العقد.",
    publication_required: "يجب اعتماد رابط نشر جميع عناصر المحتوى قبل اعتماد المستحق.",
    review_confirmation_required: "فعّلي مربع تأكيد مراجعة المستحق قبل الاعتماد.",
  };

  return (
    <div dir="rtl" className="space-y-6">
      <section className="rounded-[30px] bg-[linear-gradient(135deg,#5368C3,#91A0E5)] p-7 text-white shadow-[0_24px_64px_rgba(70,86,180,.22)]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-black text-white/70">الاعتمادات المالية</p>
            <h1 className="mt-2 text-3xl font-black">اعتماد مستحقات الإعلانات</h1>
            <p className="mt-3 text-sm font-bold leading-7 text-white/82">يظهر رابط النشر المعتمد، أو حالة عقد الدفع المسبق، مع المبلغ والملف البنكي.</p>
          </div>
          <Link href="/dashboard/finance/approvals" className="rounded-2xl bg-white/16 px-5 py-3 text-sm font-black ring-1 ring-white/20">العودة للاعتمادات</Link>
        </div>
      </section>

      {params.error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-black text-rose-700">{errorMessages[params.error] ?? "تعذر تنفيذ العملية."}</div> : null}
      {params.success ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-black text-emerald-700">تم حفظ قرار المراجعة بنجاح.</div> : null}

      <form className="flex flex-wrap gap-3 rounded-[24px] border border-[#E2E6F4] bg-white p-4 shadow-[0_12px_36px_rgba(67,82,155,.06)]">
        <select name="status" defaultValue={params.status ?? ""} className="rounded-xl border border-[#DDE2F2] bg-white px-4 py-3 text-sm font-bold text-[#4A5A87]">
          <option value="">كل الحالات</option>
          <option value="pending">بانتظار المراجعة</option>
          <option value="approved">معتمد</option>
          <option value="returned">معاد للتعديل</option>
          <option value="rejected">مرفوض</option>
        </select>
        <button className="rounded-xl bg-[#596BC4] px-5 py-3 text-sm font-black text-white">تطبيق</button>
      </form>

      <section className="space-y-4">
        {payments.map((payment) => {
          const assignment = assignmentMap.get(payment.assignment_id);
          const campaign = assignment ? campaignMap.get(assignment.campaign_id) : undefined;
          const influencer = assignment ? influencerMap.get(assignment.influencer_id) : undefined;
          const profile = assignment ? profileMap.get(assignment.influencer_id) : undefined;
          const items = contentByAssignment.get(payment.assignment_id) ?? [];
          const publicationReady = assignment?.requires_content === false || (items.length > 0 && items.every((item) => item.status === "published" && Boolean(item.post_url) && Boolean(item.publication_verified_at)));
          const prepaid = assignment?.payment_timing === "before_publish";
          const contractReady = prepaid && Boolean(assignment?.has_contract);
          const bankReady = profile?.bank_profile_status === "approved";
          const firstUrl = items.find((item) => item.post_url)?.post_url ?? null;

          return (
            <article key={payment.id} className="rounded-[28px] border border-[#E1E6F5] bg-white p-6 shadow-[0_16px_48px_rgba(67,82,155,.07)]">
              <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
                <div>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-black text-[#8A93AE]">{campaign?.brand ?? "دار الأميرات"}</p>
                      <h2 className="mt-1 text-xl font-black text-[#3D4D7D]">{influencer?.full_name ?? "مؤثر"}</h2>
                      <p className="mt-1 text-xs font-bold text-[#8A93AE]" dir="ltr">{influencer?.mobile_e164 ?? "—"}</p>
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-black text-[#8A93AE]">المبلغ المستحق</p>
                      <p className="mt-1 text-2xl font-black text-[#344578]">{money(amount(payment.expected_amount) || amount(payment.amount))}</p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Info label="الحملة" value={campaign?.name ?? "—"} />
                    <Info label="توقيت الدفع" value={prepaid ? "دفع مسبق" : "بعد النشر"} />
                    <Info label="حالة البنك" value={profile?.bank_profile_status ?? "غير مكتمل"} />
                    <Info label="آخر 4 من الآيبان" value={profile?.iban_last4 ? `•••• ${profile.iban_last4}` : "—"} />
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {badge(publicationReady, "النشر معتمد", "النشر غير مكتمل")}
                    {badge(!prepaid || contractReady, prepaid ? "العقد موجود" : "العقد غير مطلوب", "العقد غير مكتمل")}
                    {badge(bankReady, "ملف البنك معتمد", "ملف البنك غير معتمد")}
                  </div>

                  {firstUrl ? <a href={firstUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex rounded-xl bg-[#EEF1FF] px-4 py-2 text-xs font-black text-[#596BC4]">فتح رابط الإعلان والنشر</a> : <p className="mt-4 text-xs font-black text-amber-700">لا يوجد رابط نشر ظاهر حتى الآن.</p>}
                  {payment.finance_review_notes ? <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-800">آخر ملاحظة: {payment.finance_review_notes}</p> : null}
                </div>

                <form action={reviewAdvertisementPayment} className="rounded-2xl border border-[#E3E7F5] bg-[#FAFBFF] p-4">
                  <input type="hidden" name="payment_id" value={payment.id} />
                  <p className="text-sm font-black text-[#405080]">قرار المراجع المالي</p>
                  <label className="mt-4 flex items-center gap-3 rounded-xl border border-[#DDE2F2] bg-white p-3 text-sm font-black text-[#53618C]">
                    <input type="checkbox" name="review_confirmed" className="h-4 w-4" />
                    تمت مراجعة المبلغ والتعاقد ورابط الإعلان وبيانات البنك
                  </label>
                  {prepaid ? (
                    <label className="mt-4 flex items-center gap-3 rounded-xl border border-[#DDE2F2] bg-white p-3 text-sm font-black text-[#53618C]">
                      <input type="checkbox" name="contract_approved" className="h-4 w-4" />
                      راجعت العقد وأوافق على الدفع المسبق
                    </label>
                  ) : null}
                  <textarea name="notes" rows={3} placeholder="الملاحظة إلزامية عند الإرجاع أو الرفض" className="mt-3 w-full rounded-xl border border-[#DDE2F2] bg-white p-3 text-sm font-bold text-[#465681] outline-none" />
                  <div className="mt-3 grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
                    <button name="decision" value="approve" className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white">اعتماد وجاهز للتجميع</button>
                    <button name="decision" value="return" className="rounded-xl bg-amber-500 px-4 py-3 text-sm font-black text-white">إرجاع بملاحظة</button>
                    <button name="decision" value="reject" className="rounded-xl bg-rose-600 px-4 py-3 text-sm font-black text-white">رفض</button>
                  </div>
                </form>
              </div>
            </article>
          );
        })}
        {payments.length === 0 ? <div className="rounded-[26px] border border-dashed border-[#CDD4EE] bg-white p-10 text-center text-sm font-black text-[#8A93AE]">لا توجد مستحقات مطابقة.</div> : null}
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#F6F7FC] p-3">
      <p className="text-[11px] font-black text-[#929AB1]">{label}</p>
      <p className="mt-1 truncate text-sm font-black text-[#4B5B87]">{value}</p>
    </div>
  );
}
