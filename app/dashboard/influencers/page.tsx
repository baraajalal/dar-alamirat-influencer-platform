import Link from "next/link";
import { requireRole } from "@/lib/auth/require-user";
import { reviewInfluencerRegistration } from "./actions";

export const dynamic = "force-dynamic";

const statusLabels: Record<string, string> = {
  pending_review: "قيد المراجعة",
  active: "نشط",
  rejected: "مرفوض",
  suspended: "موقوف",
  unclaimed: "بدون حساب",
};

export default async function InfluencersPage() {
  const { supabase } = await requireRole(["admin", "coordinator"]);

  const { data: influencers, error } = await supabase
    .from("influencers")
    .select(
      "id,full_name,mobile_e164,email,city,country,gender,account_status,archive_match_status,registration_source,user_id,created_at",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);

  return (
    <main dir="rtl" className="min-h-screen bg-[#F5F5F7] p-4 sm:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold">إدارة المؤثرين</h1>
            <p className="mt-2 text-[#6B6475]">
              التسجيل الذاتي هو المسار الأساسي. الإضافة اليدوية تستخدم للطوارئ
              فقط.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/dashboard"
              className="rounded-xl border border-[#DDD3E9] bg-white px-4 py-2 font-semibold"
            >
              لوحة الإدارة
            </Link>
            <Link
              href="/"
              className="rounded-xl bg-[#8E6CCB] px-4 py-2 font-semibold text-white"
            >
              فتح نموذج التسجيل
            </Link>
          </div>
        </div>

        <div className="overflow-x-auto rounded-3xl bg-white shadow-sm ring-1 ring-black/5">
          <table className="w-full min-w-[1050px] border-collapse text-sm">
            <thead className="bg-[#F6F2FB] text-[#4A3D63]">
              <tr>
                <Th>المؤثر</Th>
                <Th>التواصل</Th>
                <Th>الموقع</Th>
                <Th>الجنس</Th>
                <Th>الحساب</Th>
                <Th>الأرشيف</Th>
                <Th>المصدر</Th>
                <Th>الإجراء</Th>
              </tr>
            </thead>
            <tbody>
              {(influencers ?? []).map((influencer) => (
                <tr key={influencer.id} className="border-t border-[#F0ECF5]">
                  <Td>
                    <div className="font-extrabold">{influencer.full_name}</div>
                    <div className="mt-1 text-xs text-[#777]">
                      {new Intl.DateTimeFormat("ar-SA", {
                        dateStyle: "medium",
                      }).format(new Date(influencer.created_at))}
                    </div>
                  </Td>
                  <Td>
                    <div dir="ltr" className="text-right">
                      {influencer.mobile_e164}
                    </div>
                    <div
                      dir="ltr"
                      className="mt-1 text-right text-xs text-[#777]"
                    >
                      {influencer.email || "—"}
                    </div>
                  </Td>
                  <Td>
                    {[influencer.city, influencer.country]
                      .filter(Boolean)
                      .join("، ") || "—"}
                  </Td>
                  <Td>
                    {influencer.gender === "female"
                      ? "أنثى"
                      : influencer.gender === "male"
                        ? "ذكر"
                        : "—"}
                  </Td>
                  <Td>
                    <Badge
                      tone={
                        influencer.account_status === "active"
                          ? "green"
                          : influencer.account_status === "rejected"
                            ? "red"
                            : "amber"
                      }
                    >
                      {statusLabels[influencer.account_status] ??
                        influencer.account_status}
                    </Badge>
                    <div className="mt-1 text-xs text-[#777]">
                      {influencer.user_id ? "لديه مستخدم" : "سجل فقط"}
                    </div>
                  </Td>
                  <Td>{influencer.archive_match_status || "not_checked"}</Td>
                  <Td>{influencer.registration_source || "form"}</Td>
                  <Td>
                    {influencer.account_status === "pending_review" ? (
                      <div className="flex gap-2">
                        <form action={reviewInfluencerRegistration}>
                          <input
                            type="hidden"
                            name="influencer_id"
                            value={influencer.id}
                          />
                          <input
                            type="hidden"
                            name="decision"
                            value="approve"
                          />
                          <button className="rounded-lg bg-emerald-600 px-3 py-2 font-bold text-white">
                            اعتماد
                          </button>
                        </form>
                        <form action={reviewInfluencerRegistration}>
                          <input
                            type="hidden"
                            name="influencer_id"
                            value={influencer.id}
                          />
                          <input type="hidden" name="decision" value="reject" />
                          <button className="rounded-lg bg-red-50 px-3 py-2 font-bold text-red-700">
                            رفض
                          </button>
                        </form>
                      </div>
                    ) : (
                      <span className="text-[#777]">—</span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>

          {(influencers?.length ?? 0) === 0 && (
            <div className="p-12 text-center text-[#777]">
              لا توجد ملفات مؤثرين حتى الآن.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="whitespace-nowrap p-4 text-right">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="p-4 align-top">{children}</td>;
}
function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "green" | "red" | "amber";
}) {
  const classes =
    tone === "green"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "red"
        ? "bg-red-50 text-red-700"
        : "bg-amber-50 text-amber-800";
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${classes}`}
    >
      {children}
    </span>
  );
}
