"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useState } from "react";
import { normalizeSaudiMobile } from "@/lib/influencers/mobile";
import type { AppLocale } from "@/lib/i18n/app";
import { formatFlowMessage, type FlowDictionary } from "@/lib/i18n/flow-dictionary";

type RegistrationResult = {
  success?: boolean;
  accountExists?: boolean;
  requiresLogin?: boolean;
  maskedEmail?: string | null;
  loginPath?: string;
  nextPath?: string;
  message?: string;
  code?: string;
};

type ViewState = "register" | "existing" | "complete";

type Copy = FlowDictionary["directActivation"];

function resultError(copy: Copy, code?: string) {
  if (!code) return copy.createFailed;
  return copy.errors[code as keyof typeof copy.errors] ?? copy.createFailed;
}

export default function ActivationClient({
  token,
  locale,
  copy,
}: {
  token: string;
  locale: AppLocale;
  copy: Copy;
}) {
  const [view, setView] = useState<ViewState>("register");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null);
  const [loginPath, setLoginPath] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const normalizedMobile = normalizeSaudiMobile(mobile);
  const passwordIsValid =
    password.length >= 8 && /[A-Za-z]/.test(password) && /[0-9]/.test(password);

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!token) {
      setError(copy.missingToken);
      return;
    }

    if (!normalizedMobile) {
      setError(copy.invalidMobile);
      return;
    }

    if (!passwordIsValid) {
      setError(copy.weakPassword);
      return;
    }

    if (password !== passwordConfirmation) {
      setError(copy.passwordMismatch);
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/influencer-activation/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          mobile,
          email,
          password,
          passwordConfirmation,
        }),
      });

      const result = (await response.json()) as RegistrationResult;

      if (result.accountExists) {
        setMaskedEmail(result.maskedEmail ?? null);
        setLoginPath(
          result.loginPath ||
            `/portal/complete-account?token=${encodeURIComponent(token)}`,
        );
        setMessage(copy.accountExists);
        setView("existing");
        return;
      }

      if (!response.ok) {
        throw new Error(resultError(copy, result.code));
      }

      setMessage(copy.created);
      setView("complete");

      window.setTimeout(() => {
        window.location.replace(
          result.nextPath || "/portal/profile/payment-details?registered=1",
        );
      }, 700);
    } catch (registrationError) {
      setError(
        registrationError instanceof Error
          ? registrationError.message
          : copy.genericFailed,
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main
      lang={locale}
      dir="inherit"
      data-no-auto-translate
      className="min-h-screen bg-[radial-gradient(circle_at_8%_10%,rgba(216,221,247,0.82),transparent_30%),linear-gradient(135deg,#FFFDFF,#F9F5FB)] px-4 py-8 font-['Tajawal',Tahoma,Arial,sans-serif] text-[#432A57]"
    >
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex items-center justify-between rounded-[24px] border border-white/90 bg-white/82 px-5 py-4 shadow-[0_18px_55px_rgba(67,82,155,0.11)] backdrop-blur-xl">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/da-logo.png"
              alt="DA"
              className="h-14 w-14 rounded-2xl object-contain"
            />
            <div>
              <p className="text-xs font-black text-[#8F7E98]">{copy.portalLabel}</p>
              <h1 className="text-lg font-black text-[#432A57]">{copy.headerTitle}</h1>
            </div>
          </div>
          <Link
            href={token ? `/portal/assignments/${encodeURIComponent(token)}` : "/"}
            className="text-sm font-black text-[#A170BA]"
          >
            {copy.backToAssignment}
          </Link>
        </header>

        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-[30px] bg-[linear-gradient(145deg,#AD7EC4,#8959A2)] p-7 text-white shadow-[0_25px_70px_rgba(74,88,162,0.25)]">
            <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-black">
              {copy.secureBadge}
            </span>
            <h2 className="mt-5 text-2xl font-black">{copy.introTitle}</h2>
            <p className="mt-4 text-sm font-semibold leading-8 text-white/80">
              {copy.introDescription}
            </p>
            <div className="mt-7 space-y-3">
              {copy.steps.map((step, index) => (
                <RegistrationStep key={step} number={String(index + 1)} text={step} />
              ))}
            </div>
            <div className="mt-7 rounded-2xl border border-white/15 bg-white/10 p-4 text-xs font-semibold leading-6 text-white/80">
              {copy.mobileFormats}
            </div>
          </section>

          <section className="rounded-[30px] border border-[#ECE1F1] bg-white/90 p-6 shadow-[0_20px_60px_rgba(67,82,155,0.10)] sm:p-8">
            {view === "register" ? (
              <form onSubmit={register} className="space-y-4">
                <p className="text-sm font-black text-[#A170BA]">{copy.createLabel}</p>
                <h2 className="text-2xl font-black">{copy.formTitle}</h2>
                <p className="text-sm font-semibold leading-7 text-[#806F8A]">
                  {copy.formDescription}
                </p>

                <Field
                  label={copy.mobileLabel}
                  type="tel"
                  value={mobile}
                  onChange={setMobile}
                  autoComplete="tel"
                  inputMode="tel"
                  placeholder={copy.mobilePlaceholder}
                  direction="ltr"
                />

                {mobile ? (
                  <p
                    className={`rounded-xl px-3 py-2 text-xs font-bold ${
                      normalizedMobile
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {normalizedMobile
                      ? formatFlowMessage(copy.mobileWillVerify, {
                          mobile: normalizedMobile,
                        })
                      : copy.mobileIncomplete}
                  </p>
                ) : null}

                <Field
                  label={copy.emailLabel}
                  type="email"
                  value={email}
                  onChange={setEmail}
                  autoComplete="email"
                  inputMode="email"
                  placeholder={copy.emailPlaceholder}
                  direction="ltr"
                />

                <PasswordField
                  label={copy.passwordLabel}
                  value={password}
                  onChange={setPassword}
                  show={showPassword}
                  onToggle={() => setShowPassword((current) => !current)}
                  autoComplete="new-password"
                  showLabel={copy.show}
                  hideLabel={copy.hide}
                />

                <PasswordField
                  label={copy.confirmPasswordLabel}
                  value={passwordConfirmation}
                  onChange={setPasswordConfirmation}
                  show={showPassword}
                  onToggle={() => setShowPassword((current) => !current)}
                  autoComplete="new-password"
                  showLabel={copy.show}
                  hideLabel={copy.hide}
                />

                <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                  <PasswordRule valid={password.length >= 8} text={copy.ruleMin} />
                  <PasswordRule valid={/[A-Za-z]/.test(password)} text={copy.ruleLetter} />
                  <PasswordRule valid={/[0-9]/.test(password)} text={copy.ruleNumber} />
                  <PasswordRule
                    valid={Boolean(password) && password === passwordConfirmation}
                    text={copy.ruleMatch}
                  />
                </div>

                <Feedback message={message} error={error} />
                <PrimaryButton disabled={submitting}>
                  {submitting ? copy.creating : copy.createAndContinue}
                </PrimaryButton>
              </form>
            ) : null}

            {view === "existing" ? (
              <div className="space-y-5">
                <p className="text-sm font-black text-[#A170BA]">{copy.existingLabel}</p>
                <h2 className="text-2xl font-black">{copy.existingTitle}</h2>
                <p className="text-sm font-semibold leading-7 text-[#806F8A]">
                  {formatFlowMessage(copy.existingDescription, {
                    email: maskedEmail ? ` (${maskedEmail})` : "",
                  })}
                </p>
                <Feedback message={message} error={error} />
                <Link
                  href={
                    loginPath ||
                    `/portal/complete-account?token=${encodeURIComponent(token)}`
                  }
                  className="flex h-14 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#A06DB9,#84539E)] px-5 font-black text-white"
                >
                  {copy.loginAndBank}
                </Link>
              </div>
            ) : null}

            {view === "complete" ? (
              <div className="py-12 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-700">
                  ✓
                </div>
                <h2 className="mt-5 text-2xl font-black">{copy.completeTitle}</h2>
                <p className="mt-3 text-sm font-semibold text-[#806F8A]">
                  {copy.redirecting}
                </p>
                <Feedback message={message} error={error} />
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </main>
  );
}

function RegistrationStep({ number, text }: { number: string; text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 p-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-sm font-black">
        {number}
      </span>
      <span className="text-sm font-bold">{text}</span>
    </div>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  placeholder,
  inputMode,
  autoComplete,
  direction,
}: {
  label: string;
  type: "email" | "tel" | "text";
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  inputMode?: "numeric" | "text" | "email" | "tel";
  autoComplete?: string;
  direction?: "ltr" | "rtl";
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-black text-[#624B72]">{label}</span>
      <input
        type={type}
        required
        value={value}
        onChange={(event: ChangeEvent<HTMLInputElement>) =>
          onChange(event.target.value)
        }
        placeholder={placeholder}
        inputMode={inputMode}
        autoComplete={autoComplete}
        className="h-14 w-full rounded-2xl border border-[#EBDDF2] bg-[#FDFBFE] px-4 text-sm font-bold outline-none focus:border-[#A170BA]"
        dir={direction}
      />
    </label>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  show,
  onToggle,
  autoComplete,
  showLabel,
  hideLabel,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  show: boolean;
  onToggle: () => void;
  autoComplete: string;
  showLabel: string;
  hideLabel: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-black text-[#624B72]">{label}</span>
      <span className="relative block">
        <input
          type={show ? "text" : "password"}
          required
          minLength={8}
          value={value}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            onChange(event.target.value)
          }
          autoComplete={autoComplete}
          className="h-14 w-full rounded-2xl border border-[#EBDDF2] bg-[#FDFBFE] ps-4 pe-20 text-sm font-bold outline-none focus:border-[#A170BA]"
          dir="ltr"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute end-3 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-black text-[#A170BA]"
        >
          {show ? hideLabel : showLabel}
        </button>
      </span>
    </label>
  );
}

function PasswordRule({ valid, text }: { valid: boolean; text: string }) {
  return (
    <span
      className={`rounded-xl px-3 py-2 ${
        valid ? "bg-emerald-50 text-emerald-700" : "bg-[#F5F6FC] text-[#8F7E98]"
      }`}
    >
      {valid ? "✓" : "○"} {text}
    </span>
  );
}

function PrimaryButton({
  disabled,
  children,
}: {
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="h-14 w-full rounded-2xl bg-[linear-gradient(135deg,#A06DB9,#84539E)] font-black text-white shadow-[0_16px_32px_rgba(79,96,182,0.25)] disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function Feedback({ message, error }: { message: string; error: string }) {
  return (
    <>
      {message ? (
        <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
          {error}
        </p>
      ) : null}
    </>
  );
}

