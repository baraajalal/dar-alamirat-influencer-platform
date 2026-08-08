import { requireInfluencerAccount } from "@/lib/influencer-portal/require-influencer-account";

type CampaignRow = {
  name: string;
  brand: string | null;
  product: string | null;
  brief: string | null;
  start_date: string | null;
  end_date: string | null;
};

type AssignmentRow = {
  id: string;
  status: string;
  execution_type: string | null;
  content_due_at: string | null;
  publishing_date: string | null;
  branch: string | null;
  order_number: string | null;
  created_at: string;
  campaigns: CampaignRow | CampaignRow[] | null;
};

export default async function InfluencerCampaignsPage() {
  const { admin, influencer } = await requireInfluencerAccount();
  const { data: assignments } = await admin
    .from("campaign_assignments")
    .select(
      "id,status,execution_type,content_due_at,publishing_date,branch,order_number,created_at,campaigns(name,brand,product,brief,start_date,end_date)",
    )
    .eq("influencer_id", influencer.id)
    .order("created_at", { ascending: false });

  const campaignAssignments = (assignments ?? []) as AssignmentRow[];

  return (
    <div className="space-y-5">
      <Header
        eyebrow="حملاتي"
        title="التعاونات الحالية والسابقة"
        description="جميع الحملات المرتبطة بحسابك، مع مواعيد التسليم والنشر وحالة كل تكليف."
      />

      <section className="space-y-4">
        {campaignAssignments.length === 0 ? (
          <Empty text="لا توجد حملات مرتبطة بحسابك حاليًا." />
        ) : (
          campaignAssignments.map((assignment) => {
            const campaign = relation(assignment.campaigns);
            return (
              <article
                key={assignment.id}
                className="rounded-[28px] border border-white bg-white/90 p-6 shadow-[0_16px_45px_rgba(68,82,140,0.08)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-5">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      {campaign?.brand ? <Tag>{campaign.brand}</Tag> : null}
                      {campaign?.product ? <Tag>{campaign.product}</Tag> : null}
                    </div>
                    <h2 className="mt-3 text-xl font-black text-[#304176]">
                      {campaign?.name ?? "حملة"}
                    </h2>
                    <p className="mt-2 max-w-3xl text-sm font-semibold leading-7 text-[#7C85A0]">
                      {campaign?.brief || "تفاصيل التكليف متاحة في رابط الحملة."}
                    </p>
                  </div>
                  <span className="rounded-full bg-[#EEF1FF] px-4 py-2 text-xs font-black text-[#5E72CF]">
                    {statusLabel(String(assignment.status))}
                  </span>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <Info label="نوع التنفيذ" value={executionLabel(assignment.execution_type)} />
                  <Info label="موعد المحتوى" value={formatDate(assignment.content_due_at)} />
                  <Info label="موعد النشر" value={formatDate(assignment.publishing_date)} />
                  <Info
                    label="الموقع أو الطلب"
                    value={assignment.branch || assignment.order_number || "غير محدد"}
                  />
                </div>
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}

function Header({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <section className="rounded-[28px] bg-[linear-gradient(135deg,#5F73D5,#8290E2)] p-6 text-white shadow-[0_20px_60px_rgba(70,90,175,0.20)]">
      <p className="text-sm font-black text-white/70">{eyebrow}</p>
      <h1 className="mt-2 text-2xl font-black">{title}</h1>
      <p className="mt-3 max-w-3xl text-sm font-semibold leading-7 text-white/78">
        {description}
      </p>
    </section>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-[#EEF1FF] px-3 py-1.5 text-xs font-black text-[#596BC4]">
      {children}
    </span>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#E8EBF7] bg-[#FAFBFF] p-4">
      <p className="text-xs font-bold text-[#9199B3]">{label}</p>
      <p className="mt-2 text-sm font-black text-[#465681]">{value}</p>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-[28px] border border-dashed border-[#DCE1F4] bg-white/75 px-4 py-14 text-center text-sm text-[#8790AA]">
      {text}
    </div>
  );
}

function relation<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function formatDate(value: string | null) {
  if (!value) return "غير محدد";
  return new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium" }).format(
    new Date(value),
  );
}

function executionLabel(value: string | null) {
  const labels: Record<string, string> = {
    home: "منزلي",
    in_branch: "حضوري في الفرع",
    remote: "عن بُعد",
    other: "أخرى",
  };
  return value ? labels[value] ?? value : "غير محدد";
}

function statusLabel(value: string) {
  const labels: Record<string, string> = {
    invited: "تمت الدعوة",
    accepted: "تم القبول",
    product_pending: "بانتظار المنتج",
    brief_pending: "بانتظار البريف",
    content_pending: "بانتظار المحتوى",
    under_review: "قيد المراجعة",
    needs_changes: "مطلوب تعديل",
    approved: "معتمد",
    payment_pending: "بانتظار الدفع",
    paid: "تم الدفع",
    closed: "مغلق",
    rejected: "مرفوض",
    cancelled: "ملغي",
  };
  return labels[value] ?? value;
}
