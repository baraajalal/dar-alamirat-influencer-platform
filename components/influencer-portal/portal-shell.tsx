import Link from "next/link";
import { logout } from "@/app/login/actions";

const links = [
  { href: "/portal/dashboard", label: "الرئيسية" },
  { href: "/portal/campaigns", label: "حملاتي" },
  { href: "/portal/portfolio", label: "ملف الأعمال" },
  { href: "/portal/performance", label: "الأداء والتصنيف" },
  { href: "/portal/payments", label: "المستحقات" },
  { href: "/portal/notifications", label: "الإشعارات" },
  { href: "/portal/profile", label: "ملفي" },
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
  return (
    <main dir="rtl" className="min-h-screen bg-[radial-gradient(circle_at_top_right,#EEF1FF,#F7F8FC_45%,#F4F5F9)] font-['Tajawal',Tahoma,Arial,sans-serif] text-[#304176]">
      <div className="mx-auto flex min-h-screen max-w-[1500px] gap-5 px-4 py-5 lg:px-6">
        <aside className="hidden w-72 shrink-0 rounded-[30px] border border-white/90 bg-white/88 p-5 shadow-[0_22px_70px_rgba(68,82,140,0.10)] backdrop-blur-xl lg:flex lg:flex-col">
          <div className="flex items-center gap-3 border-b border-[#E9ECF7] pb-5">
            <img src="/da-logo.png" alt="دار الأميرات" className="h-14 w-14 rounded-2xl object-contain" />
            <div><p className="text-xs font-black text-[#8A93AE]">بوابة المؤثر</p><p className="mt-1 max-w-40 truncate font-black text-[#344578]">{influencerName}</p></div>
          </div>
          <nav className="mt-5 space-y-2">
            {links.map((item) => <Link key={item.href} href={item.href} className="flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-black text-[#62709D] transition hover:bg-[#EEF1FF] hover:text-[#5364B8]">{item.label}<span className="text-[#A3ACCB]">←</span></Link>)}
          </nav>
          <div className="mt-auto rounded-2xl bg-[#F5F7FF] p-4">
            <div className="flex items-center justify-between text-xs font-black text-[#6676C9]"><span>اكتمال الملف</span><span>{profileCompletion}%</span></div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-[linear-gradient(90deg,#6877C8,#9AA6E7)]" style={{ width: `${Math.min(100, Math.max(0, profileCompletion))}%` }} /></div>
          </div>
          <form action={logout} className="mt-4"><button className="w-full rounded-2xl border border-[#D9DEF2] bg-white px-4 py-3 text-sm font-black text-[#6877C8]">تسجيل الخروج</button></form>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-[26px] border border-white/90 bg-white/85 px-5 py-4 shadow-[0_18px_55px_rgba(67,82,155,0.09)] backdrop-blur-xl lg:hidden">
            <div className="flex items-center gap-3"><img src="/da-logo.png" alt="دار الأميرات" className="h-12 w-12 object-contain" /><div><p className="text-xs font-black text-[#8A93AE]">بوابة المؤثر</p><p className="font-black">{influencerName}</p></div></div>
            <form action={logout}><button className="rounded-xl border border-[#D9DEF2] px-4 py-2 text-xs font-black text-[#6877C8]">خروج</button></form>
            <nav className="flex w-full gap-2 overflow-x-auto pb-1">{links.map((item) => <Link key={item.href} href={item.href} className="shrink-0 rounded-full bg-[#F0F2FF] px-4 py-2 text-xs font-black text-[#596BC4]">{item.label}</Link>)}</nav>
          </header>
          {children}
        </div>
      </div>
    </main>
  );
}
