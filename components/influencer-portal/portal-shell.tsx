import Link from "next/link";
import Image from "next/image";
import { logout } from "@/app/login/actions";

const links = [
  { href: "/portal/dashboard", label: "الرئيسية", icon: "⌂" },
  { href: "/portal/campaigns", label: "حملاتي", icon: "✦" },
  { href: "/portal/portfolio", label: "ملف الأعمال", icon: "▣" },
  { href: "/portal/performance", label: "الأداء والتصنيف", icon: "⌁" },
  { href: "/portal/payments", label: "المستحقات", icon: "◈" },
  { href: "/portal/notifications", label: "الإشعارات", icon: "◌" },
  { href: "/portal/profile", label: "ملفي", icon: "○" },
];

export default function PortalShell({
  influencerName,
  profileCompletion,
  children,
}: {
  influencerName: string;
  profileCompletion: number;
  children: React.ReactNode;
}) {
  const completion = Math.min(100, Math.max(0, profileCompletion));

  return (
    <main className="min-h-screen bg-[#FAF7FB] text-[#4C4052]">
      <div className="mx-auto flex min-h-screen max-w-[1680px] gap-5 px-3 py-3 sm:px-4 sm:py-4 lg:px-5">
        <aside className="hidden w-[282px] shrink-0 overflow-hidden rounded-[28px] border border-[#EEE4F2] bg-white shadow-[0_18px_55px_rgba(64,36,77,.07)] lg:flex lg:flex-col">
          <div className="border-b border-[#EEE4F2] px-5 pb-5 pt-6">
            <Link href="/portal/dashboard" className="flex items-center gap-3">
              <div className="flex h-16 w-20 items-center justify-center rounded-2xl bg-[#FCF9FD] ring-1 ring-[#EEE4F2]">
                <Image src="/da-logo.png" alt="دار الأميرات" width={112} height={68} className="h-12 w-auto object-contain" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-[#9A8FA0]">مجتمع صُنّاع المحتوى</p>
                <p className="mt-1 truncate text-sm font-black text-[#302437]">{influencerName}</p>
              </div>
            </Link>
          </div>

          <nav className="flex-1 space-y-1.5 overflow-y-auto px-4 py-5">
            {links.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group flex min-h-12 items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-extrabold text-[#5D5263] transition hover:bg-[#F7F0F9] hover:text-[#5F3B6C]"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F7F0F9] text-[#8F61A0] transition group-hover:bg-[#EEDFF2] group-hover:text-[#5F3B6C]">{item.icon}</span>
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                <span className="text-[#C0B6C4]">‹</span>
              </Link>
            ))}
          </nav>

          <div className="px-4 pb-4">
            <div className="rounded-2xl border border-[#EEE4F2] bg-[#FCF9FD] p-4">
              <div className="flex items-center justify-between text-xs font-black text-[#756A7A]">
                <span>اكتمال الملف</span>
                <span className="text-[#7F568E]">{completion}%</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white ring-1 ring-[#EEE4F2]">
                <div className="h-full rounded-full bg-[linear-gradient(90deg,#B682C5,#7F568E)]" style={{ width: `${completion}%` }} />
              </div>
            </div>
            <form action={logout} className="mt-3">
              <button className="w-full rounded-2xl border border-[#E7DDEF] bg-white px-4 py-3 text-sm font-black text-[#7F568E] transition hover:bg-[#FCF9FD]">تسجيل الخروج</button>
            </form>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="mb-4 rounded-[24px] border border-[#EEE4F2] bg-white/92 px-4 py-3 shadow-[0_10px_30px_rgba(64,36,77,.055)] backdrop-blur-xl lg:hidden">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <Image src="/da-mark.png" alt="DA" width={52} height={52} className="h-11 w-11 object-contain" />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-[#9A8FA0]">مجتمع صُنّاع المحتوى</p>
                  <p className="truncate text-sm font-black text-[#302437]">{influencerName}</p>
                </div>
              </div>
              <form action={logout}><button className="rounded-xl border border-[#E7DDEF] px-3 py-2 text-xs font-black text-[#7F568E]">خروج</button></form>
            </div>
            <nav className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {links.map((item) => <Link key={item.href} href={item.href} className="shrink-0 rounded-full bg-[#F7F0F9] px-4 py-2 text-xs font-black text-[#7F568E]">{item.label}</Link>)}
            </nav>
          </header>

          <div className="relative min-h-[calc(100vh-32px)] overflow-hidden rounded-[28px] border border-[#F2EAF5] bg-[linear-gradient(180deg,rgba(255,255,255,.75),rgba(250,247,251,.55))] p-1 sm:p-2">
            <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-[#E7D6EC]/30 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -left-16 h-72 w-72 rounded-full bg-[#F0E4F4]/60 blur-3xl" />
            <div className="relative">{children}</div>
          </div>
        </div>
      </div>
    </main>
  );
}
