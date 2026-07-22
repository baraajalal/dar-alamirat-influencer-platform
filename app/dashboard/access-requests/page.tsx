import Link from "next/link";
import { requireRole } from "@/lib/auth/require-user";
import { approvePortalAccess, rejectPortalAccess } from "./actions";

export const dynamic = "force-dynamic";

const reasonLabels: Record<string, string> = {
  self_service: "طلب شخصي",
  campaign_access: "لاستخدام الحملة",
  payment_required: "مرتبط بمستحقات مالية",
};

const statusLabels: Record<string, string> = {
  pending: "بانتظار المراجعة",
  approved: "تم إرسال الدعوة",
  completed: "تم التفعيل",
  rejected: "مرفوض",
  cancelled: "ملغي",
};

const successMessages: Record<string, string> = {
  invited: "تم إنشاء الحساب وإرسال دعوة التفعيل إلى البريد الإلكتروني.",
  already_linked: "الحساب مرتبط مسبقًا وتم إغلاق الطلب.",
  rejected: "تم رفض طلب التفعيل.",
};

const errorMessages: Record<string, string> = {
  missing_request: "معرف الطلب غير موجود.",
  request_not_found: "تعذر العثور على طلب التفعيل.",
  request_closed: "هذا الطلب مغلق ولا يمكن معالجته.",
  influencer_not_found: "ملف المؤثر غير موجود.",
  email_exists: "البريد مستخدم في حساب آخر. راجعي البريد قبل إعادة الدعوة.",
  invite_failed: "تعذر إرسال دعوة Supabase. راجعي إعدادات البريد وروابط التحويل.",
  link_failed: "تم إلغاء إنشاء الحساب لأن ربطه بملف المؤثر لم يكتمل.",
  reject_failed: "تعذر رفض الطلب.",
};

export default async function AccessRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{
    success?: string | string[];
    error?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const successCode =
    typeof params.success === "string" ? params.success : undefined;
  const errorCode = typeof params.error === "string" ? params.error : undefined;

  const { supabase, profile } = await requireRole([
    "admin",
    "coordinator",
    "finance",
  ]);

  const { data: requests } = await supabase
    .from("portal_access_requests")
    .select(
      "id,requested_email,normalized_mobile,request_reason,status,priority,created_at,influencers(full_name,profile_completion,user_id)",
    )
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true });

  const canApprove = profile.role === "admin";

  return (
    <main dir="rtl" className="min-h-screen bg-[#f4f6fb] p-4 sm:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-[#6575c8]">بوابة المؤثر</p>
            <h1 className="mt-1 text-3xl font-black text-[#304176]">
              طلبات تفعيل الحساب
            </h1>
            <p className="mt-2 text-sm text-[#7e87a1]">
              الطلبات المرتبطة بمستحقات مالية تظهر بأولوية عالية.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="rounded-2xl border border-[#dce1f4] bg-white px-5 py-3 font-bold text-[#5e6e9a]"
          >
            العودة للوحة الإدارة
          </Link>
        </div>

        {successCode && (
          <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-700">
            {successMessages[successCode] ?? "تم تنفيذ العملية."}
          </div>
        )}

        {errorCode && (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">
            {errorMessages[errorCode] ?? "حدث خطأ غير متوقع."}
          </div>
        )}

        {!canApprove && (
          <div className="mb-5 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm text-blue-700">
            يمكنك مشاهدة الطلبات، لكن إرسال الدعوة أو الرفض متاح للمدير فقط.
          </div>
        )}

        <section className="overflow-hidden rounded-[28px] bg-white shadow-[0_16px_45px_rgba(68,82,140,0.09)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1150px] text-sm">
              <thead className="bg-[#f2f4ff] text-[#4d5f96]">
                <tr>
                  <th className="p-4 text-right">المؤثر</th>
                  <th className="p-4 text-right">الجوال</th>
                  <th className="p-4 text-right">البريد</th>
                  <th className="p-4 text-right">سبب الطلب</th>
                  <th className="p-4 text-right">الأولوية</th>
                  <th className="p-4 text-right">الحالة</th>
                  <th className="p-4 text-right">تاريخ الطلب</th>
                  <th className="p-4 text-right">الإجراء</th>
                </tr>
              </thead>
              <tbody>
                {(requests ?? []).map((request) => {
                  const influencer = Array.isArray(request.influencers)
                    ? request.influencers[0]
                    : request.influencers;
                  const actionable =
                    canApprove && request.status === "pending" && !influencer?.user_id;

                  return (
                    <tr key={request.id} className="border-t border-[#edf0f8]">
                      <td className="p-4">
                        <p className="font-black text-[#344578]">
                          {influencer?.full_name || "—"}
                        </p>
                        <p className="mt-1 text-xs text-[#8a92aa]">
                          اكتمال الملف {influencer?.profile_completion ?? 0}%
                        </p>
                      </td>
                      <td className="p-4" dir="ltr">
                        {request.normalized_mobile}
                      </td>
                      <td className="p-4" dir="ltr">
                        {request.requested_email}
                      </td>
                      <td className="p-4">
                        {reasonLabels[request.request_reason] ?? request.request_reason}
                      </td>
                      <td className="p-4">
                        <span
                          className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                            request.priority === "high"
                              ? "bg-red-50 text-red-700"
                              : "bg-blue-50 text-blue-700"
                          }`}
                        >
                          {request.priority === "high" ? "عالية" : "عادية"}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="rounded-full bg-[#f1f3fb] px-3 py-1.5 text-xs font-bold text-[#64708f]">
                          {statusLabels[request.status] ?? request.status}
                        </span>
                      </td>
                      <td className="p-4">
                        {new Intl.DateTimeFormat("ar-SA", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(new Date(request.created_at))}
                      </td>
                      <td className="p-4">
                        {actionable ? (
                          <div className="flex gap-2">
                            <form action={approvePortalAccess}>
                              <input
                                type="hidden"
                                name="requestId"
                                value={request.id}
                              />
                              <button className="rounded-xl bg-[#5f73d5] px-4 py-2.5 text-xs font-black text-white">
                                إرسال الدعوة
                              </button>
                            </form>
                            <form action={rejectPortalAccess}>
                              <input
                                type="hidden"
                                name="requestId"
                                value={request.id}
                              />
                              <button className="rounded-xl bg-red-50 px-4 py-2.5 text-xs font-black text-red-600">
                                رفض
                              </button>
                            </form>
                          </div>
                        ) : (
                          <span className="text-xs text-[#939bb0]">لا يوجد إجراء</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {(requests ?? []).length === 0 && (
            <div className="p-10 text-center text-[#8790aa]">
              لا توجد طلبات تفعيل حاليًا.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
