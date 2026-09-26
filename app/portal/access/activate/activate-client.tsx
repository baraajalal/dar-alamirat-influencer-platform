"use client";

import { useCallback, useEffect, useState } from "react";
import FeedbackModal from "@/components/feedback-modal";
import type { AppLocale } from "@/lib/i18n/app";
import { formatFlowMessage, type FlowDictionary } from "@/lib/i18n/flow-dictionary";

type ActivationInfo = {
  fullName: string;
  email: string;
};

type ActivationResponse = {
  fullName?: string;
  email?: string;
  nextPath?: string;
  code?: string;
};

type Copy = FlowDictionary["activationLink"];

type PortalAccessActivateClientProps = {
  token: string;
  locale: AppLocale;
  copy: Copy;
};

function apiError(copy: Copy, code: string | undefined, status: number) {
  if (code) {
    const translated = copy.errors[code as keyof typeof copy.errors];
    if (translated) return translated;
  }
  if (status === 410) return copy.errors.ACTIVATION_LINK_INVALID;
  if (status === 409) return copy.errors.ACTIVATION_REQUEST_UNAVAILABLE;
  if (status === 400) return copy.errors.ACTIVATION_PASSWORD_INVALID;
  return copy.errors.ACTIVATION_FAILED;
}

export default function PortalAccessActivateClient({
  token,
  locale,
  copy,
}: PortalAccessActivateClientProps) {
  const [info, setInfo] = useState<ActivationInfo | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<"success" | "error">("error");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [closeDestination, setCloseDestination] = useState<string | null>(null);

  const showFeedback = useCallback(
    (type: "success" | "error", message: string, destination: string | null = null) => {
      setFeedbackType(type);
      setFeedbackMessage(message);
      setCloseDestination(destination);
      setFeedbackOpen(true);
    },
    [],
  );

  const closeFeedback = useCallback(() => {
    setFeedbackOpen(false);

    if (closeDestination) {
      window.location.replace(closeDestination);
    }
  }, [closeDestination]);

  useEffect(() => {
    let cancelled = false;

    async function verifyActivationLink() {
      if (!token) {
        if (!cancelled) {
          setLoading(false);
          showFeedback("error", copy.invalidLink, "/");
        }
        return;
      }

      try {
        const response = await fetch(
          `/api/portal-access/activate?token=${encodeURIComponent(token)}`,
          {
            method: "GET",
            cache: "no-store",
          },
        );

        const result = (await response.json().catch(() => ({}))) as ActivationResponse;

        if (!response.ok) {
          throw new Error(apiError(copy, result.code, response.status));
        }

        if (!cancelled) {
          setInfo({
            fullName: String(result.fullName || ""),
            email: String(result.email || ""),
          });
        }
      } catch (error) {
        if (!cancelled) {
          showFeedback(
            "error",
            error instanceof Error ? error.message : copy.verifyFailed,
            "/",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void verifyActivationLink();

    return () => {
      cancelled = true;
    };
  }, [token, showFeedback, copy]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      showFeedback("error", copy.invalidLink, "/");
      return;
    }

    if (password.length < 8) {
      showFeedback("error", copy.passwordMin);
      return;
    }

    if (!/[A-Za-z\u0600-\u06FF]/.test(password)) {
      showFeedback("error", copy.passwordLetter);
      return;
    }

    if (!/\d/.test(password)) {
      showFeedback("error", copy.passwordNumber);
      return;
    }

    if (password !== confirm) {
      showFeedback("error", copy.passwordMismatch);
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/portal-access/activate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token, password }),
      });

      const result = (await response.json().catch(() => ({}))) as ActivationResponse;

      if (!response.ok) {
        throw new Error(apiError(copy, result.code, response.status));
      }

      showFeedback(
        "success",
        copy.activationSuccess,
        typeof result.nextPath === "string" && result.nextPath
          ? result.nextPath
          : "/login?activated=1",
      );
    } catch (error) {
      showFeedback(
        "error",
        error instanceof Error ? error.message : copy.activationFailed,
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
      className="min-h-screen bg-[linear-gradient(135deg,#F7F8FD,#EEF1FA)] px-4 py-10 text-[#432A57]"
    >
      <div className="mx-auto max-w-xl rounded-[30px] border bg-white p-7 shadow-[0_25px_70px_rgba(67,82,155,.12)] sm:p-9">
        <p className="text-sm font-black text-[#A170BA]">{copy.brandLabel}</p>
        <h1 className="mt-2 text-3xl font-black">{copy.title}</h1>

        {loading ? (
          <div className="mt-7 rounded-2xl bg-[#FCF9FD] p-5 text-sm font-bold text-[#756A7A]">
            {copy.checking}
          </div>
        ) : info ? (
          <form onSubmit={submit} className="mt-7 space-y-4">
            <div className="rounded-2xl bg-[#FCF9FD] p-4 text-sm font-bold leading-7">
              <p>
                {formatFlowMessage(copy.hello, {
                  name: info.fullName || copy.helloFallback,
                })}
              </p>
              {info.email ? (
                <p dir="ltr" className="text-start text-[#806F8A]">
                  {info.email}
                </p>
              ) : null}
            </div>

            <Password
              label={copy.newPassword}
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
            />

            <Password
              label={copy.confirmPassword}
              value={confirm}
              onChange={setConfirm}
              autoComplete="new-password"
            />

            <div className="grid grid-cols-1 gap-2 text-xs font-bold text-[#77819F] sm:grid-cols-2">
              <span>• {copy.ruleMin}</span>
              <span>• {copy.ruleLetter}</span>
              <span>• {copy.ruleNumber}</span>
              <span>• {copy.ruleMatch}</span>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="h-14 w-full rounded-2xl bg-[linear-gradient(135deg,#A06DB9,#84539E)] font-black text-white transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? copy.activating : copy.activate}
            </button>
          </form>
        ) : (
          <div className="mt-7 rounded-2xl bg-[#FCF9FD] p-5 text-sm font-bold leading-7 text-[#756A7A]">
            {copy.cannotOpen}
          </div>
        )}
      </div>

      <FeedbackModal
        open={feedbackOpen}
        type={feedbackType}
        message={feedbackMessage}
        onClose={closeFeedback}
        closeLabel={closeDestination ? copy.closeLink : copy.ok}
      />
    </main>
  );
}

function Password({
  label,
  value,
  onChange,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-black">{label}</span>
      <input
        type="password"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        minLength={8}
        required
        autoComplete={autoComplete}
        className="h-14 w-full rounded-2xl border border-[#E9DDEF] bg-[#FEFCFF] px-4 font-bold outline-none focus:border-[#A170BA]"
        dir="ltr"
      />
    </label>
  );
}
