import Image from "next/image";
import { cookies } from "next/headers";
import { setInvitedUserPassword } from "./actions";
import { normalizeAppLocale } from "@/lib/i18n/app";
import { getFlowDictionary } from "@/lib/i18n/flow-dictionary";

export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const params = await searchParams;
  const errorCode = typeof params.error === "string" ? params.error : undefined;
  const cookieStore = await cookies();
  const locale = normalizeAppLocale(
    cookieStore.get("app_locale")?.value ?? cookieStore.get("dashboard_locale")?.value,
  );
  const copy = getFlowDictionary(locale).invitedPassword;
  const errorMessage = errorCode
    ? copy.errors[errorCode as keyof typeof copy.errors] ?? copy.errors.default
    : null;

  return (
    <main
      lang={locale}
      dir="inherit"
      data-no-auto-translate
      className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_right,#F4ECF7,#FBF7FC_45%,#f4f5f9)] px-4 py-10"
    >
      <div className="w-full max-w-md rounded-[32px] border border-white bg-white p-7 shadow-[0_25px_70px_rgba(70,85,150,0.13)] sm:p-9">
        <div className="mb-7 text-center">
          <div className="relative mx-auto mb-4 h-20 w-28 rounded-2xl bg-[#f2f4ff]">
            <Image
              src="/da-logo.png"
              alt="DA"
              fill
              className="object-contain p-2"
              priority
            />
          </div>
          <p className="text-sm font-bold text-[#6777ca]">{copy.inviteLabel}</p>
          <h1 className="mt-1 text-2xl font-black text-[#2e3f73]">
            {copy.title}
          </h1>
          <p className="mt-2 text-sm leading-7 text-[#7c85a0]">
            {copy.description}
          </p>
        </div>

        {errorMessage ? (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold leading-7 text-red-700">
            {errorMessage}
          </div>
        ) : null}

        <form action={setInvitedUserPassword} className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-black text-[#4C335F]">
              {copy.newPassword}
            </span>
            <input
              className="input-v4"
              name="password"
              type="password"
              minLength={8}
              required
              autoComplete="new-password"
              dir="ltr"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-black text-[#4C335F]">
              {copy.confirmPassword}
            </span>
            <input
              className="input-v4"
              name="confirmPassword"
              type="password"
              minLength={8}
              required
              autoComplete="new-password"
              dir="ltr"
            />
          </label>

          <p className="rounded-2xl bg-[#F8F3FA] px-4 py-3 text-xs leading-6 text-[#727c98]">
            {copy.rules}
          </p>

          <button
            type="submit"
            className="w-full rounded-2xl bg-[#9c68b9] px-6 py-4 font-black text-white shadow-lg shadow-[#9c68b9]/20 transition hover:bg-[#5266c5]"
          >
            {copy.submit}
          </button>
        </form>
      </div>
    </main>
  );
}
