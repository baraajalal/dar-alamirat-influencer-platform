"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { DashboardIcon } from "@/components/dashboard/icons";
import type { CampaignLocale } from "../../../campaign-copy";
import { CampaignPanel } from "../../../campaign-ui";
import { createCampaignAssignment, type AssignmentActionState } from "./actions";
import QuickInfluencerModal from "./quick-influencer-modal";

type SocialAccount = {
  id: string;
  platform: string;
  username: string;
  profileUrl: string | null;
  followersCount: number | null;
};

type InfluencerResult = {
  influencer_id: string;
  full_name: string;
  mobile_e164: string;
  city: string | null;
  country: string | null;
  profile_completion: number;
  social_accounts: SocialAccount[];
  available: boolean;
  availability_reason: string | null;
  blocking_campaign_id: string | null;
  blocking_campaign_name: string | null;
  blocked_until: string | null;
  days_remaining: number | null;
};

type Deliverable = { id: string; contentType: string; quantity: number };
type SelectedPlatform = { account: SocialAccount; deliverables: Deliverable[] };
type BudgetSummary = {
  estimatedBudget: number;
  committedAmount: number;
  remainingAmount: number;
  paidAmount: number;
  awaitingPayment: number;
  overBudgetAmount: number;
  usagePercentage: number | null;
};
type BranchOption = { id: string; name: string };
type Props = {
  locale: CampaignLocale;
  campaignId: string;
  campaignName: string;
  defaultContentDueLocal: string;
  defaultPublishingDate: string;
  budget: BudgetSummary;
  initialBranches: BranchOption[];
  returnTo?: string;
};
type CompensationSelection = { bank_transfer: boolean; voucher: boolean; product: boolean };

const initialState: AssignmentActionState = { ok: false, message: "" };
const platformLabels: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  snapchat: "Snapchat",
  youtube: "YouTube",
  x: "X",
  facebook: "Facebook",
  other: "Other",
};

function newDeliverable(contentType: string): Deliverable {
  return { id: crypto.randomUUID(), contentType, quantity: 1 };
}

