import LoginForm from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string | string[];
    registered?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const errorCode =
    typeof params.error === "string" ? params.error : undefined;
  const registered = params.registered === "1";

  const errorMessages: Record<string, string> = {
    missing_credentials: "يرجى إدخال البريد الإلكتروني وكلمة المرور.",
    invalid_credentials: "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
    profile_not_found: "الحساب غير مربوط بملف مؤثر داخل النظام.",
    account_disabled: "تم تعطيل هذا الحساب. يرجى التواصل مع الإدارة.",
    invalid_activation_session:
      "انتهت جلسة التفعيل. افتحي رابط الحملة وابدئي التفعيل مرة أخرى.",
  };

  const error = errorCode
    ? errorMessages[errorCode] ?? "حدث خطأ غير متوقع."
    : undefined;

  return <LoginForm error={error} registered={registered} />;
}
