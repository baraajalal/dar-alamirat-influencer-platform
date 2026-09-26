"use client";

import Image from "next/image";
import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { AppLocale } from "@/lib/i18n/app";
import { formatFlowMessage, type FlowDictionary } from "@/lib/i18n/flow-dictionary";

type Copy = FlowDictionary["guestAssignment"];

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

type ApiResult = {
  code?: string;
  message?: string;
  assignment?: AssignmentPayload;
  versionNo?: number;
  accountCompletion?: PaymentAccountStatus | null;
};

function recordLabel(record: object, key: string, fallback = key) {
  return (record as Record<string, string>)[key] ?? fallback;
}

function localizedApiError(copy: Copy, code: string | undefined, fallback: string) {
  if (!code) return fallback;
  return recordLabel(copy.errors, code, fallback);
}

export default function GuestAssignmentClient({
  token,
  locale,
  copy,
}: {
  token: string;
  locale: AppLocale;
  copy: Copy;
}) {
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
      const result = (await response.json()) as ApiResult;
      if (response.status === 401) {
        setNeedsVerification(true);
        setAssignment(null);
        return;
      }
      if (!response.ok || !result.assignment) {
        throw new Error(localizedApiError(copy, result.code, copy.errors.loadFailed));
      }
      setAssignment(result.assignment);
      setAccountPrompt(result.assignment.paymentAccount?.shouldPrompt ? result.assignment.paymentAccount : null);
      setNeedsVerification(false);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : copy.errors.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [copy, token]);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialAssignment() {
      try {
        const response = await fetch(
          `/api/guest-portal/assignment?token=${encodeURIComponent(token)}`,
          { cache: "no-store" },
        );
        const result = (await response.json()) as ApiResult;
        if (cancelled) return;

        if (response.status === 401) {
          setNeedsVerification(true);
          setAssignment(null);
          return;
        }
        if (!response.ok || !result.assignment) {
          throw new Error(localizedApiError(copy, result.code, copy.errors.loadFailed));
        }

        setAssignment(result.assignment);
        setAccountPrompt(result.assignment.paymentAccount?.shouldPrompt ? result.assignment.paymentAccount : null);
        setNeedsVerification(false);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : copy.errors.loadFailed);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadInitialAssignment();
    return () => {
      cancelled = true;
    };
  }, [copy, token]);

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
      const result = (await response.json()) as ApiResult;
      if (!response.ok) {
        throw new Error(localizedApiError(copy, result.code, copy.errors.verificationFailed));
      }
      setMessage(copy.verificationSuccess);
      await loadAssignment();
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : copy.errors.verificationFailed);
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
      lang={locale}
      dir="inherit"
      data-no-auto-translate
      className="min-h-screen bg-[radial-gradient(circle_at_8%_10%,rgba(216,221,247,0.82),transparent_30%),radial-gradient(circle_at_90%_84%,rgba(169,185,230,0.42),transparent_28%),linear-gradient(135deg,#FFFDFF,#F4F6FC)] px-4 py-5 font-['Tajawal',Tahoma,Arial,sans-serif] text-[#432A57] sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-6xl">
        <header className="mb-5 flex items-center justify-between rounded-[24px] border border-white/90 bg-white/80 px-5 py-4 shadow-[0_18px_55px_rgba(67,82,155,0.11)] backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[linear-gradient(145deg,#AD7EC4,#8F5FA7)] p-2 shadow-lg">
              <Image
                src="/da-logo.png"
                alt={copy.brandName}
                width={52}
                height={52}
                className="h-full w-full object-contain"
                priority
              />
            </div>
            <div>
              <p className="text-xs font-black text-[#8A93B2]">{copy.headerLabel}</p>
              <p className="mt-1 font-black text-[#513865]">{copy.brandName}</p>
            </div>
          </div>
          {assignment ? (
            <span className="rounded-full bg-[#F7F0FA] px-3 py-2 text-xs font-black text-[#9362AD]">
              {recordLabel(copy.assignmentLabels, assignment.status)}
            </span>
          ) : null}
        </header>

        {message ? <Notice tone="success">{message}</Notice> : null}
        {error ? <Notice tone="error">{error}</Notice> : null}

        {loading ? <LoadingCard copy={copy} /> : null}

        {!loading && needsVerification ? (
          <section className="mx-auto mt-12 max-w-xl overflow-hidden rounded-[32px] border border-white bg-white/88 shadow-[0_28px_90px_rgba(67,82,155,0.18)] backdrop-blur-xl">
            <div className="bg-[linear-gradient(145deg,#AD7EC4,#8F5FA7)] px-7 py-8 text-white">
              <p className="text-sm font-black text-white/70">{copy.verifyLabel}</p>
              <h1 className="mt-2 text-2xl font-black">{copy.verifyTitle}</h1>
              <p className="mt-3 text-sm font-semibold leading-7 text-white/78">
                {copy.verifyDescription}
              </p>
            </div>
            <form onSubmit={verify} className="space-y-5 p-7">
              <label className="block">
                <span className="mb-2 block text-sm font-black text-[#52608B]">{copy.lastFour}</span>
                <input
                  value={lastFour}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setLastFour(event.target.value.replace(/\D/g, "").slice(0, 4))
                  }
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={4}
                  required
                  className="h-16 w-full rounded-2xl border border-[#EBDDF2] bg-[#FDFBFE] px-5 text-center text-2xl font-black tracking-[0.5em] outline-none transition focus:border-[#A170BA] focus:ring-4 focus:ring-[#A170BA]/10"
                  placeholder="••••"
                />
              </label>
              <button
                type="submit"
                disabled={verifying || lastFour.length !== 4}
                className="h-14 w-full rounded-2xl bg-[linear-gradient(135deg,#A170BA,#8959A2)] font-black text-white shadow-[0_15px_28px_rgba(82,99,185,0.24)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {verifying ? copy.verifying : copy.enterAssignment}
              </button>
            </form>
          </section>
        ) : null}

        {!loading && assignment ? (
          <div className="space-y-6">
            <CampaignHero
              assignment={assignment}
              approvedCount={approvedCount}
              publishedCount={publishedCount}
              total={allItems.length}
              copy={copy}
            />

            {accountPrompt?.shouldPrompt ? (
              <AccountCompletionBanner token={token} status={accountPrompt} copy={copy} />
            ) : null}

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.7fr)]">
              <section className="space-y-5">
                <div>
                  <p className="text-xs font-black text-[#9098B0]">{copy.contentEyebrow}</p>
                  <h2 className="mt-1 text-xl font-black text-[#4C335F]">{copy.contentTitle}</h2>
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
                      locale={locale}
                      copy={copy}
                    />
                  )),
                )}

                {allItems.length === 0 ? (
                  <div className="rounded-[24px] border border-dashed border-[#E5D5EC] bg-white/75 p-8 text-center text-sm font-bold text-[#8D7B95]">
                    {copy.noContent}
                  </div>
                ) : null}
              </section>

              <aside className="space-y-5">
                <InfoPanel title={copy.executionDetails}>
                  <InfoRow
                    label={copy.collaborationType}
                    value={executionLabel(assignment.execution_type, assignment.other_execution_details, copy)}
                  />
                  {assignment.branch ? <InfoRow label={copy.branch} value={assignment.branch} /> : null}
                  {assignment.attendance_at ? (
                    <InfoRow label={copy.attendanceAt} value={formatDateTime(assignment.attendance_at, locale, copy)} />
                  ) : null}
                  {assignment.order_number ? <InfoRow label={copy.orderNumber} value={assignment.order_number} /> : null}
                  {assignment.order_code ? <InfoRow label={copy.orderCode} value={assignment.order_code} /> : null}
                </InfoPanel>

                <InfoPanel title={copy.compensationTitle}>
                  {assignment.compensations.map((compensation) => (
                    <div key={compensation.id} className="rounded-2xl bg-[#FCF9FD] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-black text-[#624B72]">
                          {recordLabel(copy.compensationLabels, compensation.type)}
                        </p>
                        <p className="text-sm font-black text-[#9362AD]">
                          {compensation.type === "product"
                            ? formatMoney(compensation.product_reference_value, locale)
                            : formatMoney(compensation.amount, locale)}
                        </p>
                      </div>
                      {compensation.product_description ? (
                        <p className="mt-2 text-xs font-semibold leading-6 text-[#7D86A3]">
                          {compensation.product_description}
                        </p>
                      ) : null}
                    </div>
                  ))}
                  {assignment.compensations.length === 0 ? (
                    <p className="text-sm font-bold text-[#95849D]">{copy.noCompensation}</p>
                  ) : null}
                  <InfoRow label={copy.paymentTiming} value={paymentTimingLabel(assignment.payment_timing, copy)} />
                  <InfoRow label={copy.paymentStatus} value={paymentSummary(assignment.payments, copy)} />
                </InfoPanel>

                {assignment.campaigns?.hashtags?.length ? (
                  <InfoPanel title={copy.hashtags}>
                    <div className="flex flex-wrap gap-2">
                      {assignment.campaigns.hashtags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-[#F7F0FA] px-3 py-1.5 text-xs font-black text-[#9362AD]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </InfoPanel>
                ) : null}

                {assignment.campaigns?.reference_links?.length ? (
                  <InfoPanel title={copy.references}>
                    <div className="space-y-2">
                      {assignment.campaigns.reference_links.map((link, index) => (
                        <a
                          key={link}
                          href={link}
                          target="_blank"
                          rel="noreferrer"
                          className="block truncate rounded-xl bg-[#FCF9FD] px-3 py-3 text-xs font-black text-[#9362AD]"
                        >
                          {formatFlowMessage(copy.openReference, { number: index + 1 })}
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

function AccountCompletionBanner({
  token,
  status,
  copy,
}: {
  token: string;
  status: PaymentAccountStatus;
  copy: Copy;
}) {
  const title = status.hasAccount ? copy.accountLoginTitle : copy.accountCreateTitle;
  const description = status.hasAccount ? copy.accountLoginDescription : copy.accountCreateDescription;

  return (
    <section className="overflow-hidden rounded-[28px] border border-amber-200 bg-[linear-gradient(135deg,#FFF9E8,#FFFDF7)] p-5 shadow-[0_18px_50px_rgba(185,139,36,0.12)] sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800">
            {copy.accountRequiredBadge}
          </span>
          <h2 className="mt-3 text-xl font-black text-[#3F4E7D]">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-7 text-[#737D9F]">{description}</p>
        </div>
        <a
          href={status.completionPath || `/portal/complete-account?token=${encodeURIComponent(token)}`}
          className="inline-flex h-14 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#A06DB9,#84539E)] px-6 text-sm font-black text-white shadow-[0_14px_30px_rgba(79,96,182,0.25)]"
        >
          {status.hasAccount ? copy.accountLoginButton : copy.accountCreateButton}
        </a>
      </div>
    </section>
  );
}

function CampaignHero({
  assignment,
  approvedCount,
  publishedCount,
  total,
  copy,
}: {
  assignment: AssignmentPayload;
  approvedCount: number;
  publishedCount: number;
  total: number;
  copy: Copy;
}) {
  const campaign = assignment.campaigns;
  return (
    <section className="overflow-hidden rounded-[30px] bg-[linear-gradient(140deg,#AD7EC4,#8959A2)] p-6 text-white shadow-[0_25px_70px_rgba(74,88,162,0.25)] sm:p-8">
      <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <div className="flex flex-wrap gap-2">
            {campaign?.brand ? (
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-black">
                {campaign.brand}
              </span>
            ) : null}
            {campaign?.product ? (
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-black">
                {campaign.product}
              </span>
            ) : null}
          </div>
          <h1 className="mt-4 text-2xl font-black sm:text-3xl">{campaign?.name ?? copy.campaignFallback}</h1>
          <p className="mt-3 max-w-3xl text-sm font-semibold leading-7 text-white/78">
            {campaign?.brief || copy.briefFallback}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center lg:min-w-[340px]">
          <HeroNumber label={copy.required} value={total} />
          <HeroNumber label={copy.approved} value={approvedCount} />
          <HeroNumber label={copy.published} value={publishedCount} />
        </div>
      </div>
    </section>
  );
}

function ContentCard({
  token,
  item,
  platform,
  username,
  onDone,
  onAccountRequired,
  locale,
  copy,
}: {
  token: string;
  item: ContentItem;
  platform: string;
  username: string;
  onDone: () => Promise<void>;
  onAccountRequired: (status: PaymentAccountStatus | null) => void;
  locale: AppLocale;
  copy: Copy;
}) {
  const latestReview = item.reviews[0];
  const latestPublication = item.publications[0];
  const canSubmitDraft = !["approved", "published"].includes(item.status);
  const canSubmitPublication =
    item.status === "approved" &&
    (!latestPublication || ["needs_changes", "rejected"].includes(latestPublication.status));

  return (
    <article className="overflow-hidden rounded-[26px] border border-[#F0E8F4] bg-white/90 shadow-[0_15px_45px_rgba(67,82,155,0.08)]">
      <div className="flex flex-col gap-3 border-b border-[#F4EFF8] bg-[#FDFBFE] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black text-[#8B94B0]">
            {recordLabel(copy.platformLabels, platform)}
            {username ? ` · @${username}` : ""}
          </p>
          <h3 className="mt-1 text-lg font-black text-[#4C335F]">
            {recordLabel(copy.contentTypeLabels, item.content_type, item.content_type)} #{formatNumber(item.sequence_no, locale)}
          </h3>
        </div>
        <StatusPill status={item.status} copy={copy} />
      </div>

      <div className="space-y-5 p-5">
        {item.status === "needs_changes" && latestReview?.notes ? (
          <Notice tone="warning">
            <strong className="block">{copy.revisionNotes}</strong>
            <span className="mt-1 block whitespace-pre-wrap">{latestReview.notes}</span>
          </Notice>
        ) : null}

        {item.versions.length ? (
          <div>
            <p className="mb-2 text-xs font-black text-[#8D7B95]">{copy.uploadedVersions}</p>
            <div className="space-y-2">
              {item.versions.map((version) => (
                <div
                  key={version.id}
                  className="flex flex-col justify-between gap-3 rounded-2xl border border-[#F2ECF6] bg-[#FDFBFE] p-3 sm:flex-row sm:items-center"
                >
                  <div>
                    <p className="text-sm font-black text-[#624B72]">
                      {formatFlowMessage(copy.version, { number: formatNumber(version.version_no, locale) })}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-[#95849D]">
                      {formatDateTime(version.submitted_at, locale, copy)} · {recordLabel(copy.statusLabels, version.review_status)}
                    </p>
                    {version.notes ? (
                      <p className="mt-2 text-xs font-semibold text-[#74637F]">{version.notes}</p>
                    ) : null}
                  </div>
                  <div className="flex gap-2">
                    {version.fileUrl ? (
                      <a
                        href={version.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl bg-[#F7F0FA] px-3 py-2 text-xs font-black text-[#9362AD]"
                      >
                        {copy.openFile}
                      </a>
                    ) : null}
                    {version.external_url ? (
                      <a
                        href={version.external_url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl bg-[#F7F0FA] px-3 py-2 text-xs font-black text-[#9362AD]"
                      >
                        {copy.openLink}
                      </a>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {canSubmitDraft ? (
          <ContentSubmissionForm
            token={token}
            itemId={item.id}
            onDone={onDone}
            isRevision={item.versions.length > 0}
            locale={locale}
            copy={copy}
          />
        ) : null}

        {["approved", "published"].includes(item.status) ? (
          <Notice tone="success">
            {item.status === "published" ? copy.publishedApproved : copy.contentApproved}
          </Notice>
        ) : null}

        {latestPublication ? (
          <div className="rounded-2xl border border-[#F2ECF6] bg-[#FDFBFE] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-black text-[#624B72]">{copy.latestPublication}</p>
              <span className="text-xs font-black text-[#9362AD]">
                {publicationStatusLabel(latestPublication.status, copy)}
              </span>
            </div>
            <a
              href={latestPublication.post_url}
              target="_blank"
              rel="noreferrer"
              className="mt-3 block truncate text-sm font-bold text-[#9362AD] underline"
            >
              {latestPublication.post_url}
            </a>
            {latestPublication.review_notes ? (
              <p className="mt-3 whitespace-pre-wrap text-xs font-semibold leading-6 text-rose-700">
                {latestPublication.review_notes}
              </p>
            ) : null}
          </div>
        ) : null}

        {canSubmitPublication ? (
          <PublicationSubmissionForm
            token={token}
            itemId={item.id}
            defaultPlatform={platform}
            onDone={onDone}
            onAccountRequired={onAccountRequired}
            copy={copy}
          />
        ) : null}
      </div>
    </article>
  );
}

function ContentSubmissionForm({
  token,
  itemId,
  onDone,
  isRevision,
  locale,
  copy,
}: {
  token: string;
  itemId: string;
  onDone: () => Promise<void>;
  isRevision: boolean;
  locale: AppLocale;
  copy: Copy;
}) {
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
      const result = (await response.json()) as ApiResult;
      if (!response.ok) {
        throw new Error(localizedApiError(copy, result.code, copy.errors.CONTENT_UPLOAD_FAILED));
      }
      const versionNumber = result.versionNo === undefined ? "" : formatNumber(result.versionNo, locale);
      setMessage(formatFlowMessage(copy.contentSubmitted, { number: versionNumber }));
      form.reset();
      await onDone();
    } catch (submitError) {
      setMessage(submitError instanceof Error ? submitError.message : copy.errors.CONTENT_UPLOAD_FAILED);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-[22px] border border-[#ECE1F1] bg-[#FCF9FD] p-4">
      <p className="font-black text-[#624B72]">{isRevision ? copy.uploadRevision : copy.uploadDraft}</p>
      <p className="mt-1 text-xs font-semibold leading-6 text-[#8D7B95]">{copy.uploadHelp}</p>
      <div className="mt-4 grid gap-3">
        <input
          name="file"
          type="file"
          accept="image/*,video/mp4,video/quicktime,video/webm,application/pdf"
          className="w-full rounded-xl border border-[#EBDDF2] bg-white p-3 text-xs font-bold text-[#59688F]"
        />
        <input
          name="externalUrl"
          type="url"
          placeholder={copy.externalUrlPlaceholder}
          className="h-12 rounded-xl border border-[#EBDDF2] bg-white px-4 text-sm font-bold outline-none focus:border-[#A170BA]"
        />
        <textarea
          name="notes"
          rows={3}
          placeholder={copy.reviewNotesPlaceholder}
          className="rounded-xl border border-[#EBDDF2] bg-white p-4 text-sm font-bold outline-none focus:border-[#A170BA]"
        />
      </div>
      {message ? <p className="mt-3 text-xs font-black text-[#9362AD]">{message}</p> : null}
      <button
        type="submit"
        disabled={submitting}
        className="mt-4 rounded-xl bg-[#A170BA] px-5 py-3 text-sm font-black text-white disabled:opacity-50"
      >
        {submitting ? copy.submitting : isRevision ? copy.submitRevision : copy.submitForReview}
      </button>
    </form>
  );
}

function PublicationSubmissionForm({
  token,
  itemId,
  defaultPlatform,
  onDone,
  onAccountRequired,
  copy,
}: {
  token: string;
  itemId: string;
  defaultPlatform: string;
  onDone: () => Promise<void>;
  onAccountRequired: (status: PaymentAccountStatus | null) => void;
  copy: Copy;
}) {
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
      const result = (await response.json()) as ApiResult;
      if (!response.ok) {
        throw new Error(localizedApiError(copy, result.code, copy.errors.PUBLICATION_FAILED));
      }
      setMessage(copy.publicationSubmitted);
      onAccountRequired(result.accountCompletion ?? null);
      form.reset();
      await onDone();
    } catch (submitError) {
      setMessage(submitError instanceof Error ? submitError.message : copy.errors.PUBLICATION_FAILED);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-[22px] border border-emerald-200 bg-emerald-50/70 p-4">
      <p className="font-black text-emerald-900">{copy.addPublication}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <select
          name="platform"
          defaultValue={defaultPlatform}
          className="h-12 rounded-xl border border-emerald-200 bg-white px-4 text-sm font-bold outline-none"
        >
          {Object.entries(copy.platformLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <input
          name="publishedAt"
          type="datetime-local"
          className="h-12 rounded-xl border border-emerald-200 bg-white px-4 text-sm font-bold outline-none"
        />
        <input
          name="postUrl"
          type="url"
          required
          placeholder={copy.postUrlPlaceholder}
          className="h-12 rounded-xl border border-emerald-200 bg-white px-4 text-sm font-bold outline-none sm:col-span-2"
        />
        <input
          name="proof"
          type="file"
          accept="image/*,application/pdf"
          className="rounded-xl border border-emerald-200 bg-white p-3 text-xs font-bold sm:col-span-2"
        />
        <textarea
          name="notes"
          rows={2}
          placeholder={copy.optionalNote}
          className="rounded-xl border border-emerald-200 bg-white p-4 text-sm font-bold outline-none sm:col-span-2"
        />
      </div>
      {message ? <p className="mt-3 text-xs font-black text-emerald-800">{message}</p> : null}
      <button
        type="submit"
        disabled={submitting}
        className="mt-4 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white disabled:opacity-50"
      >
        {submitting ? copy.submitting : copy.submitPublication}
      </button>
    </form>
  );
}

function InfoPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[24px] border border-[#F0E8F4] bg-white/88 p-5 shadow-[0_14px_42px_rgba(67,82,155,0.07)]">
      <h3 className="mb-4 font-black text-[#513865]">{title}</h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[#F5EFF7] pb-3 last:border-0 last:pb-0">
      <span className="text-xs font-bold text-[#95849D]">{label}</span>
      <span className="text-start text-sm font-black text-[#624B72]">{value}</span>
    </div>
  );
}

function HeroNumber({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/15 bg-white/10 px-3 py-4">
      <p className="text-2xl font-black">{value}</p>
      <p className="mt-1 text-xs font-bold text-white/70">{label}</p>
    </div>
  );
}

function StatusPill({ status, copy }: { status: string; copy: Copy }) {
  const tone =
    status === "published" || status === "approved"
      ? "bg-emerald-50 text-emerald-700"
      : status === "needs_changes" || status === "rejected"
        ? "bg-rose-50 text-rose-700"
        : "bg-[#F7F0FA] text-[#9362AD]";
  return (
    <span className={`w-fit rounded-full px-3 py-1.5 text-xs font-black ${tone}`}>
      {recordLabel(copy.statusLabels, status)}
    </span>
  );
}

function Notice({
  tone,
  children,
}: {
  tone: "success" | "error" | "warning";
  children: React.ReactNode;
}) {
  const classes =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : "border-rose-200 bg-rose-50 text-rose-800";
  return <div className={`mb-4 rounded-2xl border px-4 py-3 text-sm font-bold leading-7 ${classes}`}>{children}</div>;
}

function LoadingCard({ copy }: { copy: Copy }) {
  return (
    <div className="mt-12 rounded-[28px] border border-white bg-white/80 p-12 text-center shadow-xl">
      <span className="mx-auto block h-10 w-10 animate-spin rounded-full border-4 border-[#EBDDF2] border-t-[#A170BA]" />
      <p className="mt-4 font-black text-[#59688F]">{copy.loading}</p>
    </div>
  );
}

function executionLabel(value: string | null, details: string | null | undefined, copy: Copy) {
  if (value === "home") return copy.executionLabels.home;
  if (value === "in_branch") return copy.executionLabels.in_branch;
  if (value === "remote" && details === "MULTIPLE_HOME_IN_BRANCH") return copy.executionLabels.home_and_branch;
  if (value === "remote") return copy.executionLabels.remote;
  return copy.executionLabels.unset;
}

function paymentTimingLabel(value: string | null, copy: Copy) {
  if (value === "before_publish") return copy.paymentTimingLabels.before_publish;
  if (value === "after_publish") return copy.paymentTimingLabels.after_publish;
  if (value === "by_agreement") return copy.paymentTimingLabels.by_agreement;
  return copy.paymentTimingLabels.unset;
}

function publicationStatusLabel(value: string, copy: Copy) {
  return recordLabel(copy.publicationStatusLabels, value, copy.publicationStatusLabels.pending);
}

function paymentSummary(payments: AssignmentPayload["payments"], copy: Copy) {
  if (!payments.length) return copy.paymentSummary.notStarted;
  if (payments.every((payment) => payment.status === "paid")) return copy.paymentSummary.settled;
  if (payments.some((payment) => payment.status === "partially_paid")) return copy.paymentSummary.partiallyPaid;
  if (payments.some((payment) => payment.status === "ready_for_finance")) return copy.paymentSummary.readyFinance;
  if (payments.some((payment) => payment.status === "awaiting_approval")) return copy.paymentSummary.awaitingApproval;
  return copy.paymentSummary.processing;
}

function formatDateTime(value: string | null, locale: AppLocale, copy: Copy) {
  if (!value) return copy.notSet;
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Riyadh",
  }).format(new Date(value));
}

function formatMoney(value: number | null, locale: AppLocale) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat(locale === "ar" ? "ar-SA" : "en-SA", {
    style: "currency",
    currency: "SAR",
    maximumFractionDigits: 0,
  }).format(Number(value));
}

function formatNumber(value: number, locale: AppLocale) {
  return new Intl.NumberFormat(locale === "ar" ? "ar-SA" : "en-US").format(value);
}
