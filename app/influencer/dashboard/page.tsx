import { logout } from "@/app/login/actions";
import { requireRole } from "@/lib/auth/require-user";

export const dynamic = "force-dynamic";

const statusLabels: Record<string, string> = {
  pending_review: "قيد مراجعة الإدارة",
  active: "نشط",
  suspended: "موقوف",
  rejected: "مرفوض",
  unclaimed: "غير مفعل",
  invited: "تم إرسال الدعوة",
};

const paymentLabels: Record<string, string> = {
  draft: "مسودة",
  awaiting_approval: "بانتظار الاعتماد",
  ready_for_finance: "جاهز للتحويل",
  partially_paid: "مدفوع جزئيًا",
  paid: "تم الدفع",
  cancelled: "ملغي",
};

export default async function InfluencerDashboardPage() {
  const { user, profile, supabase } = await requireRole(["influencer"]);

  const { data: influencer } = await supabase
    .from("influencers")
    .select(
      "id,full_name,mobile_e164,email,city,country,account_status,archive_match_status,profile_completion,created_at",
    )
    .eq("user_id", user.id)
    .single();

  if (!influencer) {
    return (
      <main dir="rtl" className="min-h-screen bg-[#f5f7fd] p-6">
        <div className="mx-auto max-w-3xl rounded-3xl bg-white p-8 shadow-lg">
          <h1 className="text-2xl font-extrabold text-[#2f4075]">
            تعذر العثور على ملف المؤثر
          </h1>
          <p className="mt-3 text-[#6B6475]">تواصلي مع إدارة النظام.</p>
        </div>
      </main>
    );
  }

  const [{ count: socialCount }, { data: assignments }, { data: financial }] =
    await Promise.all([
      supabase
        .from("social_accounts")
        .select("id", { count: "exact", head: true })
        .eq("influencer_id", influencer.id),
      supabase
        .from("campaign_assignments")
        .select("id,status,publishing_date,campaigns(name,brand)")
        .eq("influencer_id", influencer.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("influencer_financial_profiles")
        .select("bank_name,iban,account_holder_name")
        .eq("influencer_id", influencer.id)
        .maybeSingle(),
    ]);

  const assignmentIds = (assignments ?? []).map((assignment) => assignment.id);
  const { data: payments } = assignmentIds.length
    ? await supabase
        .from("payments")
        .select("id,assignment_id,type,amount,status,paid_at,finance_notes")
        .in("assignment_id", assignmentIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  const totalPaid = (payments ?? [])
    .filter((payment) => payment.status === "paid")
    .reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);

  const totalPending = (payments ?? [])
    .filter((payment) =>
      ["awaiting_approval", "ready_for_finance", "partially_paid"].includes(
        payment.status,
      ),
    )
    .reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-[radial-gradient(circle_at_top_right,#eef1ff,#f6f7fc_45%,#f4f5f9)] p-4 sm:p-8"
    >
      <div className="mx-auto max-w-6xl space-y-5">
        <section className="rounded-[30px] bg-[linear-gradient(135deg,#5f73d5,#8e9bea)] p-6 text-white shadow-[0_22px_70px_rgba(70,90,175,0.24)] sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-white/75">بوابة المؤثر</p>
              <h1 className="mt-2 text-3xl font-black">أهلًا {profile.full_name}</h1>
              <p className="mt-3 text-sm text-white/80">
                حالة الحساب: {statusLabels[influencer.account_status] ?? influencer.account_status}
              </p>
            </div>
            <form action={logout}>
              <button className="rounded-2xl border border-white/25 bg-white/10 px-5 py-3 font-bold backdrop-blur">
                تسجيل الخروج
              </button>
            </form>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="اكتمال الملف" value={`${influencer.profile_completion ?? 0}%`} />
          <Metric label="حسابات التواصل" value={String(socialCount ?? 0)} />
          <Metric label="الحملات" value={String(assignments?.length ?? 0)} />
          <Metric label="تم دفعه" value={`${totalPaid.toLocaleString()} ر.س`} />
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[28px] bg-white p-6 shadow-[0_16px_45px_rgba(68,82,140,0.09)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-[#6676c9]">المستحقات المالية</p>
                <h2 className="mt-1 text-xl font-black text-[#304176]">
                  المدفوعات والحالة المالية
                </h2>
              </div>
              <div className="rounded-2xl bg-amber-50 px-4 py-2 text-sm font-black text-amber-700">
                قيد الإجراء: {totalPending.toLocaleString()} ر.س
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {(payments ?? []).length === 0 ? (
                <EmptyState text="لا توجد مستحقات مسجلة حاليًا." />
              ) : (
                (payments ?? []).map((payment) => (
                  <div
                    key={payment.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e7eaf7] bg-[#fbfcff] p-4"
                  >
                    <div>
                      <p className="font-black text-[#344578]">
                        {Number(payment.amount ?? 0).toLocaleString()} ر.س
                      </p>
                      <p className="mt-1 text-xs text-[#8991aa]">
                        {payment.type}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                        payment.status === "paid"
                          ? "bg-emerald-50 text-emerald-700"
                          : payment.status === "cancelled"
                            ? "bg-red-50 text-red-700"
                            : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {paymentLabels[payment.status] ?? payment.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-[28px] bg-white p-6 shadow-[0_16px_45px_rgba(68,82,140,0.09)]">
            <p className="text-sm font-bold text-[#6676c9]">بيانات التحويل</p>
            <h2 className="mt-1 text-xl font-black text-[#304176]">
              الملف المالي الآمن
            </h2>
            <p className="mt-3 text-sm leading-7 text-[#7c85a0]">
              هذه البيانات لا تظهر إلا لك وللمالية بعد تسجيل الدخول.
            </p>
            <dl className="mt-5 space-y-4">
              <Info label="اسم البنك" value={financial?.bank_name || "غير مضاف"} />
              <Info
                label="الآيبان"
                value={financial?.iban ? maskIban(financial.iban) : "غير مضاف"}
              />
              <Info
                label="صاحب الحساب"
                value={financial?.account_holder_name || "غير مضاف"}
              />
            </dl>
          </div>
        </section>

        <section className="rounded-[28px] bg-white p-6 shadow-[0_16px_45px_rgba(68,82,140,0.09)]">
          <p className="text-sm font-bold text-[#6676c9]">الحملات</p>
          <h2 className="mt-1 text-xl font-black text-[#304176]">
            التعاونات الحالية والسابقة
          </h2>
          <div className="mt-5 space-y-3">
            {(assignments ?? []).length === 0 ? (
              <EmptyState text="لا توجد حملات مرتبطة بالحساب حاليًا." />
            ) : (
              (assignments ?? []).map((assignment) => {
                const campaign = Array.isArray(assignment.campaigns)
                  ? assignment.campaigns[0]
                  : assignment.campaigns;
                return (
                  <div
                    key={assignment.id}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#e7eaf7] bg-[#fbfcff] p-4"
                  >
                    <div>
                      <p className="font-black text-[#344578]">
                        {campaign?.name || "حملة"}
                      </p>
                      <p className="mt-1 text-xs text-[#8991aa]">
                        {campaign?.brand || "دار الأميرات"}
                      </p>
                    </div>
                    <span className="rounded-full bg-[#eef1ff] px-3 py-1.5 text-xs font-bold text-[#5e72cf]">
                      {assignment.status}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] bg-white p-5 shadow-[0_14px_40px_rgba(68,82,140,0.08)]">
      <p className="text-sm text-[#7d86a1]">{label}</p>
      <p className="mt-2 text-2xl font-black text-[#304176]">{value}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-bold text-[#8d95ad]">{label}</dt>
      <dd className="mt-1 font-black text-[#344578]" dir={label === "الآيبان" ? "ltr" : "rtl"}>
        {value}
      </dd>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#dce1f4] bg-[#fafbff] px-4 py-7 text-center text-sm text-[#8790aa]">
      {text}
    </div>
  );
}

function maskIban(value: string) {
  const clean = value.replace(/\s/g, "");
  if (clean.length <= 8) return clean;
  return `${clean.slice(0, 4)} •••• •••• ${clean.slice(-4)}`;
}
