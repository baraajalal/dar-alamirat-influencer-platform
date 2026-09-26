import { requirePermission } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import StaffTempPasswordForm from "@/components/dashboard/staff-temp-password-form";
import {
  createStaffUser,
  toggleStaffUser,
  updateStaffUser,
} from "./actions";

export const dynamic = "force-dynamic";

const roleLabels: Record<string, string> = {
  admin: "مدير النظام",
  coordinator: "منسق حملات",
  finance: "الإدارة المالية",
  reviewer: "مراجع محتوى",
  viewer: "مشاهدة فقط",
};

const successMessages: Record<string, string> = {
  created: "تم إنشاء حساب الموظف بدون إرسال أي بريد. عيّن له كلمة مرور مؤقتة من الجدول أدناه.",
  updated: "تم تحديث بيانات المستخدم وصلاحيته.",
  enabled: "تم تفعيل المستخدم.",
  disabled: "تم تعطيل المستخدم.",
  temporary_password_set: "تم تعيين كلمة مرور مؤقتة. انسخها وأرسلها للموظف؛ سيُطلب منه تغييرها عند أول دخول.",
};

const errorMessages: Record<string, string> = {
  invalid_fields: "راجعي الاسم والبريد والدور.",
  invalid_user: "معرف المستخدم غير صحيح.",
  email_exists: "البريد مستخدم مسبقًا.",
  create_failed: "تعذر إنشاء حساب الموظف في Supabase.",
  profile_failed: "تم إلغاء إنشاء الحساب لأن ملف الموظف لم يكتمل.",
  user_disabled: "فعّلي المستخدم أولًا.",
  update_failed: "تعذر تحديث المستخدم.",
  toggle_failed: "تعذر تغيير حالة المستخدم.",
  cannot_disable_self: "لا يمكنك تعطيل حسابك الحالي.",
  cannot_demote_self: "لا يمكنك إزالة صلاحية المدير من حسابك الحالي.",
  temporary_password_invalid: "كلمة المرور المؤقتة يجب أن تكون 8 أحرف على الأقل وتحتوي حرفًا كبيرًا وصغيرًا ورقمًا ورمزًا.",
  temporary_password_failed: "تعذر تعيين كلمة المرور المؤقتة للمستخدم.",
  temporary_password_profile_failed: "تم تغيير كلمة المرور، لكن تعذر تحديث حالة المستخدم. أعد المحاولة أو راجع السجل.",
  admin_only: "هذا الإجراء متاح لمدير النظام فقط.",
};

type SearchParams = Promise<{ success?: string | string[]; error?: string | string[] }>;

