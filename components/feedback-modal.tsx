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
  const icon = success ? "✓" : "!";
  const resolvedTitle = title || (success ? "تم بنجاح" : "تعذر إكمال العملية");

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4 backdrop-blur-[3px]"
      style={{ background: "rgba(42, 22, 56, 0.42)" }}
      role="dialog"
      aria-modal="true"
      aria-live="assertive"
    >
      <div
        className="w-full max-w-md rounded-[30px] p-6 text-center shadow-[0_30px_100px_rgba(63,34,85,.22)] sm:p-8"
        style={{
          border: "1px solid var(--brand-200)",
          background: "linear-gradient(180deg, rgba(255,255,255,.98) 0%, var(--brand-50) 100%)",
        }}
        dir="inherit"
      >
        <div
          className="mx-auto flex h-20 w-20 items-center justify-center rounded-full text-4xl font-black"
          style={{
            background: success
              ? "linear-gradient(145deg, var(--brand-100), white)"
              : "linear-gradient(145deg, #f7ecfb, #fff)",
            color: success ? "var(--brand-700)" : "var(--brand-800)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,.75), 0 12px 30px rgba(117,74,147,.12)",
          }}
        >
          {icon}
        </div>

        <h2 className="mt-5 text-2xl font-black" style={{ color: "var(--brand-950)" }}>
          {resolvedTitle}
        </h2>

        <p className="mt-3 text-sm font-bold leading-7" style={{ color: "var(--text-secondary)" }}>
          {message}
        </p>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 h-12 w-full rounded-2xl px-5 font-black text-white transition hover:brightness-[.98]"
          style={{
            background: "var(--brand-gradient)",
            boxShadow: "0 14px 30px rgba(117,74,147,.24)",
          }}
        >
          {closeLabel}
        </button>
      </div>
    </div>
  );
}
