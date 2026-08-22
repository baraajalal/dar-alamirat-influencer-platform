import Link from "next/link";
import { requireRole } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { transferWebsiteVouchers, updateVoucherPreparation } from "./actions";
import { VoucherSelectAll } from "@/components/dashboard/voucher-select-all";

export const dynamic = "force-dynamic";

type Issue = {
  id: string;
  payment_id: string;
  influencer_id: string;
  source_type: string;
  branch_id: string | null;
  coordinator_id: string | null;
  order_number: string | null;
  voucher_code: string | null;
  amount: number | string;
  status: string;
  expires_at: string | null;
  transferred_to_preparation_at: string | null;
  code_prepared_at: string | null;
  sent_at: string | null;
  notes: string | null;
  created_at: string;
};
type Influencer = { id: string; full_name: string; mobile_e164: string };
type Payment = { id: string; assignment_id: string };
type Assignment = { id: string; campaign_id: string; execution_type: string | null; branch_id: string | null };
type Campaign = { id: string; name: string; brand: string | null };
type Branch = { id: string; name: string };
type Platform = { id: string; assignment_id: string };
type ContentItem = { assignment_platform_id: string; post_url: string | null; publication_verified_at: string | null };

type SearchParams = {
  stage?: string;
  source?: string | string[];
  status?: string | string[];
  success?: string;
  error?: string;
};

function num(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number) {
  return new Intl.NumberFormat("ar-SA", {
    style: "currency",
    currency: "SAR",
    maximumFractionDigits: 2,
  }).format(value);
}

function normalizePhone(value: string | null | undefined) {
  let phone = String(value ?? "").replace(/\D/g, "");
  if (phone.startsWith("00")) phone = phone.slice(2);
  if (phone.startsWith("05")) phone = `966${phone.slice(1)}`;
  if (phone.startsWith("5") && phone.length === 9) phone = `966${phone}`;
  return phone;
}

function remainingDays(expiresAt: string | null) {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86_400_000));
}

