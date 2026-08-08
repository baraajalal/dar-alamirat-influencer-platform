"use client";

import Image from "next/image";
import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type VersionRow = {
  id: string;
  version_no: number;
  external_url: string | null;
  original_filename: string | null;
  notes: string | null;
  review_status: string;
  submitted_at: string;
  fileUrl: string | null;
};

type ReviewRow = {
  id: string;
  decision: string;
  notes: string | null;
  created_at: string;
};

type PublicationRow = {
  id: string;
  platform: string;
  post_url: string;
  published_at: string | null;
  submitter_notes: string | null;
  status: string;
  review_notes: string | null;
  submitted_at: string;
  screenshotUrl: string | null;
};

type PaymentAccountStatus = {
  required: boolean;
  hasAccount: boolean;
  hasSubmittedPublication?: boolean;
  bankProfileStatus: string;
  bankConfirmed: boolean;
  shouldPrompt: boolean;
  completionPath: string;
};

type ContentItem = {
  id: string;
  sequence_no: number;
  content_type: string;
  status: string;
  post_url: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  versions: VersionRow[];
  reviews: ReviewRow[];
  publications: PublicationRow[];
};

type AssignmentPayload = {
  id: string;
  status: string;
  execution_type: string | null;
  other_execution_details: string | null;
  requires_content: boolean;
  content_due_at: string | null;
  publishing_date: string | null;
  branch: string | null;
  attendance_at: string | null;
  order_number: string | null;
  order_code: string | null;
  has_contract: boolean;
  contract_reference: string | null;
  agreement_date: string | null;
  payment_timing: string | null;
  agreed_amount: number | null;
  currency: string | null;
  campaigns: {
    id: string;
    name: string;
    brand: string | null;
    product: string | null;
    campaign_type: string | null;
    brief: string | null;
    start_date: string | null;
    end_date: string | null;
    hashtags: string[] | null;
    reference_links: string[] | null;
  } | null;
  influencers: { id: string; full_name: string; mobile_e164: string } | null;
  platforms: Array<{
    id: string;
    requiredDeliverables: unknown;
    socialAccount: {
      id: string;
      platform: string;
      username: string;
      profile_url: string | null;
    } | null;
    contentItems: ContentItem[];
  }>;
  compensations: Array<{
    id: string;
    type: string;
    amount: number | null;
    voucher_source: string | null;
    voucher_branch: string | null;
    product_description: string | null;
    product_reference_value: number | null;
    expected_payment_at: string | null;
  }>;
  payments: Array<{
    id: string;
    type: string;
    status: string;
    expected_amount: number | null;
    paid_amount: number | null;
    due_at: string | null;
    paid_at: string | null;
  }>;
  paymentAccount: PaymentAccountStatus;
};

const statusLabels: Record<string, string> = {
  draft: "بانتظار رفع المسودة",
  submitted: "تم الإرسال للمراجعة",
  under_review: "قيد المراجعة",
  needs_changes: "مطلوب تعديل",
  approved: "معتمد وجاهز للنشر",
  rejected: "مرفوض",
  published: "تم اعتماد النشر",
};

const assignmentLabels: Record<string, string> = {
  invited: "تمت الدعوة",
  accepted: "تم القبول",
  product_pending: "بانتظار المنتج",
  brief_pending: "بانتظار البريف",
  content_pending: "بانتظار المحتوى",
  under_review: "قيد المراجعة",
  needs_changes: "مطلوب تعديلات",
  approved: "المحتوى معتمد",
  payment_pending: "بانتظار الدفع",
  paid: "تم الدفع",
  closed: "مغلق",
  rejected: "مرفوض",
  cancelled: "ملغي",
};

const platformLabels: Record<string, string> = {
  instagram: "إنستغرام",
  tiktok: "تيك توك",
  snapchat: "سناب شات",
  youtube: "يوتيوب",
  x: "X",
  facebook: "فيسبوك",
  other: "أخرى",
};

const compensationLabels: Record<string, string> = {
  bank_transfer: "تحويل بنكي",
  voucher: "قسيمة مشتريات",
  product: "منتجات",
  commission: "عمولة",
  other: "مقابل آخر",
};

