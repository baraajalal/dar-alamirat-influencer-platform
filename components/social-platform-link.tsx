type Props = {
  platform?: string | null;
  platformLabel?: string | null;
  url?: string | null;
  compact?: boolean;
};

const platformMeta: Record<string, { short: string; label: string }> = {
  tiktok: { short: "TT", label: "TikTok" },
  instagram: { short: "IG", label: "Instagram" },
  snapchat: { short: "SC", label: "Snapchat" },
  youtube: { short: "YT", label: "YouTube" },
  x: { short: "X", label: "X" },
  twitter: { short: "X", label: "X" },
  facebook: { short: "FB", label: "Facebook" },
  other: { short: "+", label: "منصة أخرى" },
};

function normalizeProfileUrl(value?: string | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

export default function SocialPlatformLink({ platform, platformLabel, url, compact = false }: Props) {
  const key = String(platform ?? "other").toLowerCase();
  const meta = platformMeta[key] ?? { short: key.slice(0, 2).toUpperCase() || "+", label: platform || "منصة" };
  const label = key === "other" ? platformLabel || meta.label : meta.label;
  const href = normalizeProfileUrl(url);

  if (!href) {
    return (
      <span className="inline-flex items-center gap-2 font-black text-[#5363AA]">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EEF1FF] text-[11px] font-black text-[#5668BE]">{meta.short}</span>
        {!compact ? <span>{label}</span> : null}
      </span>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={`فتح حساب ${label}`}
      aria-label={`فتح حساب ${label}`}
      className="group inline-flex items-center gap-2 font-black text-[#5363AA] transition hover:text-[#4053A8]"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EEF1FF] text-[11px] font-black text-[#5668BE] ring-1 ring-[#DEE4FA] transition group-hover:-translate-y-0.5 group-hover:bg-[#E5E9FF] group-hover:shadow-sm">
        {meta.short}
      </span>
      {!compact ? <span className="group-hover:underline">{label}</span> : null}
      <span aria-hidden="true" className="text-xs opacity-60 transition group-hover:translate-x-[-2px] group-hover:opacity-100">↗</span>
    </a>
  );
}
