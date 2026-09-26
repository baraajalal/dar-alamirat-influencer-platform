"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AppLocale } from "@/lib/i18n/app";
import type { FlowDictionary } from "@/lib/i18n/flow-dictionary";

type AssignmentSummary = {
  id: string;
  campaigns: { name: string; brand: string | null } | null;
  paymentAccount: {
    required: boolean;
    hasAccount: boolean;
    bankProfileStatus: string;
    bankConfirmed: boolean;
  };
};

type Copy = FlowDictionary["completeAccount"];

export default function CompleteAccountClient({
  token,
  locale,
  copy,
}: {
  token: string;
  locale: AppLocale;
  copy: Copy;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [assignment, setAssignment] = useState<AssignmentSummary | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadPage() {
      if (!token) {
        if (!cancelled) {
          setError(copy.missingToken);
          setLoading(false);
        }
        return;
      }

      try {
        const response = await fetch(
          `/api/guest-portal/assignment?token=${encodeURIComponent(token)}`,
          { cache: "no-store" },
        );
        const result = await response.json();
        if (!response.ok) {
          throw new Error(copy.loadFailed);
        }
        if (cancelled) return;

        setAssignment(result.assignment as AssignmentSummary);

        const { data } = await supabase.auth.getUser();
        if (cancelled) return;
        if (data.user) {
          window.location.replace(
            `/portal/profile/payment-details?assignment=${encodeURIComponent(result.assignment.id)}`,
          );
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : copy.loadFailed,
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    const timer = window.setTimeout(() => {
      void loadPage();
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [supabase, token, copy]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!assignment) return;

    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (signInError) {
        throw new Error(copy.invalidCredentials);
      }

      setMessage(copy.loginSuccess);
      window.location.replace(
        `/portal/profile/payment-details?assignment=${encodeURIComponent(assignment.id)}`,
      );
    } catch (loginError) {
      setError(
        loginError instanceof Error ? loginError.message : copy.loginFailed,
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
            href={`/portal/assignments/${encodeURIComponent(token)}`}
            className="text-sm font-black text-[#A170BA]"
          >
            {copy.backToAssignment}
          </Link>
        </header>

        {loading ? (
          <div className="rounded-[28px] bg-white/85 p-12 text-center font-black text-[#A170BA] shadow-xl">
            {copy.checking}
          </div>
        ) : null}

        {error ? (
          <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-bold leading-7 text-rose-700">
            {error}
          </div>
        ) : null}

        {!loading && assignment ? (
          <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
            <section className="rounded-[30px] bg-[linear-gradient(145deg,#AD7EC4,#8959A2)] p-7 text-white shadow-[0_25px_70px_rgba(74,88,162,0.25)]">
              <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-black">
                {copy.afterPublish}
              </span>
              <h2 className="mt-5 text-2xl font-black">{copy.bankProtectionTitle}</h2>
              <p className="mt-4 text-sm font-semibold leading-8 text-white/80">
                {copy.bankProtectionDescription}
              </p>
              <div className="mt-7 space-y-3 rounded-2xl border border-white/15 bg-white/10 p-5">
                <Info
                  label={copy.campaign}
                  value={assignment.campaigns?.name ?? copy.assignmentFallback}
                />
                <Info
                  label={copy.brand}
                  value={assignment.campaigns?.brand ?? copy.notSet}
                />
                <Info
                  label={copy.accountStatus}
                  value={
                    assignment.paymentAccount.hasAccount
                      ? copy.hasAccount
                      : copy.readyForEmail
                  }
                />
              </div>
            </section>

            <section className="rounded-[30px] border border-[#ECE1F1] bg-white/90 p-6 shadow-[0_20px_60px_rgba(67,82,155,0.10)] sm:p-7">
              <p className="text-sm font-black text-[#A170BA]">
                {assignment.paymentAccount.hasAccount
                  ? copy.accountExists
                  : copy.selfActivation}
              </p>
              <h2 className="mt-2 text-2xl font-black">
                {assignment.paymentAccount.hasAccount
                  ? copy.signInTitle
                  : copy.activateTitle}
              </h2>

              {!assignment.paymentAccount.hasAccount ? (
                <div className="mt-5 rounded-2xl border border-[#ECE1F1] bg-[#FCF9FD] p-5">
                  <p className="text-sm font-semibold leading-7 text-[#747E9E]">
                    {copy.activationDescription}
                  </p>
                  <Link
                    href={`/portal/activate-account?token=${encodeURIComponent(token)}`}
                    className="mt-4 flex h-14 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#A06DB9,#84539E)] px-5 text-sm font-black text-white shadow-[0_16px_32px_rgba(79,96,182,0.25)]"
                  >
                    {copy.activateButton}
                  </Link>
                </div>
              ) : null}

              <div className="my-6 flex items-center gap-3">
                <span className="h-px flex-1 bg-[#F3EDF7]" />
                <span className="text-xs font-black text-[#99A1B9]">
                  {copy.existingLogin}
                </span>
                <span className="h-px flex-1 bg-[#F3EDF7]" />
              </div>

              <form onSubmit={login} className="space-y-4">
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setEmail(event.target.value)}
                  placeholder={copy.emailPlaceholder}
                  className="h-14 w-full rounded-2xl border border-[#EBDDF2] bg-[#FDFBFE] px-4 text-sm font-bold outline-none focus:border-[#A170BA]"
                  dir="ltr"
                />
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setPassword(event.target.value)}
                  placeholder={copy.passwordPlaceholder}
                  className="h-14 w-full rounded-2xl border border-[#EBDDF2] bg-[#FDFBFE] px-4 text-sm font-bold outline-none focus:border-[#A170BA]"
                  dir="ltr"
                />
                {message ? (
                  <p className="text-sm font-bold text-emerald-700">{message}</p>
                ) : null}
                <button
                  type="submit"
                  disabled={submitting}
                  className="h-14 w-full rounded-2xl border border-[#BBC4EA] bg-white font-black text-[#9362AD] disabled:opacity-50"
                >
                  {submitting ? copy.signingIn : copy.signInAndContinue}
                </button>
              </form>
            </section>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-3 last:border-0 last:pb-0">
      <span className="text-xs font-bold text-white/65">{label}</span>
      <span className="text-sm font-black">{value}</span>
    </div>
  );
}
