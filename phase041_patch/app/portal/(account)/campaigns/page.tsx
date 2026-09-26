import { requireInfluencerAccount } from "@/lib/influencer-portal/require-influencer-account";
import { applyToCampaign, withdrawApplication } from "./actions";

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

type OpportunityRow = {
  id: string;
  name: string;
  brand: string | null;
  product: string | null;
  campaign_type: string | null;
  opportunity_type: string | null;
  opportunity_summary: string | null;
  opportunity_goal: string | null;
  application_requirements: string | null;
  brief: string | null;
  hashtags: string[] | null;
  reference_links: string[] | null;
  brief_public_url: string | null;
  opportunity_image_urls: string[] | null;
  public_compensation_mode: string;
  public_compensation_amount: number | null;
  public_compensation_max_amount: number | null;
  public_compensation_currency: string;
  public_compensation_notes: string | null;
  require_campaign_terms_acceptance: boolean;
  start_date: string | null;
  end_date: string | null;
  applications_close_at: string | null;
  max_participants: number | null;
  application_status: string | null;
  application_id: string | null;
  application_rejection_reason: string | null;
  applied_at: string | null;
  can_apply: boolean;
};

export default async function InfluencerCampaignsPage({
  searchParams,
}: {
  searchParams?: Promise<{ applied?: string; withdrawn?: string; error?: string }>;
}) {
  const query = (await searchParams) ?? {};
  const { admin, supabase, influencer } = await requireInfluencerAccount();

  const [assignmentResult, opportunityResult] = await Promise.all([
    admin
      .from("campaign_assignments")
      .select("id,status,execution_type,content_due_at,publishing_date,branch,order_number,created_at,campaigns(name,brand,product,brief,start_date,end_date)")
      .eq("influencer_id", influencer.id)
      .order("created_at", { ascending: false }),
    supabase.rpc("list_campaign_opportunities"),
  ]);

  if (assignmentResult.error) throw new Error(assignmentResult.error.message);
  if (opportunityResult.error) throw new Error(opportunityResult.error.message);

  const campaignAssignments = (assignmentResult.data ?? []) as AssignmentRow[];
  const opportunities = (opportunityResult.data ?? []) as OpportunityRow[];

  return (
    <div className="space-y-7">
      <Header
        eyebrow="المجتمع"
        title="الحملات والفرص"
        description="اطّلع على تفاصيل الحملة والمقابل قبل التقديم، ثم تابع حالة طلبك من نفس الصفحة."
      />

      {query.applied === "1" ? <Notice tone="success">تم إرسال طلب الانضمام للحملة وحفظ موافقتك على تفاصيلها.</Notice> : null}
      {query.withdrawn === "1" ? <Notice tone="neutral">تم سحب طلب الانضمام.</Notice> : null}
      {query.error ? <Notice tone="error">{errorMessage(query.error)}</Notice> : null}

      <section className="space-y-4">
        <SectionTitle title="الفرص المتاحة" description="راجع البريف والهدف والمنتجات والمقابل قبل إرسال طلب الانضمام." />
        {opportunities.length === 0 ? (
          <Empty text="لا توجد فرص مفتوحة للتقديم حاليًا." />
        ) : (
          opportunities.map((campaign) => {
            const status = campaign.application_status;
            const hashtags = campaign.hashtags ?? [];
            const references = campaign.reference_links ?? [];
            const images = campaign.opportunity_image_urls ?? [];

            return (
              <article key={campaign.id} className="overflow-hidden rounded-[30px] border border-white bg-white/95 shadow-[0_18px_50px_rgba(68,82,140,0.10)]">
                {images.length ? (
                  <div className="grid max-h-[420px] grid-cols-2 gap-1 overflow-hidden bg-[#F8F4FA] md:grid-cols-4">
                    {images.slice(0, 4).map((url, index) => (
                      <a key={`${url}-${index}`} href={url} target="_blank" rel="noopener noreferrer" className="block min-h-40 overflow-hidden bg-white">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt={`${campaign.product || campaign.name} ${index + 1}`} className="h-full w-full object-cover transition hover:scale-[1.02]" />
                      </a>
                    ))}
                  </div>
                ) : null}

                <div className="p-6">
                  <div className="flex flex-wrap items-start justify-between gap-5">
                    <div className="max-w-4xl">
                      <div className="flex flex-wrap gap-2">
                        {campaign.brand ? <Tag>{campaign.brand}</Tag> : null}
                        {campaign.product ? <Tag>{campaign.product}</Tag> : null}
                        {campaign.campaign_type ? <Tag>{campaign.campaign_type}</Tag> : null}
                        {campaign.opportunity_type ? <Tag>{opportunityTypeLabel(campaign.opportunity_type)}</Tag> : null}
                      </div>
                      <h2 className="mt-3 text-2xl font-black text-[#3D274F]">{campaign.name}</h2>
                      {campaign.opportunity_summary ? <p className="mt-2 text-sm font-semibold leading-7 text-[#7C85A0]">{campaign.opportunity_summary}</p> : null}
                    </div>
                    {status ? <ApplicationBadge status={status} /> : null}
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <Info label="نوع التعاون" value={opportunityTypeLabel(campaign.opportunity_type)} />
                    <Info label="المقابل" value={compensationLabel(campaign)} />
                    <Info label="بداية الحملة" value={formatDate(campaign.start_date)} />
                    <Info label="إغلاق التقديم" value={formatDateTime(campaign.applications_close_at)} />
                  </div>

                  <div className="mt-5 grid gap-4 lg:grid-cols-2">
                    {campaign.opportunity_goal ? <DetailBlock title="هدف الحملة">{campaign.opportunity_goal}</DetailBlock> : null}
                    {campaign.brief ? <DetailBlock title="البريف">{campaign.brief}</DetailBlock> : null}
                    {campaign.application_requirements ? <DetailBlock title="متطلبات المشاركة">{campaign.application_requirements}</DetailBlock> : null}
                    {campaign.public_compensation_notes ? <DetailBlock title="تفاصيل المقابل">{campaign.public_compensation_notes}</DetailBlock> : null}
                  </div>

                  {hashtags.length ? (
                    <div className="mt-5 rounded-2xl border border-[#EEE4F2] bg-[#FBF8FD] p-4">
                      <p className="text-xs font-black text-[#6D5677]">الهاشتاقات المطلوبة</p>
                      <div className="mt-3 flex flex-wrap gap-2">{hashtags.map((tag) => <Tag key={tag}>{tag}</Tag>)}</div>
                    </div>
                  ) : null}

                  {campaign.brief_public_url || references.length ? (
                    <div className="mt-5 flex flex-wrap gap-3">
                      {campaign.brief_public_url ? <ExternalLink href={campaign.brief_public_url}>فتح ملف البريف</ExternalLink> : null}
                      {references.map((url, index) => <ExternalLink key={`${url}-${index}`} href={url}>مرجع {index + 1}</ExternalLink>)}
                    </div>
                  ) : null}

                  {status === "rejected" ? (
                    <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold leading-7 text-rose-700">
                      <span className="font-black">سبب عدم القبول: </span>
                      {campaign.application_rejection_reason || "لم يتم تسجيل سبب. تواصل مع فريق الحملة للمزيد من التفاصيل."}
                    </div>
                  ) : null}

                  {campaign.can_apply && (!status || status === "withdrawn") ? (
                    <form action={applyToCampaign} className="mt-6 space-y-4 rounded-2xl border border-[#E9DFF0] bg-[#FDFBFE] p-4">
                      <input type="hidden" name="campaign_id" value={campaign.id} />
                      <input name="message" maxLength={1200} placeholder="رسالة اختيارية لفريق الحملة" className="h-12 w-full rounded-2xl border border-[#E9DFF0] bg-white px-4 text-sm font-bold outline-none focus:border-[#A170BA]" />
                      {campaign.require_campaign_terms_acceptance ? (
                        <label className="flex items-start gap-3 rounded-2xl bg-white p-4 text-sm font-bold leading-7 text-[#5C456B]">
                          <input name="accept_terms" type="checkbox" required className="mt-1 h-5 w-5 shrink-0" />
                          <span>أوافق على تفاصيل الحملة والبريف ومتطلبات التنفيذ والمقابل المعروض أعلاه، وأرغب في الانضمام وفق هذه الشروط.</span>
                        </label>
                      ) : null}
                      <button className="rounded-2xl bg-gradient-to-br from-[#A170BA] to-[#8C5BA5] px-6 py-3 text-sm font-black text-white">الموافقة وإرسال طلب الانضمام</button>
                    </form>
                  ) : status === "pending" || status === "shortlisted" ? (
                    <form action={withdrawApplication} className="mt-5">
                      <input type="hidden" name="application_id" value={campaign.application_id ?? ""} />
                      <button className="rounded-2xl border border-[#E7DCEB] bg-white px-5 py-3 text-sm font-black text-[#7B5B88]">سحب الطلب</button>
                    </form>
                  ) : (!campaign.can_apply && (!status || status === "withdrawn")) ? (
                    <div className="mt-5 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-600">التقديم على هذه الفرصة مغلق حاليًا.</div>
                  ) : null}
                </div>
              </article>
            );
          })
        )}
      </section>

      <section className="space-y-4">
        <SectionTitle title="حملاتي" description="التعاونات الحالية والسابقة المرتبطة بحسابك." />
        {campaignAssignments.length === 0 ? (
          <Empty text="لا توجد حملات مرتبطة بحسابك حاليًا." />
        ) : (
          campaignAssignments.map((assignment) => {
            const campaign = relation(assignment.campaigns);
            return (
              <article key={assignment.id} className="rounded-[28px] border border-white bg-white/90 p-6 shadow-[0_16px_45px_rgba(68,82,140,0.08)]">
                <div className="flex flex-wrap items-start justify-between gap-5">
                  <div>
                    <div className="flex flex-wrap gap-2">{campaign?.brand ? <Tag>{campaign.brand}</Tag> : null}{campaign?.product ? <Tag>{campaign.product}</Tag> : null}</div>
                    <h2 className="mt-3 text-xl font-black text-[#3D274F]">{campaign?.name ?? "حملة"}</h2>
                    <p className="mt-2 max-w-3xl text-sm font-semibold leading-7 text-[#7C85A0]">{campaign?.brief || "تفاصيل التكليف متاحة في رابط الحملة."}</p>
                  </div>
                  <span className="rounded-full bg-[#F7F0FA] px-4 py-2 text-xs font-black text-[#5E72CF]">{statusLabel(String(assignment.status))}</span>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <Info label="نوع التنفيذ" value={executionLabel(assignment.execution_type)} />
                  <Info label="الموقع أو الطلب" value={assignment.branch || assignment.order_number || "غير محدد"} />
                </div>
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}

function Header({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) { return <section className="rounded-[28px] bg-[linear-gradient(135deg,#9C68B9,#BE95D0)] p-6 text-white shadow-[0_20px_60px_rgba(70,90,175,0.20)]"><p className="text-sm font-black text-white/70">{eyebrow}</p><h1 className="mt-2 text-2xl font-black">{title}</h1><p className="mt-3 max-w-3xl text-sm font-semibold leading-7 text-white/78">{description}</p></section>; }
function SectionTitle({ title, description }: { title: string; description: string }) { return <div><h2 className="text-xl font-black text-[#432A57]">{title}</h2><p className="mt-1 text-sm font-semibold text-[#8A92AA]">{description}</p></div>; }
function Tag({ children }: { children: React.ReactNode }) { return <span className="rounded-full bg-[#F7F0FA] px-3 py-1.5 text-xs font-black text-[#9362AD]">{children}</span>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-[#E8EBF7] bg-[#FDFBFE] p-4"><p className="text-xs font-bold text-[#94839C]">{label}</p><p className="mt-2 text-sm font-black text-[#5C456B]">{value}</p></div>; }
function DetailBlock({ title, children }: { title: string; children: React.ReactNode }) { return <div className="rounded-2xl border border-[#EEE4F2] bg-[#FBF8FD] p-4"><p className="text-xs font-black text-[#6D5677]">{title}</p><div className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-7 text-[#66536E]">{children}</div></div>; }
function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) { return <a href={href} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-[#E2D6E8] bg-white px-4 py-2 text-xs font-black text-[#69547A] hover:bg-[#FBF8FD]">{children} ↗</a>; }
function Empty({ text }: { text: string }) { return <div className="rounded-[28px] border border-dashed border-[#EADFF0] bg-white/75 px-4 py-14 text-center text-sm text-[#8C7B94]">{text}</div>; }
function Notice({ children, tone }: { children: React.ReactNode; tone: "success" | "error" | "neutral" }) { const cls=tone==="success"?"border-emerald-200 bg-emerald-50 text-emerald-700":tone==="error"?"border-rose-200 bg-rose-50 text-rose-700":"border-slate-200 bg-slate-50 text-slate-700"; return <div className={`rounded-2xl border px-5 py-4 text-sm font-black ${cls}`}>{children}</div>; }
function ApplicationBadge({ status }: { status: string }) { const labels: Record<string,string>={pending:"بانتظار المراجعة",shortlisted:"القائمة المختصرة",accepted:"تم قبولك",rejected:"غير مقبول",withdrawn:"تم سحب الطلب"}; return <span className="rounded-full bg-[#F2F4FF] px-4 py-2 text-xs font-black text-[#5E72CF]">{labels[status]??status}</span>; }
function relation<T>(value: T | T[] | null): T | null { return Array.isArray(value) ? value[0] ?? null : value; }
function executionLabel(value: string | null) { const labels: Record<string,string>={home:"منزلي",in_branch:"حضوري في الفرع",remote:"عن بُعد",other:"أخرى"}; return value ? labels[value]??value : "غير محدد"; }
function statusLabel(value: string) { const labels: Record<string,string>={invited:"تمت الدعوة",accepted:"تم القبول",product_pending:"بانتظار المنتج",brief_pending:"بانتظار البريف",content_pending:"بانتظار المحتوى",under_review:"قيد المراجعة",needs_changes:"مطلوب تعديل",approved:"معتمد",payment_pending:"بانتظار الدفع",paid:"تم الدفع",closed:"مغلق",rejected:"مرفوض",cancelled:"ملغي"}; return labels[value]??value; }
function opportunityTypeLabel(value: string | null) { const labels: Record<string,string>={pr:"PR",paid:"مدفوعة",product:"منتجات",voucher:"قسيمة",hybrid:"مختلطة",other:"أخرى"}; return value ? labels[value]??value : "غير محدد"; }
function compensationLabel(campaign: OpportunityRow) {
  const currency = campaign.public_compensation_currency || "SAR";
  const amount = (value: number | null) => value === null ? "" : new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 2 }).format(value);
  if (campaign.public_compensation_mode === "fixed" && campaign.public_compensation_amount !== null) return `${amount(campaign.public_compensation_amount)} ${currency}`;
  if (campaign.public_compensation_mode === "range" && campaign.public_compensation_amount !== null && campaign.public_compensation_max_amount !== null) return `${amount(campaign.public_compensation_amount)} - ${amount(campaign.public_compensation_max_amount)} ${currency}`;
  if (campaign.public_compensation_mode === "negotiable") return "حسب الاتفاق";
  return campaign.opportunity_type === "pr" ? "PR / بدون مقابل مالي" : "غير محدد";
}
function formatDate(value: string | null) { return value ? new Intl.DateTimeFormat("ar-SA",{dateStyle:"medium"}).format(new Date(`${value}T12:00:00`)) : "غير محدد"; }
function formatDateTime(value: string | null) { return value ? new Intl.DateTimeFormat("ar-SA",{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Riyadh"}).format(new Date(value)) : "غير محدد"; }
function errorMessage(code: string) { const labels: Record<string,string>={unavailable:"لا يمكنك التقديم حاليًا لوجود تكليف قائم أو فترة انتظار.",full:"اكتمل الحد الأقصى لطلبات هذه الفرصة.",reviewed:"تمت مراجعة طلبك لهذه الحملة مسبقًا.",assigned:"أنت مرتبط بهذه الحملة بالفعل.",terms_required:"يجب الموافقة على تفاصيل الحملة والمقابل قبل التقديم.",withdraw_failed:"تعذر سحب الطلب في حالته الحالية.",apply_failed:"تعذر إرسال الطلب. حاول مرة أخرى أو تواصل مع الفريق."}; return labels[code]??"تعذر إكمال العملية."; }
