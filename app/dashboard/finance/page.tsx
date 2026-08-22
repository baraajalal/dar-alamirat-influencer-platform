import Link from "next/link";
import { requireRole } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { DashboardIcon, type DashboardIconName } from "@/components/dashboard/icons";

export const dynamic = "force-dynamic";

const sections: Array<{
  href: string;
  title: string;
  description: string;
  icon: DashboardIconName;
}> = [
  {
    href: "/dashboard/finance/approvals",
    title: "الاعتمادات المالية",
    description: "اعتماد ملفات البنك ومستحقات الإعلانات وإرجاع الملاحظات للمؤثر.",
    icon: "access",
  },
  {
    href: "/dashboard/finance/transfers",
    title: "التحويلات المالية",
    description: "تجميع المستحقات في مسودات ومراجعتها وتجهيز ملفات البنك والتحويل اليدوي.",
    icon: "wallet",
  },
  {
    href: "/dashboard/finance/vouchers",
    title: "القسائم الإلكترونية",
    description: "إدارة قسائم الفروع والموقع وقسائم الطلبات التابعة للمنسقين.",
    icon: "payments",
  },
  {
    href: "/dashboard/finance/transfers/returned",
    title: "التحويلات المرتجعة",
    description: "معالجة رفض البنك وتصحيح البيانات وإعادة التحويل دون حذف المحاولة السابقة.",
    icon: "wallet",
  },
  {
    href: "/dashboard/finance/products",
    title: "تسليم المنتجات",
    description: "تجهيز وشحن وتسليم المقابل بالمنتجات مع رقم التتبع وإثبات الاستلام.",
    icon: "payments",
  },
  {
    href: "/dashboard/finance/alerts",
    title: "التنبيهات والتصعيد",
    description: "متابعة التأخير في الاعتماد والتحويل والقسائم والشحن قبل تفاقم المشكلة.",
    icon: "reports",
  },
  {
    href: "/dashboard/finance/settlements",
    title: "التسويات والمتابعة",
    description: "مطابقة المستحق مع التنفيذ وإقفال التكليفات وبدء حظر الـ45 يومًا.",
    icon: "wallet",
  },
  {
    href: "/dashboard/finance/exceptions",
    title: "مشكلات تحتاج معالجة",
    description: "كشف المبالغ الصفرية والبيانات الناقصة والتأخير وعدم تطابق الحالات.",
    icon: "reports",
  },
  {
    href: "/dashboard/finance/reports",
    title: "التقرير المالي العام",
    description: "عرض الموقف المالي والمجموعات الجاهزة والمحولة والمتأخرة.",
    icon: "reports",
  },
];

export default async function FinanceOperationsPage() {
  await requireRole(["admin", "finance"]);
  const admin = createAdminClient();

  const [bankPending, paymentPending, batchPending, vouchersPending, exceptionsPending, failedTransfers, financeAlerts] = await Promise.all([
    admin.from("influencer_financial_profiles").select("influencer_id", { count: "exact", head: true }).in("bank_profile_status", ["pending_review", "update_pending"]),
    admin.from("payments").select("id", { count: "exact", head: true }).eq("type", "bank_transfer").in("finance_review_status", ["pending", "returned"]),
    admin.from("payment_batches").select("id", { count: "exact", head: true }).in("status", ["draft", "under_review", "returned"]),
    admin.from("voucher_issues").select("id", { count: "exact", head: true }).in("status", ["pending", "preparing", "ready"]),
    admin.from("finance_exceptions").select("exception_id", { count: "exact", head: true }),
    admin.from("failed_transfer_items").select("batch_item_id", { count: "exact", head: true }).eq("can_retry", true),
    admin.from("finance_alerts").select("entity_id", { count: "exact", head: true }),
  ]);

  const stats = [
    { label: "ملفات بنك بانتظار المراجعة", value: bankPending.count ?? 0 },
    { label: "مستحقات تحتاج اعتماد", value: paymentPending.count ?? 0 },
    { label: "مسودات تحويل مفتوحة", value: batchPending.count ?? 0 },
    { label: "قسائم تحتاج إجراء", value: vouchersPending.count ?? 0 },
    { label: "مشكلات مالية مفتوحة", value: exceptionsPending.count ?? 0 },
    { label: "تحويلات مرتجعة", value: failedTransfers.count ?? 0 },
    { label: "تنبيهات متأخرة", value: financeAlerts.count ?? 0 },
  ];

  return (
    <div dir="rtl" className="space-y-6">
      <section className="overflow-hidden rounded-[32px] bg-[linear-gradient(135deg,#9566AF,#8D9BE2)] px-7 py-8 text-white shadow-[0_25px_70px_rgba(65,82,180,.22)]">
        <p className="text-sm font-black text-white/72">الإدارة المالية الداخلية</p>
        <h1 className="mt-2 text-3xl font-black">المدفوعات والمقابل</h1>
        <p className="mt-3 max-w-3xl text-sm font-bold leading-7 text-white/82">
          اعتمدي بيانات المؤثرين ومستحقات الإعلانات، جهزي مجموعات التحويل، تابعي القسائم، ثم راقبي الموقف المالي من مكان واحد.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-7">
        {stats.map((item) => (
          <article
            key={item.label}
            className="flex min-h-[150px] flex-col rounded-[24px] border border-white bg-white px-5 py-5 shadow-[0_14px_40px_rgba(67,82,155,.08)]"
          >
            <div className="flex min-h-[52px] items-start justify-center text-center">
              <p className="max-w-[13rem] text-[12px] font-black leading-5 text-[#8D7B95]">{item.label}</p>
            </div>
            <div className="my-3 h-px w-full bg-[#F1E8F5]" aria-hidden="true" />
            <div className="flex flex-1 items-end justify-center">
              <p className="text-[32px] font-black leading-none tabular-nums text-[#4A315C]">{item.value}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        {sections.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="group rounded-[28px] border border-[#F1EAF5] bg-white p-6 shadow-[0_16px_48px_rgba(67,82,155,.08)] transition hover:-translate-y-1 hover:border-[#BFC8EF]"
          >
            <div className="flex items-start gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#F7F0FA] text-[#9362AD]">
                <DashboardIcon name={section.icon} className="h-6 w-6" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-black text-[#4F3762]">{section.title}</h2>
                <p className="mt-2 text-sm font-bold leading-7 text-[#82718C]">{section.description}</p>
                <span className="mt-4 inline-flex rounded-full bg-[#F8F2FB] px-4 py-2 text-xs font-black text-[#9362AD]">فتح القسم</span>
              </div>
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}