function whatsappUrl(phone: string, code: string, amount: number, days: number) {
  const message = `مرحبًا 🌸
يسعدنا تقديم قسيمة إلكترونية لكم تقديرًا لتعاونكم معنا ومشاركتكم آرائكم القيّمة حول منتجاتنا ومعارضنا:

🔹 رقم القسيمة: ${code}
🔹 القيمة: ${amount.toLocaleString("ar-SA")} ريال
🔹 الصلاحية: ${days} يوم
🔹 طريقة الاستخدام: عبر الموقع الإلكتروني

(https://daralamirat.com.sa/ar/)

نقدّر وقتكم وملاحظاتكم التي تسهم في تطوير خدماتنا وتقديم الأفضل دائمًا، ونتطلع لمزيد من آرائكم وتجاربكم معنا 🤍

مع خالص الشكر والتقدير،

شركة دار الأميرات`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

const sourceLabels: Record<string, string> = {
  branch: "قسائم الفروع",
  website: "قسائم الموقع",
  coordinator_order: "قسائم الطلبات",
};

const statusLabels: Record<string, string> = {
  pending: "بانتظار الاعتماد والترحيل",
  preparing: "قيد تجهيز الكود",
  ready: "جاهزة للتوزيع",
  sent: "تم الإرسال",
  redeemed: "تم الاستخدام",
  cancelled: "ملغاة",
};

const messages: Record<string, string> = {
  transferred: "تم ترحيل قسائم الموقع المحددة إلى تجهيز القسائم.",
  updated: "تم تحديث القسيمة بنجاح.",
  select_vouchers: "حدد قسيمة موقع واحدة على الأقل.",
  website_only: "التجهيز متاح لقسائم الموقع الإلكتروني فقط.",
  invalid_voucher: "بيانات القسيمة غير صحيحة.",
  voucher_not_found: "تعذر العثور على القسيمة.",
  code_required: "أدخل كود القسيمة قبل تحويلها إلى جاهزة أو مرسلة.",
  voucher_expired: "انتهت صلاحية القسيمة ولا يمكن إرسالها.",
};

export default async function VouchersPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const params = (await searchParams) ?? {};
  await requireRole(["admin", "finance"]);
  const admin = createAdminClient();
  const stage = params.stage === "preparation" ? "preparation" : "approval";
  const sourceValues = Array.isArray(params.source)
    ? params.source
    : params.source
      ? [params.source]
      : ["branch", "website", "coordinator_order"];
  const selectedSources = sourceValues.filter((value) => ["branch", "website", "coordinator_order"].includes(value));
  const statusValues = Array.isArray(params.status)
    ? params.status
    : params.status
      ? [params.status]
      : ["preparing", "ready", "sent", "redeemed", "cancelled"];
  const selectedStatuses = statusValues.filter((value) => ["preparing", "ready", "sent", "redeemed", "cancelled"].includes(value));

  let query = admin
    .from("voucher_issues")
    .select("id,payment_id,influencer_id,source_type,branch_id,coordinator_id,order_number,voucher_code,amount,status,expires_at,transferred_to_preparation_at,code_prepared_at,sent_at,notes,created_at")
    .limit(1000);

  if (stage === "preparation") {
    query = query
      .eq("source_type", "website")
      .in("status", selectedStatuses.length ? selectedStatuses : ["preparing", "ready", "sent", "redeemed", "cancelled"])
      .order("amount", { ascending: false })
      .order("created_at", { ascending: true });
  } else {
    query = query
      .in("source_type", selectedSources.length ? selectedSources : ["branch", "website", "coordinator_order"])
      .order("created_at", { ascending: false });
  }

  const { data: issueRows, error } = await query;
  if (error) throw new Error(error.message);
  const allIssues = (issueRows ?? []) as Issue[];
  const issues = stage === "approval"
    ? allIssues.filter((issue) => issue.source_type !== "website" || issue.status === "pending")
    : allIssues;
  const eligibleWebsiteCount = stage === "approval"
    ? issues.filter((issue) => issue.source_type === "website" && issue.status === "pending").length
    : 0;

  const influencerIds = [...new Set(issues.map((row) => row.influencer_id))];
  const paymentIds = [...new Set(issues.map((row) => row.payment_id))];
  const issueBranchIds = [...new Set(issues.map((row) => row.branch_id).filter(Boolean) as string[])];

  const [{ data: influencers }, { data: payments }] = await Promise.all([
    influencerIds.length
      ? admin.from("influencers").select("id,full_name,mobile_e164").in("id", influencerIds)
      : Promise.resolve({ data: [] }),
    paymentIds.length
      ? admin.from("payments").select("id,assignment_id").in("id", paymentIds)
      : Promise.resolve({ data: [] }),
  ]);

  const paymentList = (payments ?? []) as Payment[];
  const assignmentIds = [...new Set(paymentList.map((row) => row.assignment_id))];
  const { data: assignments } = assignmentIds.length
    ? await admin.from("campaign_assignments").select("id,campaign_id,execution_type,branch_id").in("id", assignmentIds)
    : { data: [] };
  const assignmentList = (assignments ?? []) as Assignment[];
  const campaignIds = [...new Set(assignmentList.map((row) => row.campaign_id))];
  const assignmentBranchIds = assignmentList.map((row) => row.branch_id).filter(Boolean) as string[];
  const allBranchIds = [...new Set([...issueBranchIds, ...assignmentBranchIds])];

  const [{ data: campaigns }, { data: branches }, { data: platforms }] = await Promise.all([
    campaignIds.length
      ? admin.from("campaigns").select("id,name,brand").in("id", campaignIds)
      : Promise.resolve({ data: [] }),
    allBranchIds.length
      ? admin.from("branches").select("id,name").in("id", allBranchIds)
      : Promise.resolve({ data: [] }),
    assignmentIds.length
      ? admin.from("assignment_platforms").select("id,assignment_id").in("assignment_id", assignmentIds)
      : Promise.resolve({ data: [] }),
  ]);

  const platformList = (platforms ?? []) as Platform[];
  const platformIds = platformList.map((row) => row.id);
  const { data: contentItems } = platformIds.length
    ? await admin
        .from("content_items")
        .select("assignment_platform_id,post_url,publication_verified_at")
        .in("assignment_platform_id", platformIds)
        .not("post_url", "is", null)
    : { data: [] };

  const influencerMap = new Map(((influencers ?? []) as Influencer[]).map((row) => [row.id, row]));
  const paymentMap = new Map(paymentList.map((row) => [row.id, row]));
  const assignmentMap = new Map(assignmentList.map((row) => [row.id, row]));
  const campaignMap = new Map(((campaigns ?? []) as Campaign[]).map((row) => [row.id, row]));
  const branchMap = new Map(((branches ?? []) as Branch[]).map((row) => [row.id, row]));
  const platformAssignmentMap = new Map(platformList.map((row) => [row.id, row.assignment_id]));
  const publicationMap = new Map<string, string>();
  for (const item of (contentItems ?? []) as ContentItem[]) {
    const assignmentId = platformAssignmentMap.get(item.assignment_platform_id);
    if (assignmentId && item.post_url && !publicationMap.has(assignmentId)) {
      publicationMap.set(assignmentId, item.post_url);
    }
  }

  return (
    <div dir="inherit" className="space-y-6">
      <section className="rounded-[30px] bg-[linear-gradient(135deg,#9566AF,#C5A2D5)] p-7 text-white shadow-[0_24px_64px_rgba(70,86,180,.22)]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-black text-white/70">المقابل غير النقدي</p>
            <h1 className="mt-2 text-3xl font-black">إدارة القسائم الإلكترونية</h1>
            <p className="mt-3 text-sm font-bold leading-7 text-white/82">اعتماد القسائم واستعراضها، ثم تجهيز أكواد قسائم الموقع الإلكتروني فقط.</p>
          </div>
          <Link href="/dashboard/finance" className="rounded-2xl bg-white/16 px-5 py-3 text-sm font-black ring-1 ring-white/20">العودة للقسم المالي</Link>
        </div>
      </section>

      <nav className="grid gap-3 rounded-[24px] border border-[#F0E8F4] bg-white p-3 shadow-[0_12px_36px_rgba(67,82,155,.06)] sm:grid-cols-2">
        <Link href="?stage=approval" className={`rounded-2xl px-5 py-4 text-center text-sm font-black ${stage === "approval" ? "bg-[#9362AD] text-white" : "bg-[#FCF9FD] text-[#75677B]"}`}>1. اعتماد وترحيل القسائم</Link>
        <Link href="?stage=preparation" className={`rounded-2xl px-5 py-4 text-center text-sm font-black ${stage === "preparation" ? "bg-[#9362AD] text-white" : "bg-[#FCF9FD] text-[#75677B]"}`}>2. تجهيز قسائم الموقع</Link>
      </nav>

      {params.success && messages[params.success] ? <Notice tone="success" text={messages[params.success]} /> : null}
      {params.error && messages[params.error] ? <Notice tone="error" text={messages[params.error]} /> : null}

      {stage === "approval" ? (
        <>
          <form className="rounded-[24px] border border-[#F0E8F4] bg-white p-4 shadow-[0_12px_36px_rgba(67,82,155,.06)]">
            <input type="hidden" name="stage" value="approval" />
            <p className="mb-3 text-sm font-black text-[#604A70]">فلترة القسائم</p>
            <div className="flex flex-wrap items-center gap-4">
              {Object.entries(sourceLabels).map(([value, label]) => (
                <label key={value} className="flex cursor-pointer items-center gap-2 rounded-xl bg-[#FBF8FD] px-4 py-3 text-sm font-black text-[#75677B]">
                  <input type="checkbox" name="source" value={value} defaultChecked={selectedSources.includes(value)} className="h-4 w-4 accent-[#9362AD]" />
                  {label}
                </label>
              ))}
              <button className="rounded-xl bg-[#9362AD] px-5 py-3 text-sm font-black text-white">تطبيق الفلتر</button>
            </div>
          </form>

          <form action={transferWebsiteVouchers} className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-[#DDE3F5] bg-[#FCFAFD] p-4">
              <div>
                <p className="text-sm font-black text-[#3F4F7C]">الترحيل إلى تجهيز الأكواد</p>
                <p className="mt-1 text-xs font-bold text-[#8D7B95]">يمكن تحديد قسائم الموقع الإلكتروني المنتظرة فقط. قسائم الفروع والطلبات للاستعراض حاليًا.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <VoucherSelectAll eligibleCount={eligibleWebsiteCount} />
                <button className="rounded-xl bg-[#4A315C] px-5 py-3 text-sm font-black text-white">ترحيل القسائم المحددة</button>
              </div>
            </div>

            <section className="space-y-3">
              {issues.map((issue) => {
                const influencer = influencerMap.get(issue.influencer_id);
                const payment = paymentMap.get(issue.payment_id);
                const assignment = payment ? assignmentMap.get(payment.assignment_id) : undefined;
                const campaign = assignment ? campaignMap.get(assignment.campaign_id) : undefined;
                const eligible = issue.source_type === "website" && issue.status === "pending";
                return (
                  <article key={issue.id} className="grid gap-4 rounded-[24px] border border-[#F0E7F4] bg-white p-5 shadow-[0_12px_36px_rgba(67,82,155,.05)] lg:grid-cols-[auto_1.3fr_.8fr_.7fr_.6fr] lg:items-center">
                    <div className="flex items-center gap-3">
                      <input type="checkbox" name="issue_ids" value={issue.id} disabled={!eligible} data-website-voucher-select={eligible ? "true" : undefined} className="h-5 w-5 accent-[#9362AD] disabled:opacity-30" />
                      <span className={`rounded-full px-3 py-1 text-[11px] font-black ${issue.source_type === "website" ? "bg-emerald-50 text-emerald-700" : issue.source_type === "branch" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{sourceLabels[issue.source_type] ?? issue.source_type}</span>
                    </div>
                    <div>
                      <h2 className="text-base font-black text-[#4F3762]">{influencer?.full_name ?? "مؤثر"}</h2>
                      <p className="mt-1 text-xs font-bold text-[#8D7B95]" dir="ltr">{influencer?.mobile_e164 ?? "—"}</p>
                    </div>
                    <div><p className="text-xs font-black text-[#8D7B95]">الحملة</p><p className="mt-1 text-sm font-black text-[#604A70]">{campaign?.name ?? "—"}</p></div>
                    <div><p className="text-xs font-black text-[#8D7B95]">الحالة</p><p className="mt-1 text-sm font-black text-[#604A70]">{statusLabels[issue.status] ?? issue.status}</p></div>
                    <div className="lg:text-left"><p className="text-xs font-black text-[#8D7B95]">القيمة</p><p className="mt-1 text-lg font-black text-[#4A315C]">{money(num(issue.amount))}</p></div>
                  </article>
                );
              })}
              {issues.length === 0 ? <Empty text="لا توجد قسائم مطابقة للفلتر." /> : null}
            </section>
          </form>
        </>
      ) : (
        <>
          <form className="rounded-[24px] border border-[#F0E8F4] bg-white p-4 shadow-[0_12px_36px_rgba(67,82,155,.06)]">
            <input type="hidden" name="stage" value="preparation" />
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm font-black text-[#604A70]">فلترة قسائم التجهيز حسب الحالة</p>
                <p className="mt-1 text-xs font-bold text-[#8D7B95]">يمكن اختيار حالة واحدة أو عدة حالات، ثم تطبيق الفلتر.</p>
              </div>
              <button className="rounded-xl bg-[#9362AD] px-5 py-3 text-sm font-black text-white">تطبيق الفلتر</button>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {["preparing", "ready", "sent", "redeemed", "cancelled"].map((value) => (
                <label key={value} className="flex cursor-pointer items-center gap-2 rounded-xl bg-[#FBF8FD] px-4 py-3 text-sm font-black text-[#75677B]">
                  <input type="checkbox" name="status" value={value} defaultChecked={selectedStatuses.includes(value)} className="h-4 w-4 accent-[#9362AD]" />
                  {statusLabels[value]}
                </label>
              ))}
            </div>
          </form>

          <section className="overflow-hidden rounded-[26px] border border-[#F0E7F4] bg-white shadow-[0_16px_48px_rgba(67,82,155,.07)]">
          <div className="border-b border-[#F6EFF9] p-5">
            <h2 className="text-lg font-black text-[#4F3762]">تجهيز أكواد قسائم الموقع الإلكتروني</h2>
            <p className="mt-1 text-xs font-bold text-[#8D7B95]">مرتبة من أعلى مبلغ إلى الأقل. تبدأ صلاحية 30 يومًا عند إدخال الكود لأول مرة.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[1450px] w-full text-right">
              <thead className="bg-[#F7F8FC] text-xs font-black text-[#7A84A2]">
                <tr>
                  <th className="p-4">الحالة</th>
                  <th className="p-4">البلوقر</th>
                  <th className="p-4">رقم الجوال</th>
                  <th className="p-4">رابط الإعلان</th>
                  <th className="p-4">الحملة</th>
                  <th className="p-4">الفرع</th>
                  <th className="p-4">القيمة</th>
                  <th className="p-4">الكود والصلاحية</th>
                  <th className="p-4">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F6EFF9]">
                {issues.map((issue) => {
                  const influencer = influencerMap.get(issue.influencer_id);
                  const payment = paymentMap.get(issue.payment_id);
                  const assignment = payment ? assignmentMap.get(payment.assignment_id) : undefined;
                  const campaign = assignment ? campaignMap.get(assignment.campaign_id) : undefined;
                  const postUrl = assignment ? publicationMap.get(assignment.id) : undefined;
                  const branchName = assignment?.execution_type === "home"
                    ? "الموقع الإلكتروني"
                    : assignment?.branch_id
                      ? branchMap.get(assignment.branch_id)?.name ?? "—"
                      : issue.branch_id
                        ? branchMap.get(issue.branch_id)?.name ?? "—"
                        : "الموقع الإلكتروني";
                  const days = remainingDays(issue.expires_at);
                  const phone = normalizePhone(influencer?.mobile_e164);
                  const canSend = Boolean(issue.voucher_code && days !== null && days > 0 && phone);
                  const waUrl = canSend ? whatsappUrl(phone, issue.voucher_code!, num(issue.amount), days!) : "#";
                  return (
                    <tr key={issue.id} className="align-top text-sm font-bold text-[#604A70]">
                      <td className="p-4"><span className="inline-flex rounded-full bg-[#F7F0F9] px-3 py-1 text-xs font-black text-[#5368B2]">{statusLabels[issue.status] ?? issue.status}</span></td>
                      <td className="p-4 font-black text-[#4A315C]">{influencer?.full_name ?? "—"}</td>
                      <td className="p-4" dir="ltr">{influencer?.mobile_e164 ?? "—"}</td>
                      <td className="p-4">{postUrl ? <a href={postUrl} target="_blank" rel="noreferrer" className="font-black text-[#9362AD] underline">فتح الإعلان</a> : "—"}</td>
                      <td className="p-4">{campaign?.name ?? "—"}</td>
                      <td className="p-4">{branchName}</td>
                      <td className="p-4 text-base font-black text-[#4A315C]">{money(num(issue.amount))}</td>
                      <td className="p-4">
                        <form action={updateVoucherPreparation} className="min-w-[260px] space-y-2">
                          <input type="hidden" name="issue_id" value={issue.id} />
                          <input name="voucher_code" defaultValue={issue.voucher_code ?? ""} placeholder="اكتب صيغة الكود" className="w-full rounded-xl border border-[#ECE1F1] bg-white px-3 py-2.5 text-sm font-black outline-none focus:border-[#7988CE]" />
                          <select name="status" defaultValue={issue.status} className="w-full rounded-xl border border-[#ECE1F1] bg-white px-3 py-2.5 text-sm font-bold">
                            <option value="preparing">قيد تجهيز الكود</option>
                            <option value="ready">جاهزة للتوزيع</option>
                            <option value="sent">تم الإرسال</option>
                            <option value="redeemed">تم الاستخدام</option>
                            <option value="cancelled">ملغاة</option>
                          </select>
                          <input name="notes" defaultValue={issue.notes ?? ""} placeholder="ملاحظات مختصرة" className="w-full rounded-xl border border-[#ECE1F1] bg-white px-3 py-2.5 text-xs font-bold outline-none" />
                          <div className="rounded-lg bg-[#FBF8FD] px-3 py-2 text-xs font-black text-[#687394]">{days === null ? "تبدأ الصلاحية عند تجهيز الكود" : `المتبقي: ${days} يوم`}</div>
                          <button className="w-full rounded-xl bg-[#9362AD] px-3 py-2.5 text-xs font-black text-white">حفظ القسيمة</button>
                        </form>
                      </td>
                      <td className="p-4">
                        <div className="min-w-[180px] space-y-2">
                          <a href={waUrl} target="_blank" rel="noreferrer" aria-disabled={!canSend} className={`block rounded-xl px-4 py-3 text-center text-xs font-black ${canSend ? "bg-emerald-600 text-white" : "pointer-events-none bg-slate-100 text-slate-400"}`}>فتح واتساب</a>
                          <p className="text-[11px] font-bold leading-5 text-[#95849D]">بعد الإرسال الفعلي غيّر الحالة إلى «تم الإرسال» واحفظ.</p>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {issues.length === 0 ? <tr><td colSpan={9} className="p-8"><Empty text="لا توجد قسائم موقع مرحّلة للتجهيز." /></td></tr> : null}
              </tbody>
            </table>
          </div>
          </section>
        </>
      )}
    </div>
  );
}

function Notice({ tone, text }: { tone: "success" | "error"; text: string }) {
  return <div className={`rounded-2xl border p-4 text-sm font-black ${tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>{text}</div>;
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-[22px] border border-dashed border-[#E5D5EC] bg-white p-8 text-center text-sm font-black text-[#8D7B95]">{text}</div>;
}
