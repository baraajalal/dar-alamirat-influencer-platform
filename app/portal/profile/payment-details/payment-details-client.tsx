"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";

type ProfilePayload = {
  influencer: { id: string; fullName: string };
  assignmentId: string;
  profile: {
    status: string;
    hasDetails: boolean;
    bankName: string;
    accountHolderMasked: string;
    ibanMasked: string;
    identityType: string | null;
    identityMasked: string;
    certificateUploaded: boolean;
    confirmedAt: string | null;
    reviewedAt: string | null;
    reviewNotes: string | null;
  };
  pendingRequest: {
    id: string;
    bankName: string;
    accountHolderMasked: string;
    ibanMasked: string;
    identityType: string | null;
    identityMasked: string;
    status: string;
    submittedAt: string;
    reviewNotes: string | null;
  } | null;
};

const statusLabels: Record<string, string> = {
  incomplete: "البيانات غير مكتملة",
  needs_confirmation: "بانتظار تأكيدك",
  pending_review: "بانتظار مراجعة المالية",
  approved: "معتمدة",
  update_pending: "تحديث بانتظار المراجعة",
  rejected: "مطلوب تحديث",
};

export default function PaymentDetailsClient({ assignmentId }: { assignmentId: string }) {
  const [payload, setPayload] = useState<ProfilePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showUpdate, setShowUpdate] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = assignmentId ? `?assignment=${encodeURIComponent(assignmentId)}` : "";
      const response = await fetch(`/api/influencer/payment-profile${query}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "تعذر تحميل بيانات الدفع.");
      setPayload(result);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "تعذر تحميل بيانات الدفع.");
    } finally {
      setLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function confirmCurrent() {
    setSubmitting(true);
    setMessage("");
    setError("");
    try {
      const formData = new FormData();
      formData.set("action", "confirm");
      const query = assignmentId ? `?assignment=${encodeURIComponent(assignmentId)}` : "";
      const response = await fetch(`/api/influencer/payment-profile${query}`, {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "تعذر تأكيد البيانات.");
      setMessage(result.message);
      await load();
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : "تعذر تأكيد البيانات.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    setError("");

    try {
      const form = event.currentTarget;
      const formData = new FormData(form);
      formData.set("action", "update");
      const query = assignmentId ? `?assignment=${encodeURIComponent(assignmentId)}` : "";
      const response = await fetch(`/api/influencer/payment-profile${query}`, {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "تعذر إرسال التحديث.");
      setMessage(result.message);
      setShowUpdate(false);
      form.reset();
      await load();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "تعذر إرسال التحديث.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-[radial-gradient(circle_at_8%_10%,rgba(216,221,247,0.82),transparent_30%),linear-gradient(135deg,#FDFDFF,#F2F4FC)] px-4 py-8 font-['Tajawal',Tahoma,Arial,sans-serif] text-[#33447F]"
    >
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex items-center justify-between rounded-[24px] border border-white/90 bg-white/82 px-5 py-4 shadow-[0_18px_55px_rgba(67,82,155,0.11)] backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <img src="/da-logo.png" alt="دار الأميرات" className="h-14 w-14 rounded-2xl object-contain" />
            <div>
              <p className="text-xs font-black text-[#8992AF]">حساب المؤثر</p>
              <h1 className="text-lg font-black text-[#33447F]">بيانات الدفع البنكية</h1>
            </div>
          </div>
          <Link href="/portal-access" className="text-sm font-black text-[#6877C8]">بوابة المؤثر</Link>
        </header>

        {loading ? (
          <div className="rounded-[28px] bg-white/85 p-12 text-center font-black text-[#6877C8] shadow-xl">جاري تحميل البيانات...</div>
        ) : null}

        {error ? (
          <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-bold leading-7 text-rose-700">{error}</div>
        ) : null}
        {message ? (
          <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-bold leading-7 text-emerald-700">{message}</div>
        ) : null}

        {!loading && payload ? (
          <div className="grid gap-6 lg:grid-cols-[1fr_0.85fr]">
            <section className="rounded-[30px] border border-[#DDE2F3] bg-white/92 p-6 shadow-[0_20px_60px_rgba(67,82,155,0.10)] sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-black text-[#6877C8]">{payload.influencer.fullName}</p>
                  <h2 className="mt-1 text-2xl font-black">تأكدي من بياناتك</h2>
                  <p className="mt-2 text-sm font-semibold leading-7 text-[#7D86A7]">تظهر البيانات بشكل مقنّع. لا يتم عرض رقم الآيبان أو الهوية كاملين داخل الصفحة.</p>
                </div>
                <StatusBadge status={payload.profile.status} />
              </div>

              <div className="mt-6 space-y-3 rounded-2xl bg-[#F8F9FF] p-5">
                <MaskedRow label="اسم البنك" value={payload.profile.bankName} />
                <MaskedRow label="صاحب الحساب" value={payload.profile.accountHolderMasked} />
                <MaskedRow label="رقم الآيبان" value={payload.profile.ibanMasked} />
                <MaskedRow label="الهوية / الإقامة / السجل" value={payload.profile.identityMasked} />
                <MaskedRow label="شهادة الآيبان" value={payload.profile.certificateUploaded ? "مرفوعة" : "غير مرفوعة"} />
              </div>

              {payload.profile.reviewNotes ? (
                <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold leading-7 text-rose-700">
                  ملاحظة المالية: {payload.profile.reviewNotes}
                </div>
              ) : null}

              {payload.pendingRequest ? (
                <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <p className="font-black text-amber-900">يوجد تحديث قيد المراجعة</p>
                  <p className="mt-2 text-sm font-semibold text-amber-800">{payload.pendingRequest.bankName} · {payload.pendingRequest.ibanMasked}</p>
                </div>
              ) : null}

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={confirmCurrent}
                  disabled={submitting || !payload.profile.hasDetails || Boolean(payload.pendingRequest)}
                  className="h-14 rounded-2xl bg-[linear-gradient(135deg,#6575CB,#4F60B6)] px-5 text-sm font-black text-white shadow-[0_16px_32px_rgba(79,96,182,0.25)] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  البيانات صحيحة
                </button>
                <button
                  type="button"
                  onClick={() => setShowUpdate((value) => !value)}
                  disabled={Boolean(payload.pendingRequest)}
                  className="h-14 rounded-2xl border border-[#BBC4EA] bg-[#F8F9FF] px-5 text-sm font-black text-[#596BC4] disabled:opacity-45"
                >
                  تحديث بيانات البنك
                </button>
              </div>
            </section>

            <aside className="space-y-5">
              <section className="rounded-[28px] bg-[linear-gradient(145deg,#7180D2,#5364B8)] p-6 text-white shadow-[0_22px_60px_rgba(74,88,162,0.23)]">
                <h3 className="text-xl font-black">جاهزية التحويل</h3>
                <div className="mt-5 space-y-3">
                  <Step done={Boolean(payload.profile.confirmedAt)} label="تأكيد المؤثر للبيانات" />
                  <Step done={payload.profile.status === "approved"} label="اعتماد المالية" />
                  <Step done={payload.profile.status === "approved"} label="جاهز لإكمال اعتماد الدفع" />
                </div>
              </section>

              <section className="rounded-[24px] border border-[#E2E6F4] bg-white/90 p-5 text-sm font-semibold leading-7 text-[#727C9F] shadow-[0_14px_42px_rgba(67,82,155,0.07)]">
                البيانات الكاملة لا تظهر للمنسق أو المراجع. المالية والإدارة فقط تستطيعان مراجعة التفاصيل اللازمة للتحويل.
              </section>
            </aside>
          </div>
        ) : null}

        {showUpdate && !payload?.pendingRequest ? (
          <section className="mt-6 rounded-[30px] border border-[#DDE2F3] bg-white/94 p-6 shadow-[0_20px_60px_rgba(67,82,155,0.10)] sm:p-7">
            <h2 className="text-xl font-black">إرسال بيانات بنك جديدة</h2>
            <p className="mt-2 text-sm font-semibold leading-7 text-[#7D86A7]">لن تستبدل البيانات الحالية حتى تعتمد المالية الطلب الجديد.</p>

            <form onSubmit={submitUpdate} className="mt-6 grid gap-4 sm:grid-cols-2">
              <Field name="bankName" label="اسم البنك" required />
              <Field name="accountHolderName" label="اسم صاحب الحساب" required />
              <Field name="iban" label="رقم الآيبان" placeholder="SA00 0000 0000 0000 0000 0000" required />
              <Field name="ibanConfirmation" label="تأكيد رقم الآيبان" required />
              <label className="block">
                <span className="mb-2 block text-sm font-black text-[#4D5A86]">نوع الوثيقة</span>
                <select name="identityType" className="h-14 w-full rounded-2xl border border-[#D8DDF7] bg-[#FAFBFF] px-4 text-sm font-bold outline-none focus:border-[#6877C8]">
                  <option value="">يحدد تلقائيًا من الرقم</option>
                  <option value="national_id">هوية وطنية</option>
                  <option value="residency">إقامة</option>
                  <option value="commercial_registration">سجل تجاري / رقم منشأة</option>
                </select>
              </label>
              <Field name="identityNumber" label="رقم الهوية أو الإقامة أو السجل" inputMode="numeric" />
              <label className="block">
                <span className="mb-2 block text-sm font-black text-[#4D5A86]">شهادة الآيبان</span>
                <input name="certificate" type="file" accept="image/*,application/pdf" className="w-full rounded-2xl border border-[#D8DDF7] bg-[#FAFBFF] p-3 text-xs font-bold" />
              </label>
              <div className="sm:col-span-2 flex flex-wrap gap-3 pt-2">
                <button type="submit" disabled={submitting} className="rounded-2xl bg-[#6877C8] px-6 py-3 text-sm font-black text-white disabled:opacity-50">
                  {submitting ? "جاري الإرسال..." : "إرسال للمراجعة"}
                </button>
                <button type="button" onClick={() => setShowUpdate(false)} className="rounded-2xl border border-[#D8DDF7] px-6 py-3 text-sm font-black text-[#6877C8]">إلغاء</button>
              </div>
            </form>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function MaskedRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[#E7EAF5] pb-3 last:border-0 last:pb-0">
      <span className="text-xs font-bold text-[#9098B0]">{label}</span>
      <span className="text-left text-sm font-black text-[#4D5A86]" dir="ltr">{value}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const approved = status === "approved";
  return (
    <span className={`rounded-full px-3 py-1.5 text-xs font-black ${approved ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>
      {statusLabels[status] ?? status}
    </span>
  );
}

function Step({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 p-3">
      <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black ${done ? "bg-emerald-300 text-emerald-950" : "bg-white/15 text-white"}`}>{done ? "✓" : "•"}</span>
      <span className="text-sm font-bold">{label}</span>
    </div>
  );
}

function Field({
  name,
  label,
  placeholder,
  required,
  inputMode,
}: {
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  inputMode?: "numeric" | "text";
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-black text-[#4D5A86]">{label}</span>
      <input
        name={name}
        required={required}
        placeholder={placeholder}
        inputMode={inputMode}
        className="h-14 w-full rounded-2xl border border-[#D8DDF7] bg-[#FAFBFF] px-4 text-sm font-bold outline-none focus:border-[#6877C8]"
      />
    </label>
  );
}
