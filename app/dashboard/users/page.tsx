import { requirePermission } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  inviteStaffUser,
  resendStaffInvitation,
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
  invited: "تم إنشاء المستخدم وإرسال دعوة التفعيل.",
  resent: "تمت إعادة إرسال الدعوة.",
  updated: "تم تحديث بيانات المستخدم وصلاحيته.",
  enabled: "تم تفعيل المستخدم.",
  disabled: "تم تعطيل المستخدم.",
};

const errorMessages: Record<string, string> = {
  invalid_fields: "راجعي الاسم والبريد والدور.",
  invalid_user: "معرف المستخدم غير صحيح.",
  email_exists: "البريد مستخدم مسبقًا.",
  invite_failed: "تعذر إرسال الدعوة. راجعي إعدادات Supabase والبريد.",
  profile_failed: "تم إلغاء الدعوة لأن إنشاء ملف المستخدم لم يكتمل.",
  email_missing: "لا يوجد بريد محفوظ لهذا المستخدم.",
  user_disabled: "فعّلي المستخدم قبل إعادة إرسال الدعوة.",
  resend_failed: "تعذر إعادة إرسال الدعوة.",
  update_failed: "تعذر تحديث المستخدم.",
  toggle_failed: "تعذر تغيير حالة المستخدم.",
  cannot_disable_self: "لا يمكنك تعطيل حسابك الحالي.",
  cannot_demote_self: "لا يمكنك إزالة صلاحية المدير من حسابك الحالي.",
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
        <h1 className="mt-1 text-3xl font-black text-[#304176]">المستخدمون والدعوات</h1>
        <p className="mt-2 text-sm text-[#7e87a1]">إضافة موظفين، إرسال الدعوات، وتحديد الدور الأساسي لكل مستخدم.</p>
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
        <h2 className="text-xl font-black text-[#344578]">دعوة مستخدم جديد</h2>
        <form action={inviteStaffUser} className="mt-5 grid gap-4 md:grid-cols-4">
          <label className="space-y-2">
            <span className="text-sm font-bold text-[#596a9b]">الاسم الكامل</span>
            <input name="full_name" required minLength={3} className="w-full rounded-2xl border border-[#dfe4f4] px-4 py-3 outline-none focus:border-[#6578cf]" />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-bold text-[#596a9b]">البريد الإلكتروني</span>
            <input name="email" type="email" required dir="ltr" className="w-full rounded-2xl border border-[#dfe4f4] px-4 py-3 outline-none focus:border-[#6578cf]" />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-bold text-[#596a9b]">الدور</span>
            <select name="role" defaultValue="coordinator" className="w-full rounded-2xl border border-[#dfe4f4] px-4 py-3 outline-none focus:border-[#6578cf]">
              {Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <div className="flex items-end">
            <button className="w-full rounded-2xl bg-[#5368c3] px-5 py-3 font-black text-white shadow-sm hover:bg-[#465bb5]">إرسال الدعوة</button>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-[28px] bg-white shadow-[0_16px_45px_rgba(68,82,140,0.09)]">
        <div className="border-b border-[#edf0f8] p-6">
          <h2 className="text-xl font-black text-[#344578]">المستخدمون</h2>
          <p className="mt-1 text-sm text-[#8a92aa]">إجمالي المستخدمين: {(profiles ?? []).length}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="bg-[#f2f4ff] text-[#4d5f96]">
              <tr>
                <th className="p-4 text-right">المستخدم</th>
                <th className="p-4 text-right">الدور</th>
                <th className="p-4 text-right">حالة الدعوة</th>
                <th className="p-4 text-right">آخر دخول</th>
                <th className="p-4 text-right">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {(profiles ?? []).map((profile) => {
                const authUser = authUsers.get(profile.id);
                const confirmed = Boolean(authUser?.email_confirmed_at);
                const status = !profile.is_active ? "معطل" : confirmed ? "نشط" : "دعوة معلقة";
                const canResend = profile.is_active && !confirmed && Boolean(profile.email);
                return (
                  <tr key={profile.id} className="border-t border-[#edf0f8] align-top">
                    <td className="p-4">
                      <p className="font-black text-[#344578]">{profile.full_name}</p>
                      <p className="mt-1 text-xs text-[#8790aa]" dir="ltr">{profile.email || authUser?.email || "—"}</p>
                    </td>
                    <td className="p-4">
                      <form action={updateStaffUser} className="flex min-w-[360px] items-center gap-2">
                        <input type="hidden" name="user_id" value={profile.id} />
                        <input name="full_name" defaultValue={profile.full_name} required minLength={3} className="w-40 rounded-xl border border-[#e0e5f3] px-3 py-2" />
                        <select name="role" defaultValue={profile.role} className="rounded-xl border border-[#e0e5f3] px-3 py-2">
                          {Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                        <button className="rounded-xl bg-[#eef1ff] px-3 py-2 font-black text-[#4d62bb]">حفظ</button>
                      </form>
                    </td>
                    <td className="p-4">
                      <span className={`rounded-full px-3 py-1.5 text-xs font-black ${!profile.is_active ? "bg-red-50 text-red-700" : confirmed ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{status}</span>
                      {profile.last_invitation_at ? <p className="mt-2 text-xs text-[#929ab0]">آخر دعوة: {new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(profile.last_invitation_at))}</p> : null}
                    </td>
                    <td className="p-4 text-[#6f7892]">
                      {authUser?.last_sign_in_at ? new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(authUser.last_sign_in_at)) : "لم يسجل الدخول"}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-2">
                        {canResend ? (
                          <form action={resendStaffInvitation}>
                            <input type="hidden" name="user_id" value={profile.id} />
                            <button className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-black text-blue-700">إعادة الدعوة</button>
                          </form>
                        ) : null}
                        {profile.id !== currentUser.id ? (
                          <form action={toggleStaffUser}>
                            <input type="hidden" name="user_id" value={profile.id} />
                            <input type="hidden" name="enable" value={profile.is_active ? "false" : "true"} />
                            <button className={`rounded-xl px-3 py-2 text-xs font-black ${profile.is_active ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>{profile.is_active ? "تعطيل" : "تفعيل"}</button>
                          </form>
                        ) : <span className="rounded-xl bg-[#f2f4fa] px-3 py-2 text-xs font-bold text-[#8d95aa]">حسابك الحالي</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {(profiles ?? []).length === 0 ? <div className="p-10 text-center text-[#8790aa]">لا يوجد مستخدمون موظفون حتى الآن.</div> : null}
      </section>
    </main>
  );
}
