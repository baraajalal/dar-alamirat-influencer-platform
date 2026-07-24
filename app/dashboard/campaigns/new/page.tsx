import Image from "next/image";
import Link from "next/link";
import { requireRole } from "@/lib/auth/require-user";
import CampaignForm from "./campaign-form";

export const dynamic = "force-dynamic";

export default async function NewCampaignPage() {
  const { profile, supabase } = await requireRole(["admin", "coordinator"]);

  const { data: managers, error } = await supabase
    .from("profiles")
    .select("id,full_name,role")
    .in("role", ["admin", "coordinator"])
    .eq("is_active", true)
    .order("full_name");

  if (error) throw new Error(error.message);

  return (
    <main dir="rtl" className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_8%_12%,rgba(216,221,247,0.82),transparent_27%),radial-gradient(circle_at_93%_85%,rgba(169,185,230,0.35),transparent_25%),linear-gradient(135deg,#FDFDFF_0%,#F6F7FC_48%,#EFF2FB_100%)] font-['Tajawal',Tahoma,Arial,sans-serif] text-[#33447F]">
      <DecorativeBackground />

      <header className="relative z-20 border-b border-white/80 bg-white/78 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/campaigns" className="rounded-2xl border border-[#D8DDF7] bg-white px-4 py-3 text-sm font-black text-[#5B6DC3] transition hover:bg-[#F4F6FF]">
              العودة للحملات
            </Link>
            <span className="hidden rounded-2xl bg-[#F2F4FF] px-4 py-3 text-xs font-black text-[#6978C8] sm:inline-flex">العربية</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-left sm:block">
              <p className="text-sm font-black text-[#33447F]">إنشاء حملة جديدة</p>
              <p className="text-xs text-[#8991AB]">Campaign Management</p>
            </div>
            <div className="flex h-14 w-24 items-center justify-center rounded-2xl bg-[#6877C8] p-2 shadow-[0_10px_25px_rgba(104,119,200,0.25)]">
              <Image src="/da-logo.png" alt="دار الأميرات" width={110} height={55} className="h-10 w-auto object-contain" priority />
            </div>
          </div>
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-[1320px] px-4 py-8 sm:px-6 lg:px-8">
        <section className="mb-7 overflow-hidden rounded-[30px] bg-[linear-gradient(135deg,#6877C8_0%,#5A6BC1_52%,#8794DE_100%)] p-6 text-white shadow-[0_24px_65px_rgba(74,88,162,0.25)] sm:p-8">
          <div className="relative z-10 flex flex-col justify-between gap-7 lg:flex-row lg:items-center">
            <div>
              <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-black backdrop-blur-lg">وحدة إدارة الحملات</span>
              <h1 className="mt-4 text-3xl font-black leading-tight sm:text-4xl">ابدئي الحملة من بريف واضح</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/78">بعد إنشاء الحملة سنربط المؤثرين، المنصات، المحتوى المطلوب والمقابل المالي دون تكرار البيانات.</p>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center text-xs font-black sm:gap-3">
              {[
                ["01", "البيانات"],
                ["02", "المواعيد"],
                ["03", "الحالة"],
                ["04", "التفاصيل"],
              ].map(([number, label]) => (
                <div key={number} className="rounded-2xl border border-white/15 bg-white/10 px-3 py-3 backdrop-blur-lg">
                  <span className="block text-lg">{number}</span>
                  <span className="mt-1 block text-white/70">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <CampaignForm
          managers={managers ?? []}
          currentUserId={profile.id}
          currentUserRole={profile.role}
        />
      </div>
    </main>
  );
}

function DecorativeBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -left-24 top-24 h-80 w-80 rounded-full border-[44px] border-white/45" />
      <div className="absolute -bottom-28 right-10 h-96 w-96 rounded-full border-[55px] border-[#D8DDF7]/25" />
      <span className="absolute right-[8%] top-28 h-2.5 w-2.5 rounded-full bg-[#F7D27A] shadow-[0_0_12px_rgba(247,210,122,0.7)]" />
      <span className="absolute right-[12%] top-36 h-1.5 w-1.5 rounded-full bg-[#D0AD56]" />
    </div>
  );
}