export default function GuestAssignmentClient({ token }: { token: string }) {
  const [assignment, setAssignment] = useState<AssignmentPayload | null>(null);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [lastFour, setLastFour] = useState("");
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [accountPrompt, setAccountPrompt] = useState<PaymentAccountStatus | null>(null);

  const loadAssignment = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/guest-portal/assignment?token=${encodeURIComponent(token)}`, {
        cache: "no-store",
      });
      const result = await response.json();
      if (response.status === 401) {
        setNeedsVerification(true);
        setAssignment(null);
        return;
      }
      if (!response.ok) throw new Error(result.message || "تعذر تحميل التكليف.");
      setAssignment(result.assignment);
      setAccountPrompt(result.assignment?.paymentAccount?.shouldPrompt ? result.assignment.paymentAccount : null);
      setNeedsVerification(false);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "تعذر تحميل التكليف.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialAssignment() {
      try {
        const response = await fetch(
          `/api/guest-portal/assignment?token=${encodeURIComponent(token)}`,
          { cache: "no-store" },
        );
        const result = await response.json();
        if (cancelled) return;

        if (response.status === 401) {
          setNeedsVerification(true);
          setAssignment(null);
          return;
        }
        if (!response.ok) throw new Error(result.message || "تعذر تحميل التكليف.");

        setAssignment(result.assignment);
        setAccountPrompt(result.assignment?.paymentAccount?.shouldPrompt ? result.assignment.paymentAccount : null);
        setNeedsVerification(false);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "تعذر تحميل التكليف.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadInitialAssignment();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setVerifying(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/guest-portal/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, lastFour }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "تعذر التحقق.");
      setMessage(result.message || "تم التحقق بنجاح.");
      await loadAssignment();
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : "تعذر التحقق.");
    } finally {
      setVerifying(false);
    }
  }

  const allItems = useMemo(
    () => assignment?.platforms.flatMap((platform) => platform.contentItems) ?? [],
    [assignment],
  );
  const approvedCount = allItems.filter((item) => ["approved", "published"].includes(item.status)).length;
  const publishedCount = allItems.filter((item) => item.status === "published").length;

  function handlePublicationAccountRequirement(status: PaymentAccountStatus | null) {
    if (status?.shouldPrompt) setAccountPrompt(status);
  }

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-[radial-gradient(circle_at_8%_10%,rgba(216,221,247,0.82),transparent_30%),radial-gradient(circle_at_90%_84%,rgba(169,185,230,0.42),transparent_28%),linear-gradient(135deg,#FDFDFF,#F4F6FC)] px-4 py-5 font-['Tajawal',Tahoma,Arial,sans-serif] text-[#33447F] sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-6xl">
        <header className="mb-5 flex items-center justify-between rounded-[24px] border border-white/90 bg-white/80 px-5 py-4 shadow-[0_18px_55px_rgba(67,82,155,0.11)] backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[linear-gradient(145deg,#7180D2,#5667BD)] p-2 shadow-lg">
              <Image src="/da-logo.png" alt="دار الأميرات" width={52} height={52} className="h-full w-full object-contain" priority />
            </div>
            <div>
              <p className="text-xs font-black text-[#8A93B2]">بوابة المؤثر الضيف</p>
              <p className="mt-1 font-black text-[#405080]">دار الأميرات</p>
            </div>
          </div>
          {assignment ? (
            <span className="rounded-full bg-[#EEF1FF] px-3 py-2 text-xs font-black text-[#596BC4]">
              {assignmentLabels[assignment.status] ?? assignment.status}
            </span>
          ) : null}
        </header>

        {message ? <Notice tone="success">{message}</Notice> : null}
        {error ? <Notice tone="error">{error}</Notice> : null}

        {loading ? <LoadingCard /> : null}

        {!loading && needsVerification ? (
          <section className="mx-auto mt-12 max-w-xl overflow-hidden rounded-[32px] border border-white bg-white/88 shadow-[0_28px_90px_rgba(67,82,155,0.18)] backdrop-blur-xl">
            <div className="bg-[linear-gradient(145deg,#7180D2,#5667BD)] px-7 py-8 text-white">
              <p className="text-sm font-black text-white/70">تحقق آمن</p>
              <h1 className="mt-2 text-2xl font-black">أدخلي آخر 4 أرقام من جوالك</h1>
              <p className="mt-3 text-sm font-semibold leading-7 text-white/78">
                يستخدم التحقق للتأكد أن رابط الحملة مفتوح من المؤثر الصحيح، ولا يتطلب إنشاء حساب.
              </p>
            </div>
            <form onSubmit={verify} className="space-y-5 p-7">
              <label className="block">
                <span className="mb-2 block text-sm font-black text-[#52608B]">آخر 4 أرقام</span>
                <input
                  value={lastFour}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setLastFour(event.target.value.replace(/\D/g, "").slice(0, 4))
                  }
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={4}
                  required
                  className="h-16 w-full rounded-2xl border border-[#D8DDF7] bg-[#FAFBFF] px-5 text-center text-2xl font-black tracking-[0.5em] outline-none transition focus:border-[#6877C8] focus:ring-4 focus:ring-[#6877C8]/10"
                  placeholder="••••"
                />
              </label>
              <button
                type="submit"
                disabled={verifying || lastFour.length !== 4}
                className="h-14 w-full rounded-2xl bg-[linear-gradient(135deg,#6877C8,#5263B9)] font-black text-white shadow-[0_15px_28px_rgba(82,99,185,0.24)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {verifying ? "جاري التحقق..." : "دخول إلى التكليف"}
              </button>
            </form>
          </section>
        ) : null}

        {!loading && assignment ? (
          <div className="space-y-6">
            <CampaignHero assignment={assignment} approvedCount={approvedCount} publishedCount={publishedCount} total={allItems.length} />

            {accountPrompt?.shouldPrompt ? (
              <AccountCompletionBanner token={token} status={accountPrompt} />
            ) : null}

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.7fr)]">
              <section className="space-y-5">
                <div>
                  <p className="text-xs font-black text-[#9098B0]">المحتوى المطلوب</p>
                  <h2 className="mt-1 text-xl font-black text-[#35467E]">المسودات والتعديلات وروابط النشر</h2>
                </div>

                {assignment.platforms.flatMap((platform) =>
                  platform.contentItems.map((item) => (
                    <ContentCard
                      key={item.id}
                      token={token}
                      item={item}
                      platform={platform.socialAccount?.platform ?? "other"}
                      username={platform.socialAccount?.username ?? ""}
                      onDone={loadAssignment}
                      onAccountRequired={handlePublicationAccountRequirement}
                    />
                  )),
                )}

                {allItems.length === 0 ? (
                  <div className="rounded-[24px] border border-dashed border-[#CDD4EE] bg-white/75 p-8 text-center text-sm font-bold text-[#8A93AE]">
                    لا توجد عناصر محتوى مطلوبة في هذا التكليف.
                  </div>
                ) : null}
              </section>

              <aside className="space-y-5">
                <InfoPanel title="تفاصيل التنفيذ">
                  <InfoRow label="نوع التعاون" value={executionLabel(assignment.execution_type)} />
                  {assignment.branch ? <InfoRow label="الفرع" value={assignment.branch} /> : null}
                  {assignment.attendance_at ? <InfoRow label="موعد الحضور" value={formatDateTime(assignment.attendance_at)} /> : null}
                  {assignment.order_number ? <InfoRow label="رقم الطلب" value={assignment.order_number} /> : null}
                  {assignment.order_code ? <InfoRow label="كود الطلب" value={assignment.order_code} /> : null}
                  <InfoRow label="موعد تسليم المحتوى" value={formatDateTime(assignment.content_due_at)} />
                  <InfoRow label="موعد النشر" value={formatDate(assignment.publishing_date)} />
                </InfoPanel>

                <InfoPanel title="المقابل والمستحقات">
                  {assignment.compensations.map((compensation) => (
                    <div key={compensation.id} className="rounded-2xl bg-[#F8F9FF] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-black text-[#4D5A86]">{compensationLabels[compensation.type] ?? compensation.type}</p>
                        <p className="text-sm font-black text-[#596BC4]">
                          {compensation.type === "product"
                            ? formatMoney(compensation.product_reference_value)
                            : formatMoney(compensation.amount)}
                        </p>
                      </div>
                      {compensation.product_description ? <p className="mt-2 text-xs font-semibold leading-6 text-[#7D86A3]">{compensation.product_description}</p> : null}
                    </div>
                  ))}
                  {assignment.compensations.length === 0 ? <p className="text-sm font-bold text-[#929AAF]">لا يوجد مقابل مسجل.</p> : null}
                  <InfoRow label="توقيت الدفع" value={paymentTimingLabel(assignment.payment_timing)} />
                  <InfoRow label="حالة الدفع" value={paymentSummary(assignment.payments)} />
                </InfoPanel>

                {assignment.campaigns?.hashtags?.length ? (
                  <InfoPanel title="الهاشتاقات">
                    <div className="flex flex-wrap gap-2">
                      {assignment.campaigns?.hashtags?.map((tag) => (
                        <span key={tag} className="rounded-full bg-[#EEF1FF] px-3 py-1.5 text-xs font-black text-[#596BC4]">{tag}</span>
                      ))}
                    </div>
                  </InfoPanel>
                ) : null}

                {assignment.campaigns?.reference_links?.length ? (
                  <InfoPanel title="المراجع والبريف">
                    <div className="space-y-2">
                      {assignment.campaigns?.reference_links?.map((link, index) => (
                        <a key={link} href={link} target="_blank" rel="noreferrer" className="block truncate rounded-xl bg-[#F8F9FF] px-3 py-3 text-xs font-black text-[#596BC4]">
                          فتح المرجع {index + 1} ↗
                        </a>
                      ))}
                    </div>
                  </InfoPanel>
                ) : null}
              </aside>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function AccountCompletionBanner({ token, status }: { token: string; status: PaymentAccountStatus }) {
  const title = status.hasAccount
    ? "سجلي الدخول لتأكيد بياناتك البنكية"
    : "أنشئي حسابك لاستكمال التحويل البنكي";
  const description = status.hasAccount
    ? "تم استلام رابط النشر. بيانات البنك ستظهر داخل حسابك بشكل مقنّع حتى تؤكدي صحتها أو ترسلي طلب تحديث."
    : "تم استلام رابط النشر. أدخلي رقم الجوال المرتبط بالتكليف مع بريدك وكلمة مرور، ثم أضيفي بيانات البنك داخل حسابك الآمن.";

  return (
    <section className="overflow-hidden rounded-[28px] border border-amber-200 bg-[linear-gradient(135deg,#FFF9E8,#FFFDF7)] p-5 shadow-[0_18px_50px_rgba(185,139,36,0.12)] sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800">خطوة مطلوبة لإكمال الدفع</span>
          <h2 className="mt-3 text-xl font-black text-[#3F4E7D]">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-7 text-[#737D9F]">{description}</p>
        </div>
        <a
          href={status.completionPath || `/portal/complete-account?token=${encodeURIComponent(token)}`}
          className="inline-flex h-14 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#6575CB,#4F60B6)] px-6 text-sm font-black text-white shadow-[0_14px_30px_rgba(79,96,182,0.25)]"
        >
          {status.hasAccount ? "تسجيل الدخول والتأكيد" : "إنشاء حساب المؤثر"}
        </a>
      </div>
    </section>
  );
}

function CampaignHero({ assignment, approvedCount, publishedCount, total }: { assignment: AssignmentPayload; approvedCount: number; publishedCount: number; total: number }) {
  const campaign = assignment.campaigns;
  return (
    <section className="overflow-hidden rounded-[30px] bg-[linear-gradient(140deg,#7180D2,#5364B8)] p-6 text-white shadow-[0_25px_70px_rgba(74,88,162,0.25)] sm:p-8">
      <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <div className="flex flex-wrap gap-2">
            {campaign?.brand ? <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-black">{campaign.brand}</span> : null}
            {campaign?.product ? <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-black">{campaign.product}</span> : null}
          </div>
          <h1 className="mt-4 text-2xl font-black sm:text-3xl">{campaign?.name ?? "تكليف حملة"}</h1>
          <p className="mt-3 max-w-3xl text-sm font-semibold leading-7 text-white/78">{campaign?.brief || "راجعي عناصر المحتوى المطلوبة، ثم ارفعي المسودة وأضيفي رابط النشر بعد الاعتماد."}</p>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center lg:min-w-[340px]">
          <HeroNumber label="المطلوب" value={total} />
          <HeroNumber label="المعتمد" value={approvedCount} />
          <HeroNumber label="المنشور" value={publishedCount} />
        </div>
      </div>
    </section>
  );
}

function ContentCard({ token, item, platform, username, onDone, onAccountRequired }: { token: string; item: ContentItem; platform: string; username: string; onDone: () => Promise<void>; onAccountRequired: (status: PaymentAccountStatus | null) => void }) {
  const latestReview = item.reviews[0];
  const latestPublication = item.publications[0];
  const canSubmitDraft = !["approved", "published"].includes(item.status);
  const canSubmitPublication =
    item.status === "approved" &&
    (!latestPublication || ["needs_changes", "rejected"].includes(latestPublication.status));

  return (
    <article className="overflow-hidden rounded-[26px] border border-[#E2E6F4] bg-white/90 shadow-[0_15px_45px_rgba(67,82,155,0.08)]">
      <div className="flex flex-col gap-3 border-b border-[#E9ECF7] bg-[#FAFBFF] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black text-[#8B94B0]">{platformLabels[platform] ?? platform}{username ? ` · @${username}` : ""}</p>
          <h3 className="mt-1 text-lg font-black text-[#35467E]">{item.content_type} #{item.sequence_no}</h3>
        </div>
        <StatusPill status={item.status} />
      </div>

      <div className="space-y-5 p-5">
        {item.status === "needs_changes" && latestReview?.notes ? (
          <Notice tone="warning">
            <strong className="block">ملاحظات التعديل:</strong>
            <span className="mt-1 block whitespace-pre-wrap">{latestReview.notes}</span>
          </Notice>
        ) : null}

        {item.versions.length ? (
          <div>
            <p className="mb-2 text-xs font-black text-[#8A93AE]">النسخ المرفوعة</p>
            <div className="space-y-2">
              {item.versions.map((version) => (
                <div key={version.id} className="flex flex-col justify-between gap-3 rounded-2xl border border-[#E5E8F5] bg-[#FAFBFF] p-3 sm:flex-row sm:items-center">
                  <div>
                    <p className="text-sm font-black text-[#4D5A86]">الإصدار {version.version_no}</p>
                    <p className="mt-1 text-xs font-semibold text-[#929AAF]">{formatDateTime(version.submitted_at)} · {statusLabels[version.review_status] ?? version.review_status}</p>
                    {version.notes ? <p className="mt-2 text-xs font-semibold text-[#6F7898]">{version.notes}</p> : null}
                  </div>
                  <div className="flex gap-2">
                    {version.fileUrl ? <a href={version.fileUrl} target="_blank" rel="noreferrer" className="rounded-xl bg-[#EEF1FF] px-3 py-2 text-xs font-black text-[#596BC4]">فتح الملف</a> : null}
                    {version.external_url ? <a href={version.external_url} target="_blank" rel="noreferrer" className="rounded-xl bg-[#EEF1FF] px-3 py-2 text-xs font-black text-[#596BC4]">فتح الرابط</a> : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {canSubmitDraft ? <ContentSubmissionForm token={token} itemId={item.id} onDone={onDone} isRevision={item.versions.length > 0} /> : null}

        {["approved", "published"].includes(item.status) ? (
          <Notice tone="success">
            {item.status === "published" ? "تم اعتماد رابط النشر لهذا المحتوى." : "تم اعتماد المحتوى. انشريه في الموعد المحدد ثم أضيفي رابط المنشور."}
          </Notice>
        ) : null}

        {latestPublication ? (
          <div className="rounded-2xl border border-[#E5E8F5] bg-[#FAFBFF] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-black text-[#4D5A86]">آخر رابط نشر</p>
              <span className="text-xs font-black text-[#596BC4]">{publicationStatusLabel(latestPublication.status)}</span>
            </div>
            <a href={latestPublication.post_url} target="_blank" rel="noreferrer" className="mt-3 block truncate text-sm font-bold text-[#596BC4] underline">{latestPublication.post_url}</a>
            {latestPublication.review_notes ? <p className="mt-3 whitespace-pre-wrap text-xs font-semibold leading-6 text-rose-700">{latestPublication.review_notes}</p> : null}
          </div>
        ) : null}

        {canSubmitPublication ? <PublicationSubmissionForm token={token} itemId={item.id} defaultPlatform={platform} onDone={onDone} onAccountRequired={onAccountRequired} /> : null}
      </div>
    </article>
  );
}

function ContentSubmissionForm({ token, itemId, onDone, isRevision }: { token: string; itemId: string; onDone: () => Promise<void>; isRevision: boolean }) {
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    data.set("token", token);
    data.set("contentItemId", itemId);
    setSubmitting(true);
    setMessage("");
    try {
      const response = await fetch("/api/guest-portal/content", { method: "POST", body: data });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "تعذر رفع المحتوى.");
      setMessage(result.message);
      form.reset();
      await onDone();
    } catch (submitError) {
      setMessage(submitError instanceof Error ? submitError.message : "تعذر رفع المحتوى.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-[22px] border border-[#DDE2F3] bg-[#F8F9FF] p-4">
      <p className="font-black text-[#4D5A86]">{isRevision ? "رفع نسخة معدلة" : "رفع المسودة"}</p>
      <p className="mt-1 text-xs font-semibold leading-6 text-[#8A93AE]">يمكن رفع ملف حتى 50MB، أو استخدام رابط Drive للفيديوهات الكبيرة.</p>
      <div className="mt-4 grid gap-3">
        <input name="file" type="file" accept="image/*,video/mp4,video/quicktime,video/webm,application/pdf" className="w-full rounded-xl border border-[#D8DDF7] bg-white p-3 text-xs font-bold text-[#59688F]" />
        <input name="externalUrl" type="url" placeholder="أو رابط Google Drive / Dropbox" className="h-12 rounded-xl border border-[#D8DDF7] bg-white px-4 text-sm font-bold outline-none focus:border-[#6877C8]" />
        <textarea name="notes" rows={3} placeholder="ملاحظات للمراجعة (اختياري)" className="rounded-xl border border-[#D8DDF7] bg-white p-4 text-sm font-bold outline-none focus:border-[#6877C8]" />
      </div>
      {message ? <p className="mt-3 text-xs font-black text-[#596BC4]">{message}</p> : null}
      <button type="submit" disabled={submitting} className="mt-4 rounded-xl bg-[#6877C8] px-5 py-3 text-sm font-black text-white disabled:opacity-50">
        {submitting ? "جاري الإرسال..." : isRevision ? "إرسال النسخة المعدلة" : "إرسال للمراجعة"}
      </button>
    </form>
  );
}

function PublicationSubmissionForm({ token, itemId, defaultPlatform, onDone, onAccountRequired }: { token: string; itemId: string; defaultPlatform: string; onDone: () => Promise<void>; onAccountRequired: (status: PaymentAccountStatus | null) => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    data.set("token", token);
    data.set("contentItemId", itemId);
    setSubmitting(true);
    setMessage("");
    try {
      const response = await fetch("/api/guest-portal/publication", { method: "POST", body: data });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "تعذر إرسال رابط النشر.");
      setMessage(result.message);
      onAccountRequired(result.accountCompletion ?? null);
      form.reset();
      await onDone();
    } catch (submitError) {
      setMessage(submitError instanceof Error ? submitError.message : "تعذر إرسال رابط النشر.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-[22px] border border-emerald-200 bg-emerald-50/70 p-4">
      <p className="font-black text-emerald-900">إضافة رابط النشر</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <select name="platform" defaultValue={defaultPlatform} className="h-12 rounded-xl border border-emerald-200 bg-white px-4 text-sm font-bold outline-none">
          {Object.entries(platformLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <input name="publishedAt" type="datetime-local" className="h-12 rounded-xl border border-emerald-200 bg-white px-4 text-sm font-bold outline-none" />
        <input name="postUrl" type="url" required placeholder="رابط المنشور" className="h-12 rounded-xl border border-emerald-200 bg-white px-4 text-sm font-bold outline-none sm:col-span-2" />
        <input name="proof" type="file" accept="image/*,application/pdf" className="rounded-xl border border-emerald-200 bg-white p-3 text-xs font-bold sm:col-span-2" />
        <textarea name="notes" rows={2} placeholder="ملاحظة اختيارية" className="rounded-xl border border-emerald-200 bg-white p-4 text-sm font-bold outline-none sm:col-span-2" />
      </div>
      {message ? <p className="mt-3 text-xs font-black text-emerald-800">{message}</p> : null}
      <button type="submit" disabled={submitting} className="mt-4 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white disabled:opacity-50">
        {submitting ? "جاري الإرسال..." : "إرسال رابط النشر"}
      </button>
    </form>
  );
}

function InfoPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-[24px] border border-[#E2E6F4] bg-white/88 p-5 shadow-[0_14px_42px_rgba(67,82,155,0.07)]"><h3 className="mb-4 font-black text-[#405080]">{title}</h3><div className="space-y-3">{children}</div></section>;
}
function InfoRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-4 border-b border-[#EEF0F7] pb-3 last:border-0 last:pb-0"><span className="text-xs font-bold text-[#929AAF]">{label}</span><span className="text-left text-sm font-black text-[#4D5A86]">{value}</span></div>;
}
function HeroNumber({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl border border-white/15 bg-white/10 px-3 py-4"><p className="text-2xl font-black">{value}</p><p className="mt-1 text-xs font-bold text-white/70">{label}</p></div>;
}
function StatusPill({ status }: { status: string }) {
  const tone = status === "published" || status === "approved" ? "bg-emerald-50 text-emerald-700" : status === "needs_changes" || status === "rejected" ? "bg-rose-50 text-rose-700" : "bg-[#EEF1FF] text-[#596BC4]";
  return <span className={`w-fit rounded-full px-3 py-1.5 text-xs font-black ${tone}`}>{statusLabels[status] ?? status}</span>;
}
function Notice({ tone, children }: { tone: "success" | "error" | "warning"; children: React.ReactNode }) {
  const classes = tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : tone === "warning" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-rose-200 bg-rose-50 text-rose-800";
  return <div className={`mb-4 rounded-2xl border px-4 py-3 text-sm font-bold leading-7 ${classes}`}>{children}</div>;
}
function LoadingCard() {
  return <div className="mt-12 rounded-[28px] border border-white bg-white/80 p-12 text-center shadow-xl"><span className="mx-auto block h-10 w-10 animate-spin rounded-full border-4 border-[#D8DDF7] border-t-[#6877C8]" /><p className="mt-4 font-black text-[#59688F]">جاري تحميل التكليف...</p></div>;
}
function executionLabel(value: string | null) { return value === "home" ? "تعاون منزلي" : value === "in_branch" ? "حضور في الفرع" : value === "remote" ? "تعاون آخر" : "غير محدد"; }
function paymentTimingLabel(value: string | null) { return value === "before_publish" ? "قبل النشر" : value === "after_publish" ? "بعد النشر" : value === "by_agreement" ? "حسب الاتفاق" : "غير محدد"; }
function publicationStatusLabel(value: string) { return value === "approved" ? "معتمد" : value === "needs_changes" ? "يحتاج تصحيح" : value === "rejected" ? "مرفوض" : "بانتظار التحقق"; }
function paymentSummary(payments: AssignmentPayload["payments"]) {
  if (!payments.length) return "لم يبدأ الإجراء المالي";
  if (payments.every((payment) => payment.status === "paid")) return "تمت التسوية";
  if (payments.some((payment) => payment.status === "partially_paid")) return "مدفوع جزئيًا";
  if (payments.some((payment) => payment.status === "ready_for_finance")) return "جاهز للمالية";
  if (payments.some((payment) => payment.status === "awaiting_approval")) return "بانتظار الاعتماد";
  return "قيد الإجراء";
}
function formatDate(value: string | null) { if (!value) return "غير محدد"; return new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium" }).format(new Date(`${value}T12:00:00`)); }
function formatDateTime(value: string | null) { if (!value) return "غير محدد"; return new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Riyadh" }).format(new Date(value)); }
function formatMoney(value: number | null) { if (value === null || value === undefined) return "—"; return new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR", maximumFractionDigits: 0 }).format(Number(value)); }
