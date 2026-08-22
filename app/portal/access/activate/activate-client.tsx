"use client";

import { useCallback, useEffect, useState } from "react";
import FeedbackModal from "@/components/feedback-modal";

type ActivationInfo = {
  fullName: string;
  email: string;
};

type PortalAccessActivateClientProps = {
  token: string;
};

export default function PortalAccessActivateClient({ token }: PortalAccessActivateClientProps) {
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
      // replace removes the activation token from browser history.
      window.location.replace(closeDestination);
    }
  }, [closeDestination]);

  useEffect(() => {
    let cancelled = false;

    async function verifyActivationLink() {
      if (!token) {
        if (!cancelled) {
          setLoading(false);
          showFeedback("error", "رابط التفعيل غير صالح.", "/");
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

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(result.message || "تعذر التحقق من رابط التفعيل");
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
            error instanceof Error ? error.message : "تعذر التحقق من رابط التفعيل",
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
  }, [token, showFeedback]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      showFeedback("error", "رابط التفعيل غير صالح.", "/");
      return;
    }

    if (password.length < 8) {
      showFeedback("error", "كلمة المرور يجب أن تتكون من 8 أحرف على الأقل.");
      return;
    }

    if (!/[A-Za-z\u0600-\u06FF]/.test(password)) {
      showFeedback("error", "كلمة المرور يجب أن تحتوي على حرف واحد على الأقل.");
      return;
    }

    if (!/\d/.test(password)) {
      showFeedback("error", "كلمة المرور يجب أن تحتوي على رقم واحد على الأقل.");
      return;
    }

    if (password !== confirm) {
      showFeedback("error", "كلمتا المرور غير متطابقتين.");
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

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.message || "تعذر تفعيل الحساب");
      }

      showFeedback(
        "success",
        "تم تفعيل حسابك بنجاح. تم إغلاق رابط التفعيل ولن يمكن استخدامه مرة أخرى.",
        typeof result.nextPath === "string" && result.nextPath
          ? result.nextPath
          : "/login?activated=1",
      );
    } catch (error) {
      showFeedback(
        "error",
        error instanceof Error ? error.message : "تعذر تفعيل الحساب",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main
      dir="inherit"
      className="min-h-screen bg-[linear-gradient(135deg,#F7F8FD,#EEF1FA)] px-4 py-10 text-[#432A57]"
    >
      <div className="mx-auto max-w-xl rounded-[30px] border bg-white p-7 shadow-[0_25px_70px_rgba(67,82,155,.12)] sm:p-9">
        <p className="text-sm font-black text-[#A170BA]">منصة مؤثري دار الأميرات</p>
        <h1 className="mt-2 text-3xl font-black">تفعيل الحساب</h1>

        {loading ? (
          <div className="mt-7 rounded-2xl bg-[#FCF9FD] p-5 text-sm font-bold text-[#756A7A]">
            جاري التحقق من رابط التفعيل...
          </div>
        ) : info ? (
          <form onSubmit={submit} className="mt-7 space-y-4">
            <div className="rounded-2xl bg-[#FCF9FD] p-4 text-sm font-bold leading-7">
              <p>مرحبًا {info.fullName || "بك"}</p>
              {info.email ? (
                <p dir="ltr" className="text-left text-[#806F8A]">
                  {info.email}
                </p>
              ) : null}
            </div>

            <Password
              label="كلمة المرور الجديدة"
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
            />

            <Password
              label="تأكيد كلمة المرور"
              value={confirm}
              onChange={setConfirm}
              autoComplete="new-password"
            />

            <div className="grid grid-cols-1 gap-2 text-xs font-bold text-[#77819F] sm:grid-cols-2">
              <span>• 8 أحرف على الأقل</span>
              <span>• تحتوي على حرف</span>
              <span>• تحتوي على رقم</span>
              <span>• كلمتا المرور متطابقتان</span>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="h-14 w-full rounded-2xl bg-[linear-gradient(135deg,#A06DB9,#84539E)] font-black text-white transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "جاري التفعيل..." : "تفعيل الحساب"}
            </button>
          </form>
        ) : (
          <div className="mt-7 rounded-2xl bg-[#FCF9FD] p-5 text-sm font-bold leading-7 text-[#756A7A]">
            تعذر فتح رابط التفعيل. أغلق الرسالة للعودة إلى الصفحة الرئيسية.
          </div>
        )}
      </div>

      <FeedbackModal
        open={feedbackOpen}
        type={feedbackType}
        message={feedbackMessage}
        onClose={closeFeedback}
        closeLabel={closeDestination ? "إغلاق الرابط" : "حسنًا"}
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