export default async function UsersPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const success = typeof params.success === "string" ? params.success : undefined;
  const error = typeof params.error === "string" ? params.error : undefined;
  const { user: currentUser } = await requirePermission("users", "view");
  const admin = createAdminClient();

  const [{ data: profiles }, authResult] = await Promise.all([
    admin
      .from("profiles")
      .select("id,full_name,email,role,is_active,invitation_status,invited_at,last_invitation_at,created_at")
      .neq("role", "influencer")
      .order("created_at", { ascending: false }),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);

  const authUsers = new Map((authResult.data?.users ?? []).map((item) => [item.id, item]));
  const userCount = (profiles ?? []).length;

  return (
    <main dir="rtl" className="mx-auto w-full max-w-[1500px] space-y-5 pb-8">
      {success ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3.5 text-sm font-bold text-emerald-700 shadow-sm">
          {successMessages[success] ?? "تم تنفيذ العملية."}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-3.5 text-sm font-bold text-red-700 shadow-sm">
          {errorMessages[error] ?? "حدث خطأ غير متوقع."}
        </div>
      ) : null}

      <section className="rounded-[30px] border border-[#F1EAF4] bg-white p-5 shadow-[0_14px_38px_rgba(68,82,140,0.07)] sm:p-6 lg:p-7">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-[#3F2A4C] sm:text-2xl">إضافة موظف جديد</h2>
            <p className="mt-1 text-xs font-medium text-[#949AB0] sm:text-sm">أدخل بيانات الموظف وحدد دوره، ثم عيّن له كلمة مرور مؤقتة من جدول المستخدمين.</p>
          </div>
        </div>

        <form action={createStaffUser} className="grid items-end gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1.1fr)_minmax(220px,.8fr)_220px]">
          <label className="min-w-0 space-y-2">
            <span className="block text-sm font-bold text-[#596A9B]">الاسم الكامل</span>
            <input
              name="full_name"
              required
              minLength={3}
              className="h-12 w-full min-w-0 rounded-2xl border border-[#EAE0EE] bg-[#FFFDFF] px-4 text-[#3F2A4C] outline-none transition placeholder:text-[#B6B4C2] focus:border-[#A978C3] focus:ring-4 focus:ring-[#A978C3]/10"
            />
          </label>

          <label className="min-w-0 space-y-2">
            <span className="block text-sm font-bold text-[#596A9B]">البريد الإلكتروني</span>
            <input
              name="email"
              type="email"
              required
              dir="ltr"
              className="h-12 w-full min-w-0 rounded-2xl border border-[#EAE0EE] bg-[#FFFDFF] px-4 text-left text-[#3F2A4C] outline-none transition placeholder:text-[#B6B4C2] focus:border-[#A978C3] focus:ring-4 focus:ring-[#A978C3]/10"
            />
          </label>

          <label className="min-w-0 space-y-2">
            <span className="block text-sm font-bold text-[#596A9B]">الدور</span>
            <select
              name="role"
              defaultValue="coordinator"
              className="h-12 w-full min-w-0 rounded-2xl border border-[#EAE0EE] bg-white px-4 text-[#51445B] outline-none transition focus:border-[#A978C3] focus:ring-4 focus:ring-[#A978C3]/10"
            >
              {Object.entries(roleLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>

          <button className="h-12 w-full rounded-2xl bg-[linear-gradient(135deg,#A66FC0,#8B58A7)] px-5 font-black text-white shadow-[0_8px_18px_rgba(149,102,175,0.22)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(149,102,175,0.28)]">
            إضافة الموظف
          </button>
        </form>
      </section>

      <section className="overflow-hidden rounded-[30px] border border-[#F1EAF4] bg-white shadow-[0_14px_38px_rgba(68,82,140,0.07)]">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#EEF0F6] px-5 py-5 sm:px-6 lg:px-7">
          <div>
            <h2 className="text-xl font-black text-[#3F2A4C] sm:text-2xl">المستخدمون</h2>
            <p className="mt-1 text-sm text-[#8A92AA]">إدارة الصلاحيات، حالة الحساب، وكلمات المرور المؤقتة.</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-2xl bg-[#F7F1FA] px-4 py-2 text-sm font-bold text-[#76508F]">
            <span>إجمالي المستخدمين</span>
            <span className="rounded-full bg-white px-2.5 py-0.5 font-black text-[#4D3A59] shadow-sm">{userCount}</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1420px] table-fixed text-sm">
            <colgroup>
              <col className="w-[220px]" />
              <col className="w-[390px]" />
              <col className="w-[150px]" />
              <col className="w-[160px]" />
              <col className="w-[180px]" />
              <col className="w-[320px]" />
            </colgroup>
            <thead className="bg-[#F7F1FA] text-[#53659A]">
              <tr>
                <th className="px-5 py-4 text-right font-black">المستخدم</th>
                <th className="px-4 py-4 text-right font-black">الاسم والدور</th>
                <th className="px-4 py-4 text-center font-black">حالة الحساب</th>
                <th className="px-4 py-4 text-center font-black">آخر دخول</th>
                <th className="px-4 py-4 text-center font-black">كلمة المرور</th>
                <th className="px-5 py-4 text-right font-black">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {(profiles ?? []).map((profile) => {
                const authUser = authUsers.get(profile.id);
                const mustChangePassword = authUser?.app_metadata?.must_change_password === true;
                const waitingForTemporaryPassword = profile.invitation_status === "pending";
                const status = !profile.is_active
                  ? "معطل"
                  : waitingForTemporaryPassword
                    ? "بانتظار كلمة مؤقتة"
                    : mustChangePassword
                      ? "دخول مؤقت"
                      : "نشط";

                return (
                  <tr key={profile.id} className="border-t border-[#EEF0F6] align-middle transition hover:bg-[#FCFAFD]">
                    <td className="px-5 py-5">
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-black text-[#4A315C]" title={profile.full_name}>{profile.full_name}</p>
                        <p className="mt-1 break-all text-xs leading-5 text-[#92869A]" dir="ltr">{profile.email || authUser?.email || "—"}</p>
                      </div>
                    </td>

                    <td className="px-4 py-5">
                      <form action={updateStaffUser} className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)_auto] items-center gap-2">
                        <input type="hidden" name="user_id" value={profile.id} />
                        <input
                          name="full_name"
                          defaultValue={profile.full_name}
                          required
                          minLength={3}
                          className="h-10 min-w-0 w-full rounded-xl border border-[#E0E5F3] bg-white px-3 text-sm text-[#51445B] outline-none transition focus:border-[#A978C3] focus:ring-4 focus:ring-[#A978C3]/10"
                        />
                        <select
                          name="role"
                          defaultValue={profile.role}
                          className="h-10 min-w-0 w-full rounded-xl border border-[#E0E5F3] bg-white px-3 text-sm text-[#51445B] outline-none transition focus:border-[#A978C3]"
                        >
                          {Object.entries(roleLabels).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>
                        <button className="h-10 whitespace-nowrap rounded-xl bg-[#F3E9F7] px-4 text-xs font-black text-[#5D5FC2] transition hover:bg-[#EADCF0]">حفظ</button>
                      </form>
                    </td>

                    <td className="px-4 py-5 text-center">
                      <span className={`inline-flex max-w-full items-center justify-center rounded-full px-3 py-1.5 text-center text-xs font-black leading-5 ${!profile.is_active ? "bg-red-50 text-red-700" : waitingForTemporaryPassword || mustChangePassword ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
                        {status}
                      </span>
                    </td>

                    <td className="px-4 py-5 text-center text-xs leading-6 text-[#6F7892]">
                      {authUser?.last_sign_in_at
                        ? new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(authUser.last_sign_in_at))
                        : "لم يسجل الدخول"}
                    </td>

                    <td className="px-4 py-5 text-center">
                      {waitingForTemporaryPassword ? (
                        <span className="inline-flex rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black leading-5 text-slate-600">لم تُعيّن بعد</span>
                      ) : mustChangePassword ? (
                        <span className="inline-flex rounded-full bg-amber-50 px-3 py-1.5 text-xs font-black leading-5 text-amber-700">مؤقتة — يجب تغييرها</span>
                      ) : (
                        <span className="inline-flex rounded-full bg-[#F3E9F7] px-3 py-1.5 text-xs font-black leading-5 text-[#754A93]">كلمة شخصية</span>
                      )}
                    </td>

                    <td className="px-5 py-5">
                      <div className="w-full min-w-0 space-y-2.5">
                        <StaffTempPasswordForm userId={profile.id} disabled={!profile.is_active || profile.id === currentUser.id} />
                        <div className="flex min-h-10 items-center gap-2">
                          {profile.id !== currentUser.id ? (
                            <form action={toggleStaffUser} className="w-full">
                              <input type="hidden" name="user_id" value={profile.id} />
                              <input type="hidden" name="enable" value={profile.is_active ? "false" : "true"} />
                              <button className={`h-10 w-full rounded-xl px-3 text-xs font-black transition ${profile.is_active ? "bg-red-50 text-red-700 hover:bg-red-100" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"}`}>
                                {profile.is_active ? "تعطيل الحساب" : "تفعيل الحساب"}
                              </button>
                            </form>
                          ) : (
                            <span className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-[#F2F4FA] px-3 text-xs font-bold text-[#8D95AA]">حسابك الحالي</span>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {userCount === 0 ? (
          <div className="p-10 text-center text-[#8C7B94]">لا يوجد مستخدمون موظفون حتى الآن.</div>
        ) : null}
      </section>
    </main>
  );
}
