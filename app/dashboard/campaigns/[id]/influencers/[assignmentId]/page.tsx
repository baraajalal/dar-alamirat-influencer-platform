import Link from "next/link";
import { notFound } from "next/navigation";
import { hasPermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import CopyGuestLink from "./copy-guest-link";
import { createGuestLink, revokeGuestLinks, reviewContentItem, reviewPublication } from "./actions";

export const dynamic = "force-dynamic";

type ContentItemRow = {
  id: string;
  sequence_no: number;
  content_type: string;
  status: string;
  post_url: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  latest_version_id: string | null;
  publication_verified_at: string | null;
};

type PlatformRow = {
  id: string;
  required_deliverables: unknown;
  social_accounts: { platform: string; username: string; profile_url: string | null } | null;
  content_items: ContentItemRow[];
};

type VersionRow = {
  id: string;
  content_item_id: string;
  version_no: number;
  file_path: string | null;
  external_url: string | null;
  original_filename: string | null;
  notes: string | null;
  review_status: string;
  submitted_at: string;
};

type ReviewRow = {
  id: string;
  content_item_id: string;
  decision: string;
  suitable_for_ads: boolean | null;
  notes: string | null;
  created_at: string;
  reviewer_id: string;
};



type SubmissionLinkRow = {
  id: string;
  is_active: boolean;
  expires_at: string;
  used_at: string | null;
  last_opened_at: string | null;
  failed_attempts: number;
  max_attempts: number;
  locked_at: string | null;
  created_at: string;
};

type PublicationRow = {
  id: string;
  content_item_id: string;
  platform: string;
  post_url: string;
  published_at: string | null;
  screenshot_path: string | null;
  submitter_notes: string | null;
  status: string;
  reviewer_id: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  submitted_at: string;
};

export default async function AssignmentManagementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; assignmentId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id: campaignId, assignmentId } = await params;
  const query = (await searchParams) ?? {};
  const { profile, supabase } = await requirePermission("campaigns", "view");
  const canManageLinks = hasPermission(profile.role, "campaigns", "update");
  const canReview = hasPermission(profile.role, "content", "approve");

  const { data: assignment, error } = await supabase
    .from("campaign_assignments")
    .select("id,campaign_id,status,execution_type,other_execution_details,requires_content,content_due_at,publishing_date,branch,attendance_at,order_number,order_code,has_contract,contract_reference,agreement_date,payment_timing,agreed_amount,currency,campaigns(id,name,brand,product,brief,hashtags,reference_links),influencers(id,full_name,mobile_e164),assignment_platforms(id,required_deliverables,social_accounts(platform,username,profile_url),content_items(id,sequence_no,content_type,status,post_url,submitted_at,approved_at,latest_version_id,publication_verified_at))")
    .eq("id", assignmentId)
    .eq("campaign_id", campaignId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!assignment) notFound();

  const platforms = (assignment.assignment_platforms ?? []) as unknown as PlatformRow[];
  const contentItems = platforms.flatMap((platform) => platform.content_items ?? []);
  const contentIds = contentItems.map((item) => item.id);
  const admin = createAdminClient();

  const [linksResult, versionsResult, reviewsResult, publicationsResult] = await Promise.all([
    admin
      .from("submission_links")
      .select("id,is_active,expires_at,used_at,last_opened_at,failed_attempts,max_attempts,locked_at,created_at")
      .eq("assignment_id", assignmentId)
      .order("created_at", { ascending: false }),
    contentIds.length
      ? admin
          .from("content_versions")
          .select("id,content_item_id,version_no,file_path,external_url,original_filename,notes,review_status,submitted_at")
          .in("content_item_id", contentIds)
          .order("version_no", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    contentIds.length
      ? admin
          .from("content_reviews")
          .select("id,content_item_id,decision,suitable_for_ads,notes,created_at,reviewer_id")
          .in("content_item_id", contentIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    contentIds.length
      ? admin
          .from("publication_submissions")
          .select("id,content_item_id,platform,post_url,published_at,screenshot_path,submitter_notes,status,reviewer_id,reviewed_at,review_notes,submitted_at")
          .in("content_item_id", contentIds)
          .order("submitted_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);

  for (const result of [linksResult, versionsResult, reviewsResult, publicationsResult]) {
    if (result.error) throw new Error(result.error.message);
  }

  const versions = (versionsResult.data ?? []) as VersionRow[];
  const reviews = (reviewsResult.data ?? []) as ReviewRow[];
  const publications = (publicationsResult.data ?? []) as PublicationRow[];
  const profileIds = Array.from(new Set([...reviews.map((item) => item.reviewer_id), ...publications.map((item) => item.reviewer_id).filter(Boolean)])) as string[];
  const { data: reviewers } = profileIds.length
    ? await admin.from("profiles").select("id,full_name").in("id", profileIds)
    : { data: [] as Array<{ id: string; full_name: string }> };
  const reviewerRows = (reviewers ?? []) as Array<{ id: string; full_name: string }>;
  const reviewerMap = new Map<string, string>(
    reviewerRows.map((item) => [item.id, item.full_name]),
  );

  const versionUrlMap = new Map<string, string>();
  const proofUrlMap = new Map<string, string>();
  await Promise.all([
    ...versions.map(async (version) => {
      if (!version.file_path) return;
      const { data } = await admin.storage.from("campaign-content").createSignedUrl(version.file_path, 60 * 60);
      if (data?.signedUrl) versionUrlMap.set(version.id, data.signedUrl);
    }),
    ...publications.map(async (publication) => {
      if (!publication.screenshot_path) return;
      const { data } = await admin.storage.from("publication-proofs").createSignedUrl(publication.screenshot_path, 60 * 60);
      if (data?.signedUrl) proofUrlMap.set(publication.id, data.signedUrl);
    }),
  ]);

  const linkRows = (linksResult.data ?? []) as unknown as SubmissionLinkRow[];
  const activeLink = linkRows.find((link) => link.is_active);
  const newToken = typeof query.new_token === "string" ? query.new_token : "";
  const newGuestPath = newToken ? `/portal/assignments/${newToken}` : "";
  const campaign = assignment.campaigns as unknown as { id: string; name: string; brand: string | null; product: string | null; brief: string | null; hashtags: string[] | null; reference_links: string[] | null } | null;
  const influencer = assignment.influencers as unknown as { id: string; full_name: string; mobile_e164: string } | null;

  return (
    <div dir="rtl" className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <Link href={`/dashboard/campaigns/${campaignId}`} className="text-sm font-black text-[#6877C8]">← العودة للحملة</Link>
          <p className="mt-4 text-xs font-black text-[#929AAF]">إدارة تكليف المؤثر</p>
          <h1 className="mt-1 text-2xl font-black text-[#35467E] sm:text-3xl">{influencer?.full_name ?? "مؤثر"} · {campaign?.name ?? "حملة"}</h1>
          <p dir="ltr" className="mt-2 text-right text-sm font-bold text-[#8A93AE]">{influencer?.mobile_e164 ?? "—"}</p>
        </div>
        <span className="w-fit rounded-full bg-[#EEF1FF] px-4 py-2 text-xs font-black text-[#596BC4]">{assignmentStatus(assignment.status)}</span>
      </div>

      {query.link_created === "1" ? <Banner tone="success">تم إنشاء رابط جديد. انسخيه الآن؛ لن يعرض النظام الرمز السري مرة أخرى بعد مغادرة الصفحة.</Banner> : null}
      {query.link_revoked === "1" ? <Banner tone="warning">تم إلغاء روابط المؤثر الحالية.</Banner> : null}
      {query.content_reviewed ? <Banner tone="success">تم حفظ قرار مراجعة المحتوى.</Banner> : null}
      {query.publication_reviewed ? <Banner tone="success">تم حفظ قرار مراجعة رابط النشر.</Banner> : null}
      {query.content_review_error === "notes_required" ? (
        <Banner tone="warning">اكتبي ملاحظات التعديل أو سبب الرفض قبل تنفيذ القرار.</Banner>
      ) : null}
      {query.publication_review_error === "notes_required" ? (
        <Banner tone="warning">اكتبي سبب إرجاع رابط النشر أو رفضه قبل تنفيذ القرار.</Banner>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="عناصر المحتوى" value={String(contentItems.length)} />
        <Metric label="المعتمد" value={String(contentItems.filter((item) => ["approved", "published"].includes(item.status)).length)} />
        <Metric label="روابط نشر معتمدة" value={String(contentItems.filter((item) => item.status === "published").length)} />
        <Metric label="المقابل" value={formatMoney(Number(assignment.agreed_amount ?? 0))} />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.65fr)]">
        <section className="space-y-5">
          <Panel title="المحتوى والمراجعات">
            <div className="space-y-5">
              {platforms.flatMap((platform) =>
                platform.content_items.map((item) => {
                  const itemVersions = versions.filter((version) => version.content_item_id === item.id);
                  const itemReviews = reviews.filter((review) => review.content_item_id === item.id);
                  const itemPublications = publications.filter((publication) => publication.content_item_id === item.id);
                  return (
                    <ContentReviewCard
                      key={item.id}
                      campaignId={campaignId}
                      assignmentId={assignmentId}
                      item={item}
                      platform={platform.social_accounts?.platform ?? "other"}
                      username={platform.social_accounts?.username ?? ""}
                      versions={itemVersions}
                      reviews={itemReviews}
                      publications={itemPublications}
                      versionUrlMap={versionUrlMap}
                      proofUrlMap={proofUrlMap}
                      reviewerMap={reviewerMap}
                      canReview={canReview}
                    />
                  );
                }),
              )}
              {!contentItems.length ? <Empty text="لا توجد عناصر محتوى في هذا التكليف." /> : null}
            </div>
          </Panel>
        </section>

        <aside className="space-y-6">
          <Panel title="رابط المؤثر الضيف">
            {newGuestPath ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="mb-3 text-sm font-black text-emerald-900">الرابط الجديد جاهز للإرسال</p>
                <CopyGuestLink path={newGuestPath} influencerName={influencer?.full_name ?? ""} campaignName={campaign?.name ?? "الحملة"} />
              </div>
            ) : null}

            {activeLink ? (
              <div className="mt-4 rounded-2xl bg-[#F8F9FF] p-4">
                <Info label="الحالة" value={activeLink.locked_at ? "موقوف بسبب المحاولات" : "نشط"} />
                <Info label="ينتهي" value={formatDateTime(activeLink.expires_at)} />
                <Info label="آخر فتح" value={formatDateTime(activeLink.last_opened_at)} />
                <Info label="المحاولات الخاطئة" value={`${activeLink.failed_attempts}/${activeLink.max_attempts}`} />
                <p className="mt-3 text-xs font-semibold leading-6 text-[#8A93AE]">لأسباب أمنية لا يمكن استرجاع الرابط السري القديم. إصدار رابط جديد يلغي الرابط الحالي.</p>
              </div>
            ) : <Empty text="لا يوجد رابط نشط لهذا التكليف." />}

            {canManageLinks ? (
              <div className="mt-4 space-y-3">
                <form action={createGuestLink} className="rounded-2xl border border-[#DDE2F3] bg-white p-4">
                  <input type="hidden" name="campaign_id" value={campaignId} />
                  <input type="hidden" name="assignment_id" value={assignmentId} />
                  <label className="block text-xs font-black text-[#667093]">مدة صلاحية الرابط</label>
                  <select name="expires_days" defaultValue="14" className="mt-2 h-11 w-full rounded-xl border border-[#D8DDF7] bg-white px-3 text-sm font-bold outline-none">
                    <option value="7">7 أيام</option>
                    <option value="14">14 يومًا</option>
                    <option value="30">30 يومًا</option>
                    <option value="60">60 يومًا</option>
                  </select>
                  <button type="submit" className="mt-3 w-full rounded-xl bg-[#6877C8] px-4 py-3 text-sm font-black text-white">{activeLink ? "إلغاء القديم وإصدار رابط جديد" : "إنشاء رابط المؤثر"}</button>
                </form>
                {activeLink ? (
                  <form action={revokeGuestLinks}>
                    <input type="hidden" name="campaign_id" value={campaignId} />
                    <input type="hidden" name="assignment_id" value={assignmentId} />
                    <button type="submit" className="w-full rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-black text-rose-700">إلغاء الرابط الحالي</button>
                  </form>
                ) : null}
              </div>
            ) : null}
          </Panel>

          <Panel title="تفاصيل التكليف">
            <Info label="نوع التعاون" value={executionLabel(assignment.execution_type)} />
            {assignment.branch ? <Info label="الفرع" value={assignment.branch} /> : null}
            {assignment.attendance_at ? <Info label="موعد الحضور" value={formatDateTime(assignment.attendance_at)} /> : null}
            {assignment.order_number ? <Info label="رقم الطلب" value={assignment.order_number} /> : null}
            {assignment.order_code ? <Info label="كود الطلب" value={assignment.order_code} /> : null}
            <Info label="تسليم المحتوى" value={formatDateTime(assignment.content_due_at)} />
            <Info label="موعد النشر" value={formatDate(assignment.publishing_date)} />
            <Info label="توقيت الدفع" value={paymentTiming(assignment.payment_timing)} />
          </Panel>

          <Panel title="معلومات الحملة">
            <p className="text-sm font-semibold leading-7 text-[#6F7898]">{campaign?.brief || "لا يوجد بريف مكتوب."}</p>
            {campaign?.hashtags?.length ? <div className="mt-4 flex flex-wrap gap-2">{campaign.hashtags.map((tag) => <span key={tag} className="rounded-full bg-[#EEF1FF] px-3 py-1.5 text-xs font-black text-[#596BC4]">{tag}</span>)}</div> : null}
          </Panel>
        </aside>
      </div>
    </div>
  );
}

function ContentReviewCard({ campaignId, assignmentId, item, platform, username, versions, reviews, publications, versionUrlMap, proofUrlMap, reviewerMap, canReview }: {
  campaignId: string;
  assignmentId: string;
  item: ContentItemRow;
  platform: string;
  username: string;
  versions: VersionRow[];
  reviews: ReviewRow[];
  publications: PublicationRow[];
  versionUrlMap: Map<string, string>;
  proofUrlMap: Map<string, string>;
  reviewerMap: Map<string, string>;
  canReview: boolean;
}) {
  return (
    <article className="overflow-hidden rounded-[22px] border border-[#E3E7F3] bg-[#FAFBFF]">
      <div className="flex flex-col gap-3 border-b border-[#E4E8F5] bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="text-xs font-black text-[#8A93AE]">{platformLabel(platform)}{username ? ` · @${username}` : ""}</p><h3 className="mt-1 font-black text-[#35467E]">{item.content_type} #{item.sequence_no}</h3></div>
        <Status status={item.status} />
      </div>
      <div className="space-y-5 p-5">
        <div>
          <p className="mb-2 text-xs font-black text-[#8A93AE]">نسخ المحتوى</p>
          <div className="space-y-2">
            {versions.map((version) => (
              <div key={version.id} className="flex flex-col justify-between gap-3 rounded-2xl border border-[#E2E6F4] bg-white p-4 sm:flex-row sm:items-center">
                <div><p className="text-sm font-black text-[#4D5A86]">الإصدار {version.version_no}</p><p className="mt-1 text-xs font-semibold text-[#929AAF]">{formatDateTime(version.submitted_at)} · {contentStatus(version.review_status)}</p>{version.notes ? <p className="mt-2 whitespace-pre-wrap text-xs font-semibold text-[#6F7898]">{version.notes}</p> : null}</div>
                <div className="flex gap-2">{versionUrlMap.get(version.id) ? <a href={versionUrlMap.get(version.id)} target="_blank" rel="noreferrer" className="rounded-xl bg-[#EEF1FF] px-3 py-2 text-xs font-black text-[#596BC4]">فتح الملف</a> : null}{version.external_url ? <a href={version.external_url} target="_blank" rel="noreferrer" className="rounded-xl bg-[#EEF1FF] px-3 py-2 text-xs font-black text-[#596BC4]">فتح الرابط</a> : null}</div>
              </div>
            ))}
            {!versions.length ? <Empty text="لم يرفع المؤثر مسودة بعد." /> : null}
          </div>
        </div>

        {reviews.length ? <div><p className="mb-2 text-xs font-black text-[#8A93AE]">سجل المراجعة</p><div className="space-y-2">{reviews.map((review) => <div key={review.id} className="rounded-2xl bg-white p-3"><div className="flex justify-between gap-3"><p className="text-xs font-black text-[#4D5A86]">{reviewDecision(review.decision)}</p><p className="text-[11px] font-bold text-[#9AA1B5]">{reviewerMap.get(review.reviewer_id) ?? "مراجع"} · {formatDateTime(review.created_at)}</p></div>{review.notes ? <p className="mt-2 whitespace-pre-wrap text-xs font-semibold leading-6 text-[#6F7898]">{review.notes}</p> : null}</div>)}</div></div> : null}

        {canReview && versions.length && ["submitted", "under_review"].includes(item.status) ? (
          <form action={reviewContentItem} className="rounded-2xl border border-[#DDE2F3] bg-white p-4">
            <input type="hidden" name="campaign_id" value={campaignId} /><input type="hidden" name="assignment_id" value={assignmentId} /><input type="hidden" name="content_item_id" value={item.id} />
            <p className="font-black text-[#4D5A86]">قرار مراجعة المحتوى</p>
            <textarea name="notes" rows={3} placeholder="ملاحظات الاعتماد اختيارية، وملاحظات التعديل أو الرفض مطلوبة" className="mt-3 w-full rounded-xl border border-[#D8DDF7] p-3 text-sm font-bold outline-none focus:border-[#6877C8]" />
            <label className="mt-3 flex items-center gap-2 text-xs font-bold text-[#667093]"><input type="checkbox" name="suitable_for_ads" value="yes" /> مناسب لإعادة الاستخدام في الإعلانات</label>
            <div className="mt-3 flex flex-wrap gap-2"><button type="submit" name="decision" value="approve" className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white">اعتماد</button><button type="submit" name="decision" value="needs_changes" className="rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-black text-white">طلب تعديل</button><button type="submit" name="decision" value="reject" className="rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-black text-white">رفض</button></div>
          </form>
        ) : null}

        <div>
          <p className="mb-2 text-xs font-black text-[#8A93AE]">روابط النشر</p>
          <div className="space-y-3">
            {publications.map((publication) => (
              <div key={publication.id} className="rounded-2xl border border-[#E2E6F4] bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-black text-[#4D5A86]">{platformLabel(publication.platform)} · {publicationState(publication.status)}</p><p className="text-xs font-bold text-[#929AAF]">{formatDateTime(publication.submitted_at)}</p></div>
                <a href={publication.post_url} target="_blank" rel="noreferrer" className="mt-3 block truncate text-sm font-bold text-[#596BC4] underline">{publication.post_url}</a>
                {publication.submitter_notes ? <p className="mt-2 whitespace-pre-wrap text-xs font-semibold text-[#6F7898]">{publication.submitter_notes}</p> : null}
                {proofUrlMap.get(publication.id) ? <a href={proofUrlMap.get(publication.id)} target="_blank" rel="noreferrer" className="mt-3 inline-block rounded-xl bg-[#EEF1FF] px-3 py-2 text-xs font-black text-[#596BC4]">فتح إثبات النشر</a> : null}
                {publication.review_notes ? <p className="mt-3 whitespace-pre-wrap rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700">{publication.review_notes}</p> : null}
                {canReview && publication.status === "submitted" ? (
                  <form action={reviewPublication} className="mt-4 border-t border-[#E8EBF5] pt-4">
                    <input type="hidden" name="campaign_id" value={campaignId} /><input type="hidden" name="assignment_id" value={assignmentId} /><input type="hidden" name="publication_id" value={publication.id} />
                    <textarea name="notes" rows={2} placeholder="سبب الإرجاع أو الرفض مطلوب" className="w-full rounded-xl border border-[#D8DDF7] p-3 text-sm font-bold outline-none focus:border-[#6877C8]" />
                    <div className="mt-3 flex flex-wrap gap-2"><button type="submit" name="decision" value="approve" className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white">اعتماد الرابط</button><button type="submit" name="decision" value="needs_changes" className="rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-black text-white">إرجاع للتصحيح</button><button type="submit" name="decision" value="reject" className="rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-black text-white">رفض</button></div>
                  </form>
                ) : null}
              </div>
            ))}
            {!publications.length ? <Empty text="لم يرسل المؤثر رابط نشر بعد." /> : null}
          </div>
        </div>
      </div>
    </article>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-[26px] border border-[#E2E6F4] bg-white/90 p-5 shadow-[0_15px_45px_rgba(67,82,155,0.07)]"><h2 className="mb-5 text-lg font-black text-[#405080]">{title}</h2>{children}</section>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-[22px] border border-[#E2E6F4] bg-white p-5"><p className="text-xs font-black text-[#929AAF]">{label}</p><p className="mt-2 text-xl font-black text-[#405080]">{value}</p></div>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="flex items-start justify-between gap-4 border-b border-[#EEF0F7] py-3 first:pt-0 last:border-0 last:pb-0"><p className="text-xs font-bold text-[#929AAF]">{label}</p><p className="text-left text-sm font-black text-[#4D5A86]">{value}</p></div>; }
function Empty({ text }: { text: string }) { return <div className="rounded-2xl border border-dashed border-[#CDD4EE] bg-[#FAFBFF] p-5 text-center text-xs font-bold text-[#929AAF]">{text}</div>; }
function Banner({ tone, children }: { tone: "success" | "warning"; children: React.ReactNode }) { return <div className={`rounded-2xl border px-5 py-4 text-sm font-black ${tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>{children}</div>; }
function Status({ status }: { status: string }) { const tone = ["approved", "published"].includes(status) ? "bg-emerald-50 text-emerald-700" : ["needs_changes", "rejected"].includes(status) ? "bg-rose-50 text-rose-700" : "bg-[#EEF1FF] text-[#596BC4]"; return <span className={`rounded-full px-3 py-1.5 text-xs font-black ${tone}`}>{contentStatus(status)}</span>; }
function assignmentStatus(value: string) { const map: Record<string,string> = { invited:"تمت الدعوة",accepted:"تم القبول",product_pending:"بانتظار المنتج",brief_pending:"بانتظار البريف",content_pending:"بانتظار المحتوى",under_review:"قيد المراجعة",needs_changes:"مطلوب تعديلات",approved:"المحتوى معتمد",payment_pending:"جاهز لإجراء الدفع",paid:"تم الدفع",closed:"مغلق",rejected:"مرفوض",cancelled:"ملغي" }; return map[value] ?? value; }
function contentStatus(value: string) { const map: Record<string,string> = { draft:"بانتظار المسودة",submitted:"تم الإرسال",under_review:"قيد المراجعة",needs_changes:"مطلوب تعديل",approved:"معتمد",rejected:"مرفوض",published:"منشور ومعتمد" }; return map[value] ?? value; }
function reviewDecision(value: string) { return value === "approve" ? "اعتماد" : value === "needs_changes" ? "طلب تعديل" : "رفض"; }
function publicationState(value: string) { return value === "approved" ? "معتمد" : value === "needs_changes" ? "أعيد للتصحيح" : value === "rejected" ? "مرفوض" : "بانتظار التحقق"; }
function platformLabel(value: string) { const map: Record<string,string> = { instagram:"إنستغرام",tiktok:"تيك توك",snapchat:"سناب شات",youtube:"يوتيوب",x:"X",facebook:"فيسبوك",other:"أخرى" }; return map[value] ?? value; }
function executionLabel(value: string | null) { return value === "home" ? "تعاون منزلي" : value === "in_branch" ? "حضور في الفرع" : value === "remote" ? "تعاون آخر" : "غير محدد"; }
function paymentTiming(value: string | null) { return value === "before_publish" ? "قبل النشر" : value === "after_publish" ? "بعد النشر" : value === "by_agreement" ? "حسب الاتفاق" : "غير محدد"; }
function formatDate(value: string | null) { if (!value) return "غير محدد"; return new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium" }).format(new Date(`${value}T12:00:00`)); }
function formatDateTime(value: string | null) { if (!value) return "غير محدد"; return new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Riyadh" }).format(new Date(value)); }
function formatMoney(value: number) { return new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR", maximumFractionDigits: 0 }).format(value); }
