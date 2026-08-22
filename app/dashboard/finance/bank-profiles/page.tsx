import Link from "next/link";
import { requireRole } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { reviewBankUpdateRequest, reviewCurrentBankProfile } from "./actions";

export const dynamic = "force-dynamic";

type Influencer = { id: string; full_name: string; mobile_e164: string };

function dateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Riyadh" }).format(new Date(value));
}

export default async function BankProfilesPage({ searchParams }: { searchParams?: Promise<{ success?: string; error?: string }> }) {
  const params = (await searchParams) ?? {};
  await requireRole(["admin", "finance"]);
  const admin = createAdminClient();

  const [{ data: profiles }, { data: requests }] = await Promise.all([
    admin.from("influencer_financial_profiles").select("influencer_id,bank_name,iban,account_holder_name,national_id,identity_type,identity_number,bank_profile_status,influencer_confirmed_at,iban_certificate_path,finance_review_notes,updated_at").eq("bank_profile_status", "pending_review").order("updated_at", { ascending: false }),
    admin.from("influencer_bank_update_requests").select("id,influencer_id,bank_name,iban,account_holder_name,national_id,certificate_path,submitted_at,status").eq("status", "pending").order("submitted_at", { ascending: false }),
  ]);

  const influencerIds = [...new Set([...(profiles ?? []).map((row) => row.influencer_id), ...(requests ?? []).map((row) => row.influencer_id)])];
  const { data: influencerRows } = influencerIds.length
    ? await admin.from("influencers").select("id,full_name,mobile_e164").in("id", influencerIds)
    : { data: [] };
  const influencerMap = new Map(((influencerRows ?? []) as Influencer[]).map((row) => [row.id, row]));

  const errorMessages: Record<string, string> = {
    notes_required: "اكتبي سبب الإرجاع أو الرفض.",
    bank_incomplete: "اسم البنك واسم صاحب الحساب والآيبان السعودي الصحيح مطلوبة.",
    influencer_confirmation_required: "يجب أن يؤكد المؤثر بياناته أولًا.",
  };

  return (
    <div dir="inherit" className="space-y-6">
      <section className="rounded-[30px] bg-[linear-gradient(135deg,#9566AF,#C5A2D5)] p-7 text-white shadow-[0_24px_64px_rgba(70,86,180,.22)]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-black text-white/70">الاعتمادات المالية</p>
            <h1 className="mt-2 text-3xl font-black">ملفات المؤثرين البنكية</h1>
            <p className="mt-3 text-sm font-bold leading-7 text-white/82">اعتماد الآيبان والهوية أو الإقامة أو السجل التجاري وإرجاع الملاحظات مباشرة لإشعارات المؤثر.</p>
          </div>
          <Link href="/dashboard/finance/approvals" className="rounded-2xl bg-white/16 px-5 py-3 text-sm font-black ring-1 ring-white/20">العودة للاعتمادات</Link>
        </div>
      </section>

      {params.error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-black text-rose-700">{errorMessages[params.error] ?? "تعذر تنفيذ العملية."}</div> : null}
      {params.success ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-black text-emerald-700">تم حفظ قرار المراجعة.</div> : null}

      <section className="rounded-[28px] border border-[#F0E7F4] bg-white p-6 shadow-[0_16px_48px_rgba(67,82,155,.07)]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black text-[#8D7B95]">البيانات الحالية</p>
            <h2 className="mt-1 text-xl font-black text-[#4F3762]">ملفات تحتاج مراجعة</h2>
          </div>
          <span className="rounded-full bg-[#F7F0FA] px-4 py-2 text-sm font-black text-[#9362AD]">{profiles?.length ?? 0}</span>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {(profiles ?? []).map((profile) => {
            const influencer = influencerMap.get(profile.influencer_id);
            return (
              <article key={profile.influencer_id} className="rounded-2xl border border-[#F1EAF5] bg-[#FDFBFE] p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-black text-[#513865]">{influencer?.full_name ?? "مؤثر"}</h3>
                    <p className="mt-1 text-xs font-bold text-[#8D7B95]" dir="ltr">{influencer?.mobile_e164 ?? "—"}</p>
                  </div>
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">{profile.bank_profile_status}</span>
                </div>
                <div className="mt-4 grid gap-2 text-sm font-bold text-[#56628C] sm:grid-cols-2">
                  <p>البنك: {profile.bank_name ?? "—"}</p>
                  <p>صاحب الحساب: {profile.account_holder_name ?? "—"}</p>
                  <p dir="ltr">IBAN: {profile.iban ?? "—"}</p>
                  <p>الوثيقة: {profile.identity_number ?? profile.national_id ?? "غير متوفرة"}</p>
                  <p>نوع الوثيقة: {profile.identity_type ?? "يحدد تلقائيًا"}</p>
                  <p>تأكيد المؤثر: {dateTime(profile.influencer_confirmed_at)}</p>
                </div>
                {profile.finance_review_notes ? <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-800">{profile.finance_review_notes}</p> : null}
                <form action={reviewCurrentBankProfile} className="mt-4 space-y-3">
                  <input type="hidden" name="influencer_id" value={profile.influencer_id} />
                  <textarea name="notes" rows={2} placeholder="ملاحظة الإرجاع أو الرفض" className="w-full rounded-xl border border-[#ECE1F1] bg-white p-3 text-sm font-bold outline-none" />
                  <div className="grid gap-2 sm:grid-cols-3">
                    <button name="decision" value="approve" className="rounded-xl bg-emerald-600 px-3 py-3 text-sm font-black text-white">اعتماد</button>
                    <button name="decision" value="return" className="rounded-xl bg-amber-500 px-3 py-3 text-sm font-black text-white">إرجاع</button>
                    <button name="decision" value="reject" className="rounded-xl bg-rose-600 px-3 py-3 text-sm font-black text-white">رفض</button>
                  </div>
                </form>
              </article>
            );
          })}
          {(profiles ?? []).length === 0 ? <Empty text="لا توجد ملفات حالية بانتظار المراجعة." /> : null}
        </div>
      </section>

      <section className="rounded-[28px] border border-[#F0E7F4] bg-white p-6 shadow-[0_16px_48px_rgba(67,82,155,.07)]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black text-[#8D7B95]">التحديثات</p>
            <h2 className="mt-1 text-xl font-black text-[#4F3762]">طلبات تعديل البيانات البنكية</h2>
          </div>
          <span className="rounded-full bg-amber-50 px-4 py-2 text-sm font-black text-amber-700">{requests?.length ?? 0}</span>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {(requests ?? []).map((request) => {
            const influencer = influencerMap.get(request.influencer_id);
            return (
              <article key={request.id} className="rounded-2xl border border-amber-200 bg-amber-50/35 p-5">
                <h3 className="font-black text-[#513865]">{influencer?.full_name ?? "مؤثر"}</h3>
                <p className="mt-1 text-xs font-bold text-[#8D7B95]">أُرسل: {dateTime(request.submitted_at)}</p>
                <div className="mt-4 grid gap-2 text-sm font-bold text-[#56628C] sm:grid-cols-2">
                  <p>البنك: {request.bank_name}</p>
                  <p>صاحب الحساب: {request.account_holder_name}</p>
                  <p dir="ltr">IBAN: {request.iban}</p>
                  <p>الهوية/الإقامة/السجل: {request.national_id ?? "غير متوفر"}</p>
                </div>
                <form action={reviewBankUpdateRequest} className="mt-4 space-y-3">
                  <input type="hidden" name="request_id" value={request.id} />
                  <textarea name="notes" rows={2} placeholder="سبب الرفض" className="w-full rounded-xl border border-amber-200 bg-white p-3 text-sm font-bold outline-none" />
                  <div className="grid grid-cols-2 gap-2">
                    <button name="decision" value="approve" className="rounded-xl bg-emerald-600 px-3 py-3 text-sm font-black text-white">اعتماد التحديث</button>
                    <button name="decision" value="reject" className="rounded-xl bg-rose-600 px-3 py-3 text-sm font-black text-white">رفض وإرجاع</button>
                  </div>
                </form>
              </article>
            );
          })}
          {(requests ?? []).length === 0 ? <Empty text="لا توجد طلبات تحديث حالية." /> : null}
        </div>
      </section>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-[#E5D5EC] bg-[#FDFBFE] p-8 text-center text-sm font-black text-[#8D7B95] xl:col-span-2">{text}</div>;
}
