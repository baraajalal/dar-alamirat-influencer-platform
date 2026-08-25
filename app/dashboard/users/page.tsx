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

  return (
    <main dir="rtl" className="mx-auto max-w-7xl space-y-6">
      <header>
        <p className="text-sm font-extrabold text-[#6575c8]">إدارة النظام</p>
        <h1 className="mt-1 text-3xl font-black text-[#3D274F]">إدارة الموظفين</h1>
        <p className="mt-2 text-sm text-[#7e87a1]">أضف الموظف مباشرة، ثم عيّن له كلمة مرور مؤقتة من الجدول. لا يتم إرسال أي دعوة بريدية.</p>
      </header>

      {success ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-700">
          {successMessages[success] ?? "تم تنفيذ العملية."}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">
          {errorMessages[error] ?? "حدث خطأ غير متوقع."}
        </div>
      ) : null}

      <section className="rounded-[28px] bg-white p-6 shadow-[0_16px_45px_rgba(68,82,140,0.09)]">
        <h2 className="text-xl font-black text-[#4A315C]">إضافة موظف جديد</h2>
        <form action={createStaffUser} className="mt-5 grid gap-4 md:grid-cols-4">
          <label className="space-y-2">
            <span className="text-sm font-bold text-[#596a9b]">الاسم الكامل</span>
            <input name="full_name" required minLength={3} className="w-full rounded-2xl border border-[#EEE4F2] px-4 py-3 outline-none focus:border-[#a978c3]" />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-bold text-[#596a9b]">البريد الإلكتروني</span>
            <input name="email" type="email" required dir="ltr" className="w-full rounded-2xl border border-[#EEE4F2] px-4 py-3 outline-none focus:border-[#a978c3]" />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-bold text-[#596a9b]">الدور</span>
            <select name="role" defaultValue="coordinator" className="w-full rounded-2xl border border-[#EEE4F2] px-4 py-3 outline-none focus:border-[#a978c3]">
              {Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <div className="flex items-end">
            <button className="w-full rounded-2xl bg-[#9566af] px-5 py-3 font-black text-white shadow-sm hover:bg-[#465bb5]">إضافة الموظف</button>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-[28px] bg-white shadow-[0_16px_45px_rgba(68,82,140,0.09)]">
        <div className="border-b border-[#edf0f8] p-6">
          <h2 className="text-xl font-black text-[#4A315C]">المستخدمون</h2>
          <p className="mt-1 text-sm text-[#8a92aa]">إجمالي المستخدمين: {(profiles ?? []).length}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="bg-[#f2f4ff] text-[#4d5f96]">
              <tr>
                <th className="p-4 text-right">المستخدم</th>
                <th className="p-4 text-right">الدور</th>
                <th className="p-4 text-right">حالة الحساب</th>
                <th className="p-4 text-right">آخر دخول</th>
                <th className="p-4 text-right">حالة كلمة المرور</th>
                <th className="p-4 text-right">الإجراءات</th>
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
                  <tr key={profile.id} className="border-t border-[#edf0f8] align-top">
                    <td className="p-4">
                      <p className="font-black text-[#4A315C]">{profile.full_name}</p>
                      <p className="mt-1 text-xs text-[#8c7b94]" dir="ltr">{profile.email || authUser?.email || "—"}</p>
                    </td>
                    <td className="p-4">
                      <form action={updateStaffUser} className="flex min-w-[360px] items-center gap-2">
                        <input type="hidden" name="user_id" value={profile.id} />
                        <input name="full_name" defaultValue={profile.full_name} required minLength={3} className="w-40 rounded-xl border border-[#e0e5f3] px-3 py-2" />
                        <select name="role" defaultValue={profile.role} className="rounded-xl border border-[#e0e5f3] px-3 py-2">
                          {Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                        <button className="rounded-xl bg-[#f7f0fa] px-3 py-2 font-black text-[#4d62bb]">حفظ</button>
                      </form>
                    </td>
                    <td className="p-4">
                      <span className={`rounded-full px-3 py-1.5 text-xs font-black ${!profile.is_active ? "bg-red-50 text-red-700" : waitingForTemporaryPassword || mustChangePassword ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{status}</span>
                    </td>
                    <td className="p-4 text-[#6f7892]">
                      {authUser?.last_sign_in_at ? new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(authUser.last_sign_in_at)) : "لم يسجل الدخول"}
                    </td>
                    <td className="p-4">
                      {waitingForTemporaryPassword ? (
                        <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600">لم تُعيّن بعد</span>
                      ) : mustChangePassword ? (
                        <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-700">مؤقتة — يجب تغييرها</span>
                      ) : (
                        <span className="rounded-full bg-[#F3E9F7] px-3 py-1.5 text-xs font-black text-[#754A93]">كلمة شخصية</span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="space-y-3">
                        <StaffTempPasswordForm userId={profile.id} disabled={!profile.is_active || profile.id === currentUser.id} />
                        <div className="flex flex-wrap gap-2">
                        {profile.id !== currentUser.id ? (
                          <form action={toggleStaffUser}>
                            <input type="hidden" name="user_id" value={profile.id} />
                            <input type="hidden" name="enable" value={profile.is_active ? "false" : "true"} />
                            <button className={`rounded-xl px-3 py-2 text-xs font-black ${profile.is_active ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>{profile.is_active ? "تعطيل" : "تفعيل"}</button>
                          </form>
                        ) : <span className="rounded-xl bg-[#f2f4fa] px-3 py-2 text-xs font-bold text-[#8d95aa]">حسابك الحالي</span>}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {(profiles ?? []).length === 0 ? <div className="p-10 text-center text-[#8c7b94]">لا يوجد مستخدمون موظفون حتى الآن.</div> : null}
      </section>
    </main>
  );
}