export default function AssignmentForm({
  locale,
  campaignId,
  campaignName,
  defaultContentDueLocal,
  defaultPublishingDate,
  budget,
  initialBranches,
  returnTo,
}: Props) {
  const t = text(locale);
  const [state, formAction, pending] = useActionState(createCampaignAssignment, initialState);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState("");
  const [results, setResults] = useState<InfluencerResult[]>([]);
  const [selectedInfluencer, setSelectedInfluencer] = useState<InfluencerResult | null>(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState<Record<string, SelectedPlatform>>({});
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  const [executionType, setExecutionType] = useState<"home" | "in_branch" | "multiple" | "remote">("home");
  const [otherExecutionDetails, setOtherExecutionDetails] = useState("");
  const [requiresContent, setRequiresContent] = useState(true);
  const [branchName, setBranchName] = useState("");
  const [attendanceLocal, setAttendanceLocal] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [orderAmount, setOrderAmount] = useState("");
  const [orderCode, setOrderCode] = useState("");

  const [selectedCompensations, setSelectedCompensations] = useState<CompensationSelection>({
    bank_transfer: true,
    voucher: false,
    product: false,
  });
  const [bankAmount, setBankAmount] = useState("");
  const [bankExpectedLocal, setBankExpectedLocal] = useState("");
  const [bankNotes, setBankNotes] = useState("");
  const [voucherAmount, setVoucherAmount] = useState("");
  const [voucherSource, setVoucherSource] = useState<"website" | "branch">("website");
  const [voucherBranch, setVoucherBranch] = useState("");
  const [voucherNotes, setVoucherNotes] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [productReferenceValue, setProductReferenceValue] = useState("");
  const [productNotes, setProductNotes] = useState("");

  const [hasContract, setHasContract] = useState(false);
  const [contractReference, setContractReference] = useState("");
  const [agreementDate, setAgreementDate] = useState("");
  const [paymentTiming, setPaymentTiming] = useState<"before_publish" | "after_publish" | "by_agreement">("before_publish");
  const [contractNotes, setContractNotes] = useState("");
  const [coordinatorNotes, setCoordinatorNotes] = useState("");

  const attendanceIsoRef = useRef<HTMLInputElement | null>(null);
  const topRef = useRef<HTMLFormElement | null>(null);
  const effectiveRequiresContent = executionType === "remote" ? requiresContent : true;
  const isHomeMode = executionType === "home" || executionType === "multiple";
  const isBranchMode = executionType === "in_branch" || executionType === "multiple";

  useEffect(() => {
    const trimmed = query.trim();
    const digits = trimmed.replace(/\D/g, "");
    if (trimmed.length < 2 && digits.length < 4) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      setSearchMessage("");
      try {
        const response = await fetch(
          `/api/campaigns/${campaignId}/influencers/search?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal, cache: "no-store" },
        );
        const payload = (await response.json()) as { results?: InfluencerResult[]; message?: string };
        if (!response.ok) throw new Error(payload.message || t.searchFailed);
        setResults(payload.results ?? []);
        if ((payload.results ?? []).length === 0) setSearchMessage(t.noResults);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setResults([]);
        setSearchMessage(error instanceof Error ? error.message : t.searchFailed);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [campaignId, query, t.noResults, t.searchFailed]);

  const platformsPayload = useMemo(
    () =>
      Object.values(selectedPlatforms).map((platform) => ({
        socialAccountId: platform.account.id,
        deliverables: effectiveRequiresContent
          ? platform.deliverables.map((item) => ({ contentType: item.contentType, quantity: item.quantity }))
          : [],
      })),
    [effectiveRequiresContent, selectedPlatforms],
  );

  const bankNumeric = parseMoney(bankAmount);
  const voucherNumeric = parseMoney(voucherAmount);
  const productReferenceNumeric = parseMoney(productReferenceValue);
  const budgetAmount =
    (selectedCompensations.bank_transfer ? bankNumeric : 0) +
    (selectedCompensations.voucher ? voucherNumeric : 0);
  const remainingAfter = budget.remainingAmount - budgetAmount;
  const overBudgetAfter = Math.max(-remainingAfter, 0);

  const compensationsPayload = useMemo(() => {
    const items: Array<Record<string, string | number>> = [];
    if (selectedCompensations.bank_transfer) {
      items.push({
        type: "bank_transfer",
        amount: parseMoney(bankAmount),
        expectedPaymentAt: toIsoValue(bankExpectedLocal),
        notes: bankNotes,
        voucherSource: "",
        voucherBranch: "",
        productDescription: "",
        productReferenceValue: 0,
      });
    }
    if (selectedCompensations.voucher) {
      items.push({
        type: "voucher",
        amount: parseMoney(voucherAmount),
        expectedPaymentAt: "",
        notes: voucherNotes,
        voucherSource,
        voucherBranch: voucherSource === "branch" ? voucherBranch : "",
        productDescription: "",
        productReferenceValue: 0,
      });
    }
    if (selectedCompensations.product) {
      items.push({
        type: "product",
        amount: 0,
        expectedPaymentAt: "",
        notes: productNotes,
        voucherSource: "",
        voucherBranch: "",
        productDescription,
        productReferenceValue: productReferenceNumeric,
      });
    }
    return items;
  }, [bankAmount, bankExpectedLocal, bankNotes, productDescription, productNotes, productReferenceNumeric, selectedCompensations, voucherAmount, voucherBranch, voucherNotes, voucherSource]);

  const platformValid =
    platformsPayload.length > 0 &&
    (!effectiveRequiresContent || platformsPayload.every((platform) => platform.deliverables.length > 0));
  const collaborationValid =
    (!isHomeMode || (orderNumber.trim() !== "" && orderAmount.trim() !== "")) &&
    (!isBranchMode || branchName.trim() !== "") &&
    (executionType !== "remote" || otherExecutionDetails.trim() !== "");
  const compensationValid =
    (!selectedCompensations.bank_transfer || bankNumeric > 0) &&
    (!selectedCompensations.voucher || (voucherNumeric > 0 && (voucherSource === "website" || voucherBranch.trim() !== ""))) &&
    (!selectedCompensations.product || productDescription.trim() !== "");
  const canSubmit =
    Boolean(selectedInfluencer?.available) &&
    platformValid &&
    collaborationValid &&
    compensationValid &&
    (!hasContract || Boolean(paymentTiming)) &&
    !pending;

  function changeQuery(value: string) {
    const trimmed = value.trim();
    const digits = trimmed.replace(/\D/g, "");
    setQuery(value);
    if (trimmed.length < 2 && digits.length < 4) {
      setResults([]);
      setSearchMessage("");
      setSearching(false);
    }
  }

  function selectInfluencer(influencer: InfluencerResult) {
    setSelectedInfluencer(influencer);
    setSelectedPlatforms({});
  }

  function togglePlatform(account: SocialAccount) {
    setSelectedPlatforms((current) => {
      const next = { ...current };
      if (next[account.id]) delete next[account.id];
      else next[account.id] = { account, deliverables: [newDeliverable(t.defaultContentType)] };
      return next;
    });
  }

  function updateDeliverable(accountId: string, deliverableId: string, patch: Partial<Deliverable>) {
    setSelectedPlatforms((current) => ({
      ...current,
      [accountId]: {
        ...current[accountId],
        deliverables: current[accountId].deliverables.map((item) =>
          item.id === deliverableId ? { ...item, ...patch } : item,
        ),
      },
    }));
  }

  function addDeliverable(accountId: string) {
    setSelectedPlatforms((current) => ({
      ...current,
      [accountId]: {
        ...current[accountId],
        deliverables: [...current[accountId].deliverables, newDeliverable(t.defaultContentType)],
      },
    }));
  }

  function removeDeliverable(accountId: string, deliverableId: string) {
    setSelectedPlatforms((current) => {
      const platform = current[accountId];
      if (!platform || platform.deliverables.length === 1) return current;
      return {
        ...current,
        [accountId]: {
          ...platform,
          deliverables: platform.deliverables.filter((item) => item.id !== deliverableId),
        },
      };
    });
  }

  function toggleCompensation(type: keyof CompensationSelection) {
    setSelectedCompensations((current) => ({ ...current, [type]: !current[type] }));
  }

  function prepareSubmission() {
    if (attendanceIsoRef.current) {
      attendanceIsoRef.current.value = isBranchMode ? toIsoValue(attendanceLocal) : "";
    }
  }

  function goTo(nextStep: 1 | 2 | 3) {
    setStep(nextStep);
    window.setTimeout(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  const contentTypes = locale === "ar"
    ? ["ريلز", "ستوري", "بوست صورة", "فيديو تيك توك", "سناب", "تغطية زيارة", "فتح صندوق", "مراجعة منتج", "بث مباشر", "أخرى"]
    : ["Reel", "Story", "Photo post", "TikTok video", "Snap", "Visit coverage", "Unboxing", "Product review", "Live stream", "Other"];

  return (
    <form action={formAction} onSubmit={prepareSubmission} className="space-y-6" ref={topRef}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="campaign_id" value={campaignId} />
      <input type="hidden" name="return_to" value={returnTo ?? ""} />
      <input type="hidden" name="influencer_id" value={selectedInfluencer?.influencer_id ?? ""} />
      <input type="hidden" name="platforms_json" value={JSON.stringify(platformsPayload)} />
      <input type="hidden" name="compensations_json" value={JSON.stringify(compensationsPayload)} />
      <input type="hidden" name="collaboration_mode" value={executionType} />
      <input type="hidden" name="execution_type" value={executionType === "multiple" ? "remote" : executionType} />
      <input type="hidden" name="other_execution_details" value={executionType === "multiple" ? "MULTIPLE_HOME_IN_BRANCH" : otherExecutionDetails} />
      <input type="hidden" name="requires_content" value={String(effectiveRequiresContent)} />
      <input type="hidden" name="content_due_at_iso" value="" />
      <input type="hidden" name="publishing_date" value="" />
      <input type="hidden" name="branch_name" value={isBranchMode ? branchName : ""} />
      <input ref={attendanceIsoRef} type="hidden" name="attendance_at_iso" />
      <input type="hidden" name="order_number" value={isHomeMode ? orderNumber : ""} />
      <input type="hidden" name="order_invoice_amount" value={isHomeMode ? orderAmount : ""} />
      <input type="hidden" name="order_code" value={isHomeMode ? orderCode : ""} />
      <input type="hidden" name="has_contract" value={String(hasContract)} />
      <input type="hidden" name="currency" value="SAR" />

      <WizardHeader step={step} labels={t.steps} onStep={goTo} stepOneReady={Boolean(selectedInfluencer?.available) && platformValid} stepTwoReady={collaborationValid} />

      {state.message && !state.ok ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-bold leading-7 text-rose-700">{state.message}</div>
      ) : null}

      {step === 1 ? (
        <CampaignPanel title={t.step1Title} description={t.step1Subtitle}>
          <div className="relative">
            <input value={query} onChange={(event) => changeQuery(event.target.value)} className={`${inputClass} ps-12`} placeholder={t.searchPlaceholder} />
            <span className="absolute start-4 top-1/2 -translate-y-1/2 text-[#7A87C5]">
              {searching ? <Spinner /> : <DashboardIcon name="influencers" className="h-5 w-5" />}
            </span>
          </div>

          {searchMessage ? (
            <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-[#FCF9FD] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-bold text-[#7E88A7]">{searchMessage}</p>
              {!searching && results.length === 0 ? (
                <button type="button" onClick={() => setQuickAddOpen(true)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#A170BA] px-4 text-xs font-black text-white shadow-[0_10px_24px_rgba(78,95,177,0.18)]">
                  <DashboardIcon name="plus" className="h-4 w-4" />
                  {t.quickAdd}
                </button>
              ) : null}
            </div>
          ) : null}

          {!searchMessage && !searching ? (
            <div className="mt-4 flex justify-end">
              <button type="button" onClick={() => setQuickAddOpen(true)} className="inline-flex items-center gap-2 rounded-xl border border-[#EBDDF2] bg-white px-4 py-2.5 text-xs font-black text-[#9362AD]">
                <DashboardIcon name="plus" className="h-4 w-4" />
                {t.quickAdd}
              </button>
            </div>
          ) : null}

          {results.length > 0 ? (
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {results.map((influencer) => {
                const active = selectedInfluencer?.influencer_id === influencer.influencer_id;
                return (
                  <button key={influencer.influencer_id} type="button" onClick={() => selectInfluencer(influencer)} className={`rounded-[22px] border p-5 text-start transition ${active ? "border-[#A170BA] bg-[#F1F3FF] shadow-[0_0_0_4px_rgba(104,119,200,0.10)]" : "border-[#F1EAF5] bg-[#FDFBFE] hover:border-[#D8BDE3] hover:bg-white"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-[#4C335F]">{influencer.full_name}</p>
                        <p dir="ltr" className="mt-1 text-start text-xs font-semibold text-[#8991A9]">{influencer.mobile_e164}</p>
                      </div>
                      <AvailabilityBadge influencer={influencer} locale={locale} />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Chip>{influencer.city || t.cityUnknown}</Chip>
                      <Chip>{t.profileCompletion} {influencer.profile_completion}%</Chip>
                      <Chip>{influencer.social_accounts.length} {t.accounts}</Chip>
                    </div>
                    {!influencer.available ? <p className="mt-4 text-xs font-bold leading-6 text-rose-600">{availabilityDescription(influencer, locale)}</p> : null}
                  </button>
                );
              })}
            </div>
          ) : null}

          {selectedInfluencer ? (
            <div className="mt-7 border-t border-[#F2ECF5] pt-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-black text-[#4A315C]">{t.socialTitle}</h3>
                  <p className="mt-1 text-xs font-semibold text-[#95849D]">{t.socialHint}</p>
                </div>
                <span className="rounded-full bg-[#F6EFF9] px-3 py-1.5 text-xs font-black text-[#9362AD]">{Object.keys(selectedPlatforms).length} {t.selected}</span>
              </div>

              {selectedInfluencer.social_accounts.length === 0 ? (
                <p className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">{t.noSocial}</p>
              ) : (
                <div className="mt-5 space-y-4">
                  {selectedInfluencer.social_accounts.map((account) => {
                    const selected = selectedPlatforms[account.id];
                    return (
                      <div key={account.id} className={`rounded-[22px] border p-5 transition ${selected ? "border-[#D8BDE3] bg-[#F7F8FF]" : "border-[#F1EAF5] bg-[#FDFBFE]"}`}>
                        <label className="flex cursor-pointer items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <input type="checkbox" checked={Boolean(selected)} onChange={() => togglePlatform(account)} className="h-5 w-5 accent-[#A170BA]" />
                            <div><p className="font-black text-[#513865]">{platformLabels[account.platform] ?? account.platform}</p><p className="mt-1 text-xs font-semibold text-[#95849D]">@{account.username} · {formatCompact(account.followersCount, locale)}</p></div>
                          </div>
                          {selected ? <span className="rounded-full bg-[#A170BA] px-3 py-1 text-[10px] font-black text-white">{t.selected}</span> : null}
                        </label>

                        {selected && effectiveRequiresContent ? (
                          <div className="mt-5 space-y-3 border-t border-[#E1E5F2] pt-5">
                            {selected.deliverables.map((deliverable) => (
                              <div key={deliverable.id} className="grid gap-3 rounded-2xl bg-white p-3 sm:grid-cols-[minmax(0,1fr)_120px_auto]">
                                <select value={deliverable.contentType} onChange={(event) => updateDeliverable(account.id, deliverable.id, { contentType: event.target.value })} className={smallInputClass}>
                                  {contentTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                                </select>
                                <input type="number" min={1} max={50} value={deliverable.quantity} onChange={(event) => updateDeliverable(account.id, deliverable.id, { quantity: Math.max(1, Number(event.target.value) || 1) })} className={smallInputClass} aria-label={t.quantity} />
                                <button type="button" onClick={() => removeDeliverable(account.id, deliverable.id)} className="rounded-xl border border-rose-100 bg-rose-50 px-3 text-xs font-black text-rose-600 disabled:opacity-40" disabled={selected.deliverables.length === 1}>{t.remove}</button>
                              </div>
                            ))}
                            <button type="button" onClick={() => addDeliverable(account.id)} className="inline-flex items-center gap-2 rounded-xl border border-[#EBDDF2] bg-white px-4 py-2 text-xs font-black text-[#9362AD]"><DashboardIcon name="plus" className="h-4 w-4" />{t.addContent}</button>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
              <FieldError errors={state.fieldErrors?.platformsJson} />
            </div>
          ) : null}

          <WizardFooter
            locale={locale}
            step={step}
            nextDisabled={!Boolean(selectedInfluencer?.available) || !platformValid}
            onNext={() => goTo(2)}
          />
        </CampaignPanel>
      ) : null}

      {step === 2 ? (
        <CampaignPanel title={t.step2Title} description={t.step2Subtitle}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Choice active={executionType === "home"} title={t.home} description={t.homeHint} icon="content" onClick={() => setExecutionType("home")} />
            <Choice active={executionType === "in_branch"} title={t.inBranch} description={t.inBranchHint} icon="users" onClick={() => setExecutionType("in_branch")} />
            <Choice active={executionType === "multiple"} title={t.multiple} description={t.multipleHint} icon="campaigns" onClick={() => setExecutionType("multiple")} />
            <Choice active={executionType === "remote"} title={t.other} description={t.otherHint} icon="sparkles" onClick={() => setExecutionType("remote")} />
          </div>

          {executionType === "multiple" ? (
            <div className="mt-6 rounded-[24px] border border-[#DCC8E8] bg-[#FBF7FD] p-5">
              <p className="text-sm font-black text-[#513865]">{t.multipleTitle}</p>
              <p className="mt-1 text-xs font-semibold leading-6 text-[#95849D]">{t.multipleDescription}</p>
            </div>
          ) : null}

          {isHomeMode ? (
            <div className="mt-6 grid gap-5 md:grid-cols-3">
              <Field label={t.orderNumber} required error={state.fieldErrors?.orderNumber?.[0]}>
                <input value={orderNumber} onChange={(event) => setOrderNumber(event.target.value)} className={inputClass} placeholder="ORD-0001" />
              </Field>
              <Field label={t.orderCode}>
                <input value={orderCode} onChange={(event) => setOrderCode(event.target.value)} className={inputClass} placeholder={t.orderCodePlaceholder} />
              </Field>
              <Field label={t.orderValue} required error={state.fieldErrors?.orderInvoiceAmount?.[0]}>
                <MoneyInput value={orderAmount} onChange={setOrderAmount} locale={locale} />
              </Field>
            </div>
          ) : null}

          {isBranchMode ? (
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <Field label={t.branch} required error={state.fieldErrors?.branchName?.[0]}>
                <input list="campaign-branch-options" value={branchName} onChange={(event) => setBranchName(event.target.value)} className={inputClass} placeholder={t.branchPlaceholder} />
                <BranchDatalist id="campaign-branch-options" branches={initialBranches} />
                <p className="mt-2 text-xs font-semibold leading-6 text-[#95849D]">{t.branchSaveHint}</p>
              </Field>
              <Field label={t.attendanceAt}>
                <input type="datetime-local" value={attendanceLocal} onChange={(event) => setAttendanceLocal(event.target.value)} className={inputClass} />
              </Field>
            </div>
          ) : null}

          {executionType === "remote" ? (
            <div className="mt-6 space-y-5">
              <Field label={t.otherDetails} required error={state.fieldErrors?.otherExecutionDetails?.[0]}>
                <textarea value={otherExecutionDetails} onChange={(event) => setOtherExecutionDetails(event.target.value)} className={textareaClass} placeholder={t.otherDetailsPlaceholder} />
              </Field>
              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[#ECE1F1] bg-[#FDFBFE] p-5">
                <input type="checkbox" checked={requiresContent} onChange={(event) => setRequiresContent(event.target.checked)} className="mt-1 h-5 w-5 accent-[#A170BA]" />
                <span><span className="block text-sm font-black text-[#513865]">{t.requiresContent}</span><span className="mt-1 block text-xs font-semibold leading-6 text-[#95849D]">{t.requiresContentHint}</span></span>
              </label>
            </div>
          ) : null}


          <WizardFooter locale={locale} step={step} nextDisabled={!collaborationValid} onPrevious={() => goTo(1)} onNext={() => goTo(3)} />
        </CampaignPanel>
      ) : null}

      {step === 3 ? (
        <CampaignPanel title={t.step3Title} description={t.step3Subtitle}>
          <div className="grid gap-4 md:grid-cols-3">
            <PaymentChoice active={selectedCompensations.bank_transfer} title={t.bankTransfer} description={t.bankHint} onClick={() => toggleCompensation("bank_transfer")} />
            <PaymentChoice active={selectedCompensations.voucher} title={t.voucher} description={t.voucherHint} onClick={() => toggleCompensation("voucher")} />
            <PaymentChoice active={selectedCompensations.product} title={t.products} description={t.productsHint} onClick={() => toggleCompensation("product")} />
          </div>

          {!Object.values(selectedCompensations).some(Boolean) ? <div className="mt-4 rounded-2xl border border-[#DFE4F3] bg-[#F8F9FD] px-5 py-4 text-sm font-bold text-[#737D9D]">{t.noCompensation}</div> : null}

          <div className="mt-6 space-y-5">
            {selectedCompensations.bank_transfer ? (
              <PaymentPanel title={t.bankTransfer} badge={t.bankBadge}>
                <div className="grid gap-5 md:grid-cols-2">
                  <Field label={t.bankAmount} required><MoneyInput value={bankAmount} onChange={setBankAmount} locale={locale} /></Field>
                  <Field label={t.expectedPayment}><input type="datetime-local" value={bankExpectedLocal} onChange={(event) => setBankExpectedLocal(event.target.value)} className={inputClass} /></Field>
                </div>
                <div className="mt-5"><Field label={t.bankNotes}><textarea value={bankNotes} onChange={(event) => setBankNotes(event.target.value)} className={textareaClass} placeholder={t.financeNotesPlaceholder} /></Field></div>
              </PaymentPanel>
            ) : null}

            {selectedCompensations.voucher ? (
              <PaymentPanel title={t.voucher} badge={t.voucherBadge}>
                <div className="grid gap-5 md:grid-cols-2">
                  <Field label={t.voucherAmount} required><MoneyInput value={voucherAmount} onChange={setVoucherAmount} locale={locale} /></Field>
                  <Field label={t.voucherSource} required>
                    <select value={voucherSource} onChange={(event) => setVoucherSource(event.target.value as "website" | "branch")} className={inputClass}>
                      <option value="website">{t.website}</option><option value="branch">{t.aBranch}</option>
                    </select>
                  </Field>
                </div>
                {voucherSource === "branch" ? (
                  <div className="mt-5"><Field label={t.voucherBranch} required><input list="voucher-branch-options" value={voucherBranch} onChange={(event) => setVoucherBranch(event.target.value)} className={inputClass} placeholder={t.branchPlaceholder} /><BranchDatalist id="voucher-branch-options" branches={initialBranches} /><p className="mt-2 text-xs font-semibold text-[#95849D]">{t.branchSaveHint}</p></Field></div>
                ) : null}
                <div className="mt-5"><Field label={t.voucherNotes}><textarea value={voucherNotes} onChange={(event) => setVoucherNotes(event.target.value)} className={textareaClass} placeholder={t.voucherNotesPlaceholder} /></Field></div>
              </PaymentPanel>
            ) : null}

            {selectedCompensations.product ? (
              <PaymentPanel title={t.products} badge={t.productsBadge}>
                <div className="grid gap-5 md:grid-cols-2">
                  <Field label={t.cashValue}><MoneyInput value="0" onChange={() => undefined} locale={locale} readOnly /></Field>
                  <Field label={t.productReference}><MoneyInput value={productReferenceValue} onChange={setProductReferenceValue} locale={locale} /></Field>
                </div>
                <div className="mt-5"><Field label={t.productDescription} required><textarea value={productDescription} onChange={(event) => setProductDescription(event.target.value)} className={textareaClass} placeholder={t.productDescriptionPlaceholder} /></Field></div>
                <div className="mt-5"><Field label={t.productNotes}><textarea value={productNotes} onChange={(event) => setProductNotes(event.target.value)} className={textareaClass} placeholder={t.productNotesPlaceholder} /></Field></div>
              </PaymentPanel>
            ) : null}
          </div>

          <FieldError errors={state.fieldErrors?.compensationsJson} />

          <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <BudgetCard label={t.estimatedBudget} value={budget.estimatedBudget} locale={locale} />
            <BudgetCard label={t.currentCommitted} value={budget.committedAmount} locale={locale} />
            <BudgetCard label={t.remainingBefore} value={budget.remainingAmount} locale={locale} />
            <BudgetCard label={t.remainingAfter} value={remainingAfter} locale={locale} danger={remainingAfter < 0} />
          </div>
          <div className="mt-4 rounded-2xl border border-[#F0E8F4] bg-[#FDFBFE] px-5 py-4 text-xs font-bold leading-7 text-[#7C86A4]">{t.budgetRule}</div>
          {overBudgetAfter > 0 ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold leading-7 text-amber-800">{t.overBudget} {formatMoney(overBudgetAfter, locale)}. {t.warningOnly}</div>
          ) : budgetAmount > 0 ? (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-700">{t.withinBudget} {formatMoney(remainingAfter, locale)}.</div>
          ) : null}

          <div className="mt-7 rounded-[22px] border border-[#ECE1F1] bg-[#F9FAFF] p-5">
            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" checked={hasContract} onChange={(event) => setHasContract(event.target.checked)} className="mt-1 h-5 w-5 accent-[#A170BA]" />
              <span><span className="block text-sm font-black text-[#405084]">{t.hasContract}</span><span className="mt-1 block text-xs font-semibold leading-6 text-[#8A92AA]">{t.contractHint}</span></span>
            </label>
            {hasContract ? (
              <div className="mt-5 grid gap-5 border-t border-[#E0E4F2] pt-5 md:grid-cols-2">
                <Field label={t.contractReference}><input name="contract_reference" value={contractReference} onChange={(event) => setContractReference(event.target.value)} className={inputClass} /></Field>
                <Field label={t.agreementDate}><input name="agreement_date" type="date" value={agreementDate} onChange={(event) => setAgreementDate(event.target.value)} className={inputClass} /></Field>
                <Field label={t.paymentTiming} required error={state.fieldErrors?.paymentTiming?.[0]}>
                  <select name="payment_timing" value={paymentTiming} onChange={(event) => setPaymentTiming(event.target.value as typeof paymentTiming)} className={inputClass}>
                    <option value="before_publish">{t.beforePublish}</option><option value="after_publish">{t.afterPublish}</option><option value="by_agreement">{t.byAgreement}</option>
                  </select>
                </Field>
                <Field label={t.contractNotes}><textarea name="contract_notes" value={contractNotes} onChange={(event) => setContractNotes(event.target.value)} className={textareaClass} /></Field>
              </div>
            ) : null}
          </div>

          <div className="mt-6"><Field label={t.coordinatorNotes}><textarea name="coordinator_notes" value={coordinatorNotes} onChange={(event) => setCoordinatorNotes(event.target.value)} className={textareaClass} placeholder={t.coordinatorNotesPlaceholder} /></Field></div>

          <div className="mt-7 rounded-[22px] border border-[#ECE1F1] bg-[#FDFBFE] p-5">
            <h3 className="font-black text-[#513865]">{t.summary}</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryItem label={t.influencer} value={selectedInfluencer?.full_name ?? "—"} />
              <SummaryItem label={t.platforms} value={`${platformsPayload.length}`} />
              <SummaryItem label={t.collaboration} value={executionType === "home" ? t.home : executionType === "in_branch" ? t.inBranch : executionType === "multiple" ? t.multiple : t.other} />
              <SummaryItem label={t.financialTotal} value={formatMoney(budgetAmount, locale)} />
            </div>
          </div>

          <WizardFooter locale={locale} step={step} onPrevious={() => goTo(2)} submitDisabled={!canSubmit} pending={pending} campaignName={campaignName} />
        </CampaignPanel>
      ) : null}

      <QuickInfluencerModal
        open={quickAddOpen}
        campaignId={campaignId}
        locale={locale}
        initialQuery={query}
        onClose={() => setQuickAddOpen(false)}
        onDuplicate={(mobile) => {
          setQuery(mobile);
          setSearchMessage(locale === "ar" ? "المؤثر مسجل مسبقًا؛ تم البحث عنه برقم الجوال." : "The influencer already exists; searching by mobile number.");
        }}
        onCreated={(influencer) => {
          setResults((current) => [influencer, ...current.filter((item) => item.influencer_id !== influencer.influencer_id)]);
          setSelectedInfluencer(influencer);
          setQuery(influencer.mobile_e164);
          const firstAccount = influencer.social_accounts[0];
          setSelectedPlatforms(firstAccount ? {
            [firstAccount.id]: { account: firstAccount, deliverables: [newDeliverable(t.defaultContentType)] },
          } : {});
          setSearchMessage(locale === "ar" ? "تم إنشاء ملف أولي للمؤثر واختياره للحملة." : "An initial influencer profile was created and selected.");
        }}
      />
    </form>
  );
}

const inputClass = "h-14 w-full rounded-2xl border border-[#ECE1F1] bg-[#FDFBFE] px-4 text-sm font-bold text-[#432A57] outline-none transition placeholder:text-[#AA9AAF] hover:border-[#D8BDE3] focus:border-[#A170BA] focus:bg-white focus:shadow-[0_0_0_4px_rgba(104,119,200,0.10)]";
const smallInputClass = "h-11 w-full rounded-xl border border-[#ECE1F1] bg-[#FDFBFE] px-3 text-xs font-bold text-[#432A57] outline-none focus:border-[#A170BA] focus:bg-white";
const textareaClass = `${inputClass} min-h-24 resize-y py-4 leading-7`;

function WizardHeader({ step, labels, onStep, stepOneReady, stepTwoReady }: { step: 1 | 2 | 3; labels: readonly string[]; onStep: (step: 1 | 2 | 3) => void; stepOneReady: boolean; stepTwoReady: boolean }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {labels.map((label, index) => {
        const number = (index + 1) as 1 | 2 | 3;
        const accessible = number === 1 || (number === 2 && stepOneReady) || (number === 3 && stepOneReady && stepTwoReady);
        const active = step === number;
        const completed = number < step;
        return (
          <button key={label} type="button" disabled={!accessible} onClick={() => onStep(number)} className={`flex items-center gap-3 rounded-[20px] border p-4 text-start transition ${active ? "border-[#A170BA] bg-[#F8F2FB] shadow-[0_0_0_4px_rgba(104,119,200,0.08)]" : completed ? "border-emerald-200 bg-emerald-50" : "border-[#F0E8F4] bg-white disabled:cursor-not-allowed disabled:opacity-55"}`}>
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-black ${active ? "bg-[#A170BA] text-white" : completed ? "bg-emerald-500 text-white" : "bg-[#F0F2FA] text-[#7B86B5]"}`}>{completed ? "✓" : number}</span>
            <span className="text-sm font-black text-[#513865]">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

function WizardFooter({ locale, step, onPrevious, onNext, nextDisabled, submitDisabled, pending, campaignName }: { locale: CampaignLocale; step: 1 | 2 | 3; onPrevious?: () => void; onNext?: () => void; nextDisabled?: boolean; submitDisabled?: boolean; pending?: boolean; campaignName?: string }) {
  const t = text(locale);
  return (
    <div className="mt-7 flex flex-col-reverse gap-3 border-t border-[#E4E7F2] pt-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-xs font-semibold text-[#95849D]">{step === 3 ? campaignName : `${t.stepLabel} ${step} / 3`}</div>
      <div className="flex gap-3">
        {onPrevious ? <button type="button" onClick={onPrevious} className="min-h-12 rounded-2xl border border-[#ECE1F1] bg-white px-5 text-sm font-black text-[#9362AD]">{t.previous}</button> : null}
        {onNext ? <button type="button" disabled={nextDisabled} onClick={onNext} className="min-h-12 rounded-2xl bg-[#A170BA] px-6 text-sm font-black text-white transition hover:bg-[#915FA9] disabled:cursor-not-allowed disabled:opacity-45">{t.next}</button> : null}
        {step === 3 ? <button type="submit" disabled={submitDisabled} className="inline-flex min-h-12 min-w-52 items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-[#A170BA] to-[#8C5BA5] px-6 text-sm font-black text-white shadow-[0_14px_30px_rgba(79,98,185,0.22)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45"><DashboardIcon name={pending ? "sparkles" : "plus"} className="h-5 w-5" />{pending ? t.saving : t.saveAssignment}</button> : null}
      </div>
    </div>
  );
}

function Choice({ active, title, description, icon, onClick }: { active: boolean; title: string; description: string; icon: "content" | "users" | "sparkles"; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`rounded-[22px] border p-5 text-start transition ${active ? "border-[#A170BA] bg-[#F8F2FB] shadow-[0_0_0_4px_rgba(104,119,200,0.08)]" : "border-[#F0E8F4] bg-[#FDFBFE] hover:border-[#D8BDE3] hover:bg-white"}`}><span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${active ? "bg-[#A170BA] text-white" : "bg-white text-[#A170BA]"}`}><DashboardIcon name={icon} className="h-5 w-5" /></span><span className="mt-4 block font-black text-[#513865]">{title}</span><span className="mt-1 block text-xs font-semibold leading-6 text-[#95849D]">{description}</span></button>;
}
function PaymentChoice({ active, title, description, onClick }: { active: boolean; title: string; description: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`rounded-[22px] border p-5 text-start transition ${active ? "border-[#A170BA] bg-[#F8F2FB] shadow-[0_0_0_4px_rgba(104,119,200,0.08)]" : "border-[#F0E8F4] bg-[#FDFBFE] hover:border-[#D8BDE3] hover:bg-white"}`}><span className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl text-lg font-black ${active ? "bg-[#A170BA] text-white" : "bg-white text-[#7B86B5]"}`}>{active ? "✓" : "+"}</span><span className="block font-black text-[#513865]">{title}</span><span className="mt-1 block text-xs font-semibold leading-6 text-[#95849D]">{description}</span></button>;
}
function PaymentPanel({ title, badge, children }: { title: string; badge: string; children: React.ReactNode }) {
  return <section className="rounded-[22px] border border-[#E1E5F2] bg-[#FDFBFE] p-5"><div className="mb-5 flex items-center justify-between gap-3"><h3 className="font-black text-[#513865]">{title}</h3><span className="rounded-full bg-[#F6EFF9] px-3 py-1 text-[10px] font-black text-[#9362AD]">{badge}</span></div>{children}</section>;
}
function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 block text-xs font-black text-[#5B668E]">{label}{required ? <span className="text-rose-500"> *</span> : null}</span>{children}{error ? <span className="mt-2 block text-xs font-bold text-rose-600">{error}</span> : null}</label>;
}
function FieldError({ errors }: { errors?: string[] }) { return errors?.length ? <p className="mt-3 text-xs font-bold text-rose-600">{errors[0]}</p> : null; }
function MoneyInput({ value, onChange, locale, readOnly = false }: { value: string; onChange: (value: string) => void; locale: CampaignLocale; readOnly?: boolean }) {
  return <div className="relative"><input value={value} onChange={(event) => onChange(event.target.value)} inputMode="decimal" readOnly={readOnly} className={`${inputClass} pe-20 ${readOnly ? "cursor-not-allowed bg-[#F2F4FA] text-[#78819B]" : ""}`} placeholder="0.00" /><span className="absolute end-4 top-1/2 -translate-y-1/2 rounded-lg bg-[#F6EFF9] px-3 py-1 text-xs font-black text-[#6171C7]">{locale === "ar" ? "ر.س" : "SAR"}</span></div>;
}
function BranchDatalist({ id, branches }: { id: string; branches: BranchOption[] }) { return <datalist id={id}>{branches.map((branch) => <option key={branch.id} value={branch.name} />)}</datalist>; }
function Chip({ children }: { children: React.ReactNode }) { return <span className="rounded-full bg-white px-3 py-1.5 text-[10px] font-black text-[#6F7A9C] shadow-sm">{children}</span>; }
function AvailabilityBadge({ influencer, locale }: { influencer: InfluencerResult; locale: CampaignLocale }) { return <span className={`rounded-full px-3 py-1.5 text-[10px] font-black ${influencer.available ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{influencer.available ? (locale === "ar" ? "متاح" : "Available") : (locale === "ar" ? "غير متاح" : "Unavailable")}</span>; }
function BudgetCard({ label, value, locale, danger = false }: { label: string; value: number; locale: CampaignLocale; danger?: boolean }) { return <div className={`rounded-[20px] border p-4 ${danger ? "border-rose-200 bg-rose-50" : "border-[#F1EAF5] bg-[#FDFBFE]"}`}><p className={`text-xs font-bold ${danger ? "text-rose-600" : "text-[#95849D]"}`}>{label}</p><p className={`mt-2 text-base font-black ${danger ? "text-rose-700" : "text-[#513865]"}`}>{formatMoney(value, locale)}</p></div>; }
function SummaryItem({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-white p-3"><p className="text-[10px] font-bold text-[#9C8CA4]">{label}</p><p className="mt-1 truncate text-xs font-black text-[#624B72]">{value}</p></div>; }
function Spinner() { return <span className="block h-5 w-5 animate-spin rounded-full border-2 border-[#C7CEEA] border-t-[#A170BA]" />; }

function availabilityDescription(influencer: InfluencerResult, locale: CampaignLocale) {
  if (influencer.availability_reason === "active_assignment") return locale === "ar" ? `مرتبط حاليًا بحملة ${influencer.blocking_campaign_name ?? "أخرى"}.` : `Currently assigned to ${influencer.blocking_campaign_name ?? "another campaign"}.`;
  if (influencer.availability_reason === "settlement_pending") return locale === "ar" ? `لم تتم تسوية كامل مستحقاته في حملة ${influencer.blocking_campaign_name ?? "سابقة"}.` : `Final settlement is pending for ${influencer.blocking_campaign_name ?? "a previous campaign"}.`;
  if (influencer.availability_reason === "cooldown") {
    const date = influencer.blocked_until ? new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-US", { dateStyle: "medium" }).format(new Date(influencer.blocked_until)) : "—";
    return locale === "ar" ? `فترة الحظر مستمرة حتى ${date}${influencer.days_remaining ? `، المتبقي ${influencer.days_remaining} يومًا` : ""}.` : `Cooldown continues until ${date}${influencer.days_remaining ? `, ${influencer.days_remaining} days remaining` : ""}.`;
  }
  return locale === "ar" ? "غير متاح للربط حاليًا." : "Currently unavailable for assignment.";
}
function parseMoney(value: string) { const number = Number(value.replace(/[\s,]/g, "")); return Number.isFinite(number) ? Math.max(number, 0) : 0; }
function toIsoValue(value: string) { return value ? new Date(value).toISOString() : ""; }
function formatMoney(value: number, locale: CampaignLocale) { return new Intl.NumberFormat(locale === "ar" ? "ar-SA" : "en-US", { style: "currency", currency: "SAR", maximumFractionDigits: 0 }).format(Number(value || 0)); }
function formatCompact(value: number | null, locale: CampaignLocale) { if (value === null) return "—"; return new Intl.NumberFormat(locale === "ar" ? "ar-SA" : "en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value); }

function text(locale: CampaignLocale) {
  if (locale === "en") return {
    steps: ["Influencer and social accounts", "Collaboration options", "Payment and contract"], stepLabel: "Step", previous: "Previous", next: "Next", saving: "Saving...", saveAssignment: "Save and add influencer",
    step1Title: "1. Choose influencer and social accounts", step1Subtitle: "Search for the influencer, verify availability and select the social accounts used in this campaign.",
    searchPlaceholder: "Search by name, mobile digits or username", quickAdd: "Add a new influencer", searchFailed: "Influencer search failed.", noResults: "No matching influencer was found.", cityUnknown: "City not set", profileCompletion: "Profile", accounts: "accounts", selected: "selected", socialTitle: "Social accounts and deliverables", socialHint: "Choose one or more accounts and define the content required from each.", noSocial: "This influencer has no social accounts.", quantity: "Quantity", remove: "Remove", addContent: "Add content item", defaultContentType: "Reel",
    step2Title: "2. Collaboration options", step2Subtitle: "Choose home, in-branch, combined, or another collaboration type, then set the operational details.", home: "Home collaboration", homeHint: "Products are delivered to the creator for home content.", inBranch: "In-branch collaboration", inBranchHint: "The creator attends a selected branch.", multiple: "Combined collaboration", multipleHint: "Use home delivery and in-branch attendance in the same assignment.", multipleTitle: "Home + in-branch collaboration", multipleDescription: "Both home-order and branch-attendance fields are enabled together. The agreed compensation is set in the next step.", other: "Other", otherHint: "A custom collaboration agreed with the creator.", orderNumber: "Order number", orderCode: "Order code", orderCodePlaceholder: "Discount or delivery code", orderValue: "Order value", branch: "Branch", branchPlaceholder: "Search or type a new branch", branchSaveHint: "A new branch will be saved for future team use.", attendanceAt: "Attendance date and time", otherDetails: "Other collaboration details", otherDetailsPlaceholder: "Describe the collaboration and required execution...", requiresContent: "This collaboration requires content and publishing", requiresContentHint: "Disable it when the custom collaboration has no content deliverables.", contentDue: "Content due date", publishingDate: "Publishing date",
    step3Title: "3. Compensation, payment and contract", step3Subtitle: "Select one or more compensation types. Each selected type has its own amount and details.", bankTransfer: "Bank transfer", bankHint: "Cash amount processed by finance.", voucher: "Shopping voucher", voucherHint: "Redeemed online or at a selected branch.", products: "Products", productsHint: "Cash value is zero while product value is kept for reporting.", noCompensation: "No compensation was selected. The assignment will be saved as unpaid.", bankBadge: "Transfer", voucherBadge: "Voucher", productsBadge: "Products", bankAmount: "Transfer amount", expectedPayment: "Expected payment date", bankNotes: "Transfer notes", financeNotesPlaceholder: "Any information required by finance...", voucherAmount: "Voucher value", voucherSource: "Voucher redemption", website: "Online store", aBranch: "A branch", voucherBranch: "Voucher branch", voucherNotes: "Voucher notes", voucherNotesPlaceholder: "Voucher code or delivery method when available...", cashValue: "Cash payment value", productReference: "Product value for reporting", productDescription: "Product description", productDescriptionPlaceholder: "List the products or package provided to the influencer...", productNotes: "Product delivery notes", productNotesPlaceholder: "Preparation date or delivery method...", estimatedBudget: "Estimated budget", currentCommitted: "Currently committed", remainingBefore: "Remaining before", remainingAfter: "Remaining after", budgetRule: "Only bank transfers and vouchers count against the influencer campaign budget. Home order and product values are reported separately.", overBudget: "The estimated budget will be exceeded by", warningOnly: "This is a warning and does not prevent saving.", withinBudget: "Compensation is within budget. Remaining after adding:", hasContract: "This collaboration is governed by a contract or agreement", contractHint: "Finance will see the contract flag and payment timing clearly.", contractReference: "Contract or agreement reference", agreementDate: "Agreement date", paymentTiming: "Payment timing", beforePublish: "Before publishing", afterPublish: "After publishing", byAgreement: "By agreement", contractNotes: "Contract notes", coordinatorNotes: "Coordinator notes", coordinatorNotesPlaceholder: "Internal coordination notes for this influencer...", summary: "Assignment summary", influencer: "Influencer", platforms: "Platforms", collaboration: "Collaboration", financialTotal: "Financial total",
  } as const;
  return {
    steps: ["اختيار المؤثر وحسابات السوشيال", "خيارات التعاون", "الدفع والعقد"], stepLabel: "الخطوة", previous: "السابق", next: "التالي", saving: "جاري الحفظ...", saveAssignment: "حفظ وإضافة المؤثر",
    step1Title: "1. اختيار المؤثر وحسابات السوشيال ميديا", step1Subtitle: "ابحثي عن المؤثر وتحققي من توفره ثم اختاري الحسابات المستخدمة في الحملة.",
    searchPlaceholder: "اكتبي اسم المؤثر أو آخر أرقام الجوال أو اسم المستخدم", quickAdd: "إضافة مؤثر جديد", searchFailed: "تعذر البحث عن المؤثرين.", noResults: "لم نجد مؤثرًا مطابقًا لبيانات البحث.", cityUnknown: "المدينة غير محددة", profileCompletion: "اكتمال الملف", accounts: "حساب", selected: "محدد", socialTitle: "حسابات التواصل والمحتوى", socialHint: "اختاري حسابًا أو أكثر وحددي المحتوى المطلوب من كل حساب.", noSocial: "لا توجد حسابات تواصل مسجلة لهذا المؤثر.", quantity: "العدد", remove: "حذف", addContent: "إضافة محتوى", defaultContentType: "ريلز",
    step2Title: "2. تحديد خيارات التعاون", step2Subtitle: "اختاري منزلي أو حضوري أو تعاونًا متعددًا أو نوعًا آخر ثم أدخلي تفاصيل التنفيذ.", home: "تعاون منزلي", homeHint: "إرسال طلب ومنتجات لصانع المحتوى للتصوير من المنزل.", inBranch: "تعاون حضوري", inBranchHint: "حضور صانع المحتوى إلى أحد الفروع المحددة.", multiple: "تعاونات متعددة", multipleHint: "دمج التعاون المنزلي والحضوري في نفس التكليف.", multipleTitle: "تعاون منزلي + حضوري", multipleDescription: "سيتم فتح مدخلات الطلب المنزلي والفرع والحضور معًا. يتم تحديد المقابل المالي للتعاون المدمج في الخطوة التالية.", other: "أخرى", otherHint: "تنفيذ خاص يتم الاتفاق عليه مع صانع المحتوى.", orderNumber: "رقم الطلب", orderCode: "كود الطلب", orderCodePlaceholder: "كود الخصم أو التسليم", orderValue: "قيمة الطلب", branch: "الفرع", branchPlaceholder: "ابحثي أو اكتبي اسم فرع جديد", branchSaveHint: "الفرع الجديد سيُحفظ لاستخدام الفريق مستقبلًا.", attendanceAt: "تاريخ ووقت الحضور", otherDetails: "تفاصيل التعاون الآخر", otherDetailsPlaceholder: "اشرحي نوع التعاون وطريقة التنفيذ المطلوبة...", requiresContent: "هذا التعاون يتطلب محتوى ونشر", requiresContentHint: "أزيلي الاختيار إذا كان التعاون الآخر لا يتضمن محتوى.", contentDue: "موعد تسليم المحتوى", publishingDate: "موعد النشر",
    step3Title: "3. تفاصيل المقابل والدفع والعقد", step3Subtitle: "يمكن اختيار أكثر من نوع مقابل، ولكل خيار مبلغ وتفاصيل مستقلة.", bankTransfer: "تحويل بنكي", bankHint: "مبلغ نقدي تتم معالجته من الإدارة المالية.", voucher: "قسيمة مشتريات", voucherHint: "تُصرف من الموقع أو من فرع محدد.", products: "مقابل منتجات", productsHint: "القيمة النقدية صفر مع حفظ قيمة المنتجات للتقارير.", noCompensation: "لم يتم اختيار مقابل؛ سيُحفظ التكليف كبدون مقابل.", bankBadge: "تحويل", voucherBadge: "قسيمة", productsBadge: "منتجات", bankAmount: "قيمة التحويل", expectedPayment: "موعد الدفع المتوقع", bankNotes: "ملاحظات التحويل", financeNotesPlaceholder: "أي تفاصيل مطلوبة للإدارة المالية...", voucherAmount: "قيمة القسيمة", voucherSource: "مكان صرف القسيمة", website: "الموقع الإلكتروني", aBranch: "أحد الفروع", voucherBranch: "فرع صرف القسيمة", voucherNotes: "ملاحظات القسيمة", voucherNotesPlaceholder: "كود القسيمة أو طريقة التسليم عند توفرها...", cashValue: "القيمة النقدية للدفع", productReference: "قيمة المنتجات للتقارير", productDescription: "وصف المنتجات", productDescriptionPlaceholder: "اكتبي المنتجات أو الباقة التي سيحصل عليها المؤثر...", productNotes: "ملاحظات تسليم المنتجات", productNotesPlaceholder: "موعد التجهيز أو طريقة التسليم...", estimatedBudget: "الميزانية التقديرية", currentCommitted: "المبلغ المرتبط حاليًا", remainingBefore: "المتبقي قبل الإضافة", remainingAfter: "المتبقي بعد الإضافة", budgetRule: "يُخصم من ميزانية الحملة مجموع التحويلات البنكية وقيم القسائم فقط. قيمة الطلب المنزلي وقيمة المنتجات تظهران في التقارير بشكل منفصل.", overBudget: "سيتم تجاوز الميزانية التقديرية بمبلغ", warningOnly: "هذا تنبيه فقط ولن يمنع الحفظ.", withinBudget: "المقابل المالي ضمن الميزانية، والمتبقي بعد الإضافة", hasContract: "هذا التعاون مقيد بعقد أو اتفاق", contractHint: "سيظهر للإدارة المالية مع توقيت الدفع بشكل واضح.", contractReference: "مرجع العقد أو الاتفاق", agreementDate: "تاريخ الاتفاق", paymentTiming: "توقيت الدفع", beforePublish: "قبل النشر", afterPublish: "بعد النشر", byAgreement: "حسب الاتفاق", contractNotes: "ملاحظات العقد", coordinatorNotes: "ملاحظات المنسق العامة", coordinatorNotesPlaceholder: "ملاحظات داخلية لتنسيق هذا المؤثر...", summary: "ملخص التكليف", influencer: "المؤثر", platforms: "المنصات", collaboration: "نوع التعاون", financialTotal: "إجمالي المقابل المالي",
  } as const;
}
