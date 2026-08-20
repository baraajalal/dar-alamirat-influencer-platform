"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import FeedbackModal from "@/components/feedback-modal";

export default function PortalAccessActivatePage() {
  const search = useSearchParams();
  const token = search.get("token") || "";
  const [info, setInfo] = useState<{ fullName: string; email: string } | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<"success" | "error">("error");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [closeDestination, setCloseDestination] = useState<string | null>(null);

  const showFeedback = useCallback((type: "success" | "error", message: string, destination: string | null = null) => {
    setFeedbackType(type);
    setFeedbackMessage(message);
    setCloseDestination(destination);
    setFeedbackOpen(true);
  }, []);

  const closeFeedback = useCallback(() => {
    setFeedbackOpen(false);
    if (closeDestination) window.location.replace(closeDestination);
  }, [closeDestination]);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      showFeedback("error", "رابط التفعيل غير صالح.", "/");
      return;
    }

    fetch(`/api/portal-access/activate?token=${encodeURIComponent(token)}`)
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || "تعذر التحقق من الرابط");
        return result;
      })
      .then(setInfo)
      .catch((error) => {
        showFeedback("error", error instanceof Error ? error.message : "تعذر التحقق من الرابط", "/");
      })
      .finally(() => setLoading(false));
  }, [token, showFeedback]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password !== confirm) {
      showFeedback("error", "كلمتا المرور غير متطابقتين.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/portal-access/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "تعذر التفعيل");

      // The API consumes the token before this success response is returned.
      showFeedback(
        "success",
        "تم تفعيل حسابك بنجاح. تم إغلاق رابط التفعيل ولن يمكن استخدامه مرة أخرى.",
        result.nextPath || "/login?activated=1",
      );
    } catch (error) {
      showFeedback("error", error instanceof Error ? error.message : "تعذر التفعيل");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main dir="rtl" className="min-h-screen bg-[linear-gradient(135deg,#F7F8FD,#EEF1FA)] px-4 py-10 text-[#33447F]">
      <div className="mx-auto max-w-xl rounded-[30px] border bg-white p-7 shadow-[0_25px_70px_rgba(67,82,155,.12)] sm:p-9">
        <p className="text-sm font-black text-[#6877C8]">منصة مؤثري دار الأميرات</p>
        <h1 className="mt-2 text-3xl font-black">تفعيل الحساب</h1>

        {loading ? (
          <p className="mt-6 font-bold">جاري التحقق من الرابط...</p>
        ) : info ? (
          <form onSubmit={submit} className="mt-7 space-y-4">
            <div className="rounded-2xl bg-[#F6F8FD] p-4 text-sm font-bold leading-7">
              <p>مرحبًا {info.fullName}</p>
              <p dir="ltr" className="text-left text-[#7D86A7]">{info.email}</p>
            </div>
            <Password label="كلمة المرور الجديدة" value={password} onChange={setPassword} />
            <Password label="تأكيد كلمة المرور" value={confirm} onChange={setConfirm} />
            <div className="grid grid-cols-2 gap-2 text-xs font-bold text-[#77819F]">
              <span>• 8 أحرف على الأقل</span>
              <span>• تحتوي على حرف</span>
              <span>• تحتوي على رقم</span>
              <span>• متطابقة</span>
            </div>
            <button disabled={submitting} className="h-14 w-full rounded-2xl bg-[linear-gradient(135deg,#6575CB,#4F60B6)] font-black text-white disabled:opacity-60">
              {submitting ? "جاري التفعيل..." : "تفعيل الحساب"}
            </button>
          </form>
        ) : (
          <div className="mt-7 rounded-2xl bg-[#F6F8FD] p-5 text-sm font-bold leading-7 text-[#68738F]">
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

function Password({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-black">{label}</span>
      <input
        type="password"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        minLength={8}
        required
        className="h-14 w-full rounded-2xl border border-[#D9DEF0] bg-[#FBFCFF] px-4 font-bold outline-none focus:border-[#6877C8]"
        dir="ltr"
      />
    </label>
  );
}
