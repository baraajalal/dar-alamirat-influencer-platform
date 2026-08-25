import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import StaffLoginForm from "./login-form";

export const dynamic = "force-dynamic";

export default async function StaffLoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string | string[];
    activated?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const errorCode = typeof params.error === "string" ? params.error : undefined;
  const activated = params.activated === "1";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role,is_active,invitation_status")
      .eq("id", user.id)
      .maybeSingle();

    if (profile && profile.role !== "influencer" && profile.is_active) {
      if (user.app_metadata?.must_change_password === true) redirect("/staff/change-password");
      if (profile.invitation_status === "pending") {
        await supabase.auth.signOut();
        redirect("/staff/login?error=temporary_password_required");
      }
      redirect("/dashboard");
    }
  }

  const messages: Record<string, string> = {
    missing_credentials: "أدخل البريد الإلكتروني وكلمة المرور.",
    invalid_credentials: "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
    not_staff: "هذا الحساب ليس حساب موظف. استخدم بوابة المؤثرين.",
    account_disabled: "تم تعطيل هذا الحساب. تواصل مع الإدارة.",
    invalid_invite: "رابط الدعوة القديم لم يعد مستخدمًا. اطلب من الإدارة تعيين كلمة مرور مؤقتة لحسابك.",
    legacy_activation_disabled: "تم إيقاف التفعيل عبر روابط البريد. استخدم كلمة المرور المؤقتة التي يعيّنها مدير النظام.",
    temporary_password_required: "الحساب موجود، لكن الإدارة لم تعيّن له كلمة مرور مؤقتة بعد.",
    profile_not_found: "تعذر العثور على ملف الموظف داخل النظام.",
  };

  return (
    <StaffLoginForm
      error={errorCode ? messages[errorCode] ?? "حدث خطأ غير متوقع." : undefined}
      success={activated ? "تم تفعيل حسابك بنجاح. سجّل الدخول باستخدام بريدك وكلمة المرور الجديدة." : undefined}
    />
  );
}
