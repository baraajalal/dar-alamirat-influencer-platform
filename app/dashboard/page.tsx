import Link from "next/link";
import { logout } from "@/app/login/actions";
import { requireRole } from "@/lib/auth/require-user";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { profile } = await requireRole(["admin", "coordinator", "finance"]);

  return (
    <main dir="rtl" className="min-h-screen bg-[#F5F5F7] p-5 sm:p-10">
      <div className="mx-auto max-w-6xl">
        <div className="card">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold">لوحة إدارة المؤثرين</h1>
              <p className="mt-2 text-[#6B6475]">
                مرحبًا {profile.full_name} — الصلاحية: {profile.role}
              </p>
            </div>
            <form action={logout}>
              <button className="rounded-xl border border-[#DDD3E9] px-4 py-2 font-semibold">
                تسجيل الخروج
              </button>
            </form>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <Link href="/dashboard/influencers" className="choice text-right">
              <span className="block text-lg">المؤثرون</span>
              <span className="mt-1 block text-sm font-normal text-[#777]">
                الملفات والتسجيلات الجديدة
              </span>
            </Link>
            <Link href="/dashboard/access-requests" className="choice text-right">
              <span className="block text-lg">طلبات تفعيل البوابة</span>
              <span className="mt-1 block text-sm font-normal text-[#777]">
                مراجعة طلبات المؤثرين وأولوية المستحقات
              </span>
            </Link>
            <div className="choice text-right opacity-70">
              المراجعة والدفعات
              <span className="mt-1 block text-sm font-normal text-[#777]">
                سيتم نقلها في المرحلة التالية
              </span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
