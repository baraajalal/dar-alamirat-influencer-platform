"use client";

import { useEffect } from "react";

type FeedbackModalProps = {
  open: boolean;
  type: "success" | "error";
  title?: string;
  message: string;
  onClose: () => void;
  closeLabel?: string;
};

export default function FeedbackModal({ open, type, title, message, onClose, closeLabel = "إغلاق" }: FeedbackModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const success = type === "success";
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-live="assertive">
      <div className="w-full max-w-md rounded-[28px] border border-white/80 bg-white p-6 text-center shadow-[0_30px_100px_rgba(15,23,42,.28)] sm:p-8" dir="rtl">
        <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full text-3xl font-black ${success ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}>
          {success ? "✓" : "!"}
        </div>
        <h2 className={`mt-5 text-2xl font-black ${success ? "text-emerald-700" : "text-red-700"}`}>
          {title || (success ? "تم بنجاح" : "تعذر إكمال العملية")}
        </h2>
        <p className="mt-3 text-sm font-bold leading-7 text-slate-600">{message}</p>
        <button type="button" onClick={onClose} className={`mt-6 h-12 w-full rounded-2xl px-5 font-black text-white ${success ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}`}>
          {closeLabel}
        </button>
      </div>
    </div>
  );
}
