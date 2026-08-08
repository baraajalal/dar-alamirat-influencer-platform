"use client";

import { useEffect, useState } from "react";

export default function CopyGuestLink({ path, influencerName, campaignName }: { path: string; influencerName: string; campaignName: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Keep the one-time raw token out of browser history after the page has rendered it.
    if (window.location.search.includes("new_token=")) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  function absoluteLink() {
    if (path.startsWith("http://") || path.startsWith("https://")) return path;
    return `${window.location.origin}${path.startsWith("/") ? path : `/${path}`}`;
  }

  async function copy() {
    await navigator.clipboard.writeText(absoluteLink());
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function openWhatsApp() {
    const message = `أهلًا ${influencerName}، تم إضافتك إلى حملة ${campaignName}. من خلال الرابط التالي يمكنك الاطلاع على المطلوب، رفع المحتوى وإضافة روابط النشر:\n${absoluteLink()}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="space-y-3">
      <input readOnly dir="ltr" value={path} className="h-12 w-full rounded-xl border border-emerald-200 bg-white px-4 text-left text-xs font-bold text-emerald-900" />
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={copy} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white">
          {copied ? "تم النسخ ✓" : "نسخ الرابط"}
        </button>
        <button type="button" onClick={openWhatsApp} className="rounded-xl border border-emerald-300 bg-white px-4 py-2.5 text-sm font-black text-emerald-700">
          إرسال عبر واتساب
        </button>
      </div>
    </div>
  );
}
