import { requirePermission } from "@/lib/auth/require-user";

export default async function MarketingProjectsComingSoonPage() {
  await requirePermission("campaigns", "view");
  return (
    <div dir="rtl" className="space-y-6">
      <section className="rounded-[30px] bg-gradient-to-br from-[#687AD1] to-[#4D61B8] p-8 text-white shadow-[0_24px_65px_rgba(74,88,162,0.22)]">
        <p className="text-sm font-bold text-white/70">المسار القادم</p>
        <h1 className="mt-2 text-3xl font-black">المشاريع التسويقية</h1>
        <p className="mt-4 max-w-3xl text-sm font-semibold leading-8 text-white/80">سيجمع هذا المسار المشاريع الداخلية ومشاريع الموردين، الخدمات التسويقية، حملات المؤثرين، الفعاليات، المهام والتسليمات، العقود، التكاليف، الفواتير والتحصيل.</p>
      </section>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {["المشاريع والجهات", "الخدمات ونطاق العمل", "المهام والفعاليات", "العقود والفواتير"].map((title) => (
          <div key={title} className="rounded-3xl border border-[#E1E5F3] bg-white p-6 shadow-sm">
            <span className="rounded-full bg-[#EEF1FF] px-3 py-1 text-xs font-black text-[#5D6FC4]">قريبًا</span>
            <h2 className="mt-4 font-black text-[#34457E]">{title}</h2>
          </div>
        ))}
      </section>
    </div>
  );
}
