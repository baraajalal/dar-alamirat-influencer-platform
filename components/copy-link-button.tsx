"use client";
import { useState } from "react";
export default function CopyLinkButton({ value, label = "نسخ الرابط" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return <button type="button" onClick={async()=>{await navigator.clipboard.writeText(value);setCopied(true);setTimeout(()=>setCopied(false),1800);}} className="rounded-xl bg-[#6575CB] px-4 py-2 text-sm font-black text-white">{copied ? "تم النسخ" : label}</button>;
}
