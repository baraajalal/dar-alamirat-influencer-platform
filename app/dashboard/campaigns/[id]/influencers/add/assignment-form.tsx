"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import {
  createCampaignAssignment,
  type AssignmentActionState,
} from "./actions";

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

type Deliverable = {
  id: string;
  contentType: string;
  quantity: number;
};

type SelectedPlatform = {
  account: SocialAccount;
  deliverables: Deliverable[];
};

type BudgetSummary = {
  estimatedBudget: number;
  committedAmount: number;
  remainingAmount: number;
  paidAmount: number;
  awaitingPayment: number;
  overBudgetAmount: number;
  usagePercentage: number | null;
};

type BranchOption = {
  id: string;
  name: string;
};

type Props = {
  campaignId: string;
  campaignName: string;
  defaultContentDueLocal: string;
  defaultPublishingDate: string;
  budget: BudgetSummary;
  initialBranches: BranchOption[];
};

type CompensationSelection = {
  bank_transfer: boolean;
  voucher: boolean;
  product: boolean;
};

const initialState: AssignmentActionState = { ok: false, message: "" };

const contentTypes = [
  "ريلز",
  "ستوري",
  "بوست صورة",
  "فيديو تيك توك",
  "سناب",
  "تغطية زيارة",
  "فتح صندوق",
  "مراجعة منتج",
  "بث مباشر",
  "أخرى",
];

const platformLabels: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  snapchat: "Snapchat",
  youtube: "YouTube",
  x: "X",
  facebook: "Facebook",
  other: "منصة أخرى",
};

const inputClass =
  "h-14 w-full rounded-2xl border border-[#D8DDF7] bg-white px-4 text-sm font-bold text-[#33447F] outline-none transition placeholder:text-[#A4ABC3] hover:border-[#A9B9E6] focus:border-[#6877C8] focus:shadow-[0_0_0_4px_rgba(104,119,200,0.11)]";

function newDeliverable(): Deliverable {
  return {
    id: crypto.randomUUID(),
    contentType: "ريلز",
    quantity: 1,
  };
}

export default function AssignmentForm({
  campaignId,
  campaignName,
  defaultContentDueLocal,
  defaultPublishingDate,
  budget,
  initialBranches,
}: Props) {
  const [state, formAction, pending] = useActionState(
    createCampaignAssignment,
    initialState,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState("");
  const [results, setResults] = useState<InfluencerResult[]>([]);
  const [selectedInfluencer, setSelectedInfluencer] =
    useState<InfluencerResult | null>(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState<
    Record<string, SelectedPlatform>
  >({});

  const [executionType, setExecutionType] = useState<
    "home" | "in_branch" | "remote"
  >("home");
  const [otherExecutionDetails, setOtherExecutionDetails] = useState("");
  const [requiresContent, setRequiresContent] = useState(true);
  const [contentDueLocal, setContentDueLocal] = useState(
    defaultContentDueLocal,
  );
  const [publishingDate, setPublishingDate] = useState(
    defaultPublishingDate,
  );
  const [branchName, setBranchName] = useState("");
  const [attendanceLocal, setAttendanceLocal] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [orderAmount, setOrderAmount] = useState("");
  const [orderNotes, setOrderNotes] = useState("");

  const [selectedCompensations, setSelectedCompensations] =
    useState<CompensationSelection>({
      bank_transfer: true,
      voucher: false,
      product: false,
    });
  const [bankAmount, setBankAmount] = useState("");
  const [bankExpectedLocal, setBankExpectedLocal] = useState("");
  const [bankNotes, setBankNotes] = useState("");
  const [voucherAmount, setVoucherAmount] = useState("");
  const [voucherSource, setVoucherSource] = useState<"website" | "branch">(
    "website",
  );
  const [voucherBranch, setVoucherBranch] = useState("");
  const [voucherNotes, setVoucherNotes] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [productReferenceValue, setProductReferenceValue] = useState("");
  const [productNotes, setProductNotes] = useState("");

  const [hasContract, setHasContract] = useState(false);
  const [contractReference, setContractReference] = useState("");
  const [agreementDate, setAgreementDate] = useState("");
  const [paymentTiming, setPaymentTiming] = useState<
    "before_publish" | "after_publish" | "by_agreement"
  >("before_publish");
  const [contractNotes, setContractNotes] = useState("");
  const [coordinatorNotes, setCoordinatorNotes] = useState("");

  const contentDueIsoRef = useRef<HTMLInputElement>(null);
  const attendanceIsoRef = useRef<HTMLInputElement>(null);

  const effectiveRequiresContent =
    executionType === "remote" ? requiresContent : true;

useEffect(() => {
  const trimmed = searchQuery.trim();
  const digits = trimmed.replace(/\D/g, "");

  if (trimmed.length < 2 && digits.length < 4) {
    return;
  }

  const controller = new AbortController();

  const searchInfluencers = async () => {
    try {
      setSearching(true);

      const response = await fetch(
        `/api/campaigns/influencers/search?q=${encodeURIComponent(trimmed)}`,
        {
          signal: controller.signal,
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "تعذر البحث عن المؤثرين");
      }

      setResults(result.influencers ?? []);
      setSearchMessage(
        result.influencers?.length
          ? ""
          : "لم يتم العثور على مؤثر مطابق",
      );
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === "AbortError"
      ) {
        return;
      }

      setResults([]);
      setSearchMessage(
        error instanceof Error
          ? error.message
          : "حدث خطأ أثناء البحث",
      );
    } finally {
      if (!controller.signal.aborted) {
        setSearching(false);
      }
    }
  };

  void searchInfluencers();

  return () => {
    controller.abort();
  };
}, [searchQuery]);

  const platformsPayload = useMemo(
    () =>
      Object.values(selectedPlatforms).map((platform) => ({
        socialAccountId: platform.account.id,
        deliverables: effectiveRequiresContent
          ? platform.deliverables.map((item) => ({
              contentType: item.contentType,
              quantity: item.quantity,
            }))
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
        productReferenceValue: parseMoney(productReferenceValue),
      });
    }

    return items;
  }, [
    bankAmount,
    bankExpectedLocal,
    bankNotes,
    productDescription,
    productNotes,
    productReferenceValue,
    selectedCompensations,
    voucherAmount,
    voucherBranch,
    voucherNotes,
    voucherSource,
  ]);

  const compensationValid =
    (!selectedCompensations.bank_transfer || bankNumeric > 0) &&
    (!selectedCompensations.voucher ||
      (voucherNumeric > 0 &&
        (voucherSource === "website" || voucherBranch.trim() !== ""))) &&
    (!selectedCompensations.product || productDescription.trim() !== "");

  const collaborationValid =
    (executionType !== "home" ||
      (orderNumber.trim() !== "" && orderAmount.trim() !== "")) &&
    (executionType !== "in_branch" || branchName.trim() !== "") &&
    (executionType !== "remote" || otherExecutionDetails.trim() !== "");

  const platformValid =
    platformsPayload.length > 0 &&
    (!effectiveRequiresContent ||
      platformsPayload.every((platform) => platform.deliverables.length > 0));

  const canSubmit =
    Boolean(selectedInfluencer?.available) &&
    platformValid &&
    collaborationValid &&
    compensationValid &&
    (!hasContract || Boolean(paymentTiming)) &&
    !pending;

  function selectInfluencer(influencer: InfluencerResult) {
    setSelectedInfluencer(influencer);
    setSelectedPlatforms({});
  }

  function togglePlatform(account: SocialAccount) {
    setSelectedPlatforms((current) => {
      const next = { ...current };
      if (next[account.id]) {
        delete next[account.id];
      } else {
        next[account.id] = { account, deliverables: [newDeliverable()] };
      }
      return next;
    });
  }

  function updateDeliverable(
    accountId: string,
    deliverableId: string,
    patch: Partial<Deliverable>,
  ) {
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
        deliverables: [
          ...current[accountId].deliverables,
          newDeliverable(),
        ],
      },
    }));
  }

  function removeDeliverable(accountId: string, deliverableId: string) {
    setSelectedPlatforms((current) => {
      const platform = current[accountId];
      if (platform.deliverables.length === 1) return current;
      return {
        ...current,
        [accountId]: {
          ...platform,
          deliverables: platform.deliverables.filter(
            (item) => item.id !== deliverableId,
          ),
        },
      };
    });
  }

  function toggleCompensation(type: keyof CompensationSelection) {
    setSelectedCompensations((current) => ({
      ...current,
      [type]: !current[type],
    }));
  }

  function prepareSubmission() {
    if (contentDueIsoRef.current) {
      contentDueIsoRef.current.value = effectiveRequiresContent
        ? toIsoValue(contentDueLocal)
        : "";
    }
    if (attendanceIsoRef.current) {
      attendanceIsoRef.current.value =
        executionType === "in_branch" ? toIsoValue(attendanceLocal) : "";
    }
  }

  return (
    <form action={formAction} onSubmit={prepareSubmission} className="space-y-6">
      <input type="hidden" name="campaign_id" value={campaignId} />
      <input
        type="hidden"
        name="influencer_id"
        value={selectedInfluencer?.influencer_id ?? ""}
      />
      <input
        type="hidden"
        name="platforms_json"
        value={JSON.stringify(platformsPayload)}
      />
      <input
        type="hidden"
        name="compensations_json"
        value={JSON.stringify(compensationsPayload)}
      />
      <input type="hidden" name="execution_type" value={executionType} />
      <input
        type="hidden"
        name="requires_content"
        value={String(effectiveRequiresContent)}
      />
      <input ref={contentDueIsoRef} type="hidden" name="content_due_at_iso" />
      <input ref={attendanceIsoRef} type="hidden" name="attendance_at_iso" />
      <input type="hidden" name="has_contract" value={String(hasContract)} />
      <input type="hidden" name="currency" value="SAR" />

      {state.message && !state.ok && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-bold leading-7 text-rose-700">
          {state.message}
        </div>
      )}

      <section className="rounded-[28px] border border-white/80 bg-white/94 p-5 shadow-[0_20px_55px_rgba(72,84,150,0.09)] sm:p-7">
        <SectionTitle
          number="01"
          title="اختيار المؤثر وحسابات السوشيال ميديا"
          subtitle="ابحثي عن المؤثر، ثم اختاري الحسابات التي سيُنفذ من خلالها التعاون"
        />

        <div className="relative mt-6">
          <input
            value={query}
           onChange={(event) => {
  const value = event.target.value;
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");

  setSearchQuery(value);

  if (trimmed.length < 2 && digits.length < 4) {
    setResults([]);
    setSearchMessage("");
    setSearching(false);
  }
}}
            className={`${inputClass} pr-12`}
            placeholder="اكتبي اسم المؤثر، آخر أرقام الجوال أو اسم المستخدم"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#7A87C5]">
            {searching ? <Spinner /> : <SearchIcon />}
          </span>
        </div>

        {searchMessage && (
          <p className="mt-4 rounded-2xl bg-[#F8F9FF] px-4 py-3 text-sm font-bold text-[#7E88A7]">
            {searchMessage}
          </p>
        )}

        {results.length > 0 && (
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {results.map((influencer) => {
              const active =
                selectedInfluencer?.influencer_id === influencer.influencer_id;
              return (
                <button
                  key={influencer.influencer_id}
                  type="button"
                  onClick={() => selectInfluencer(influencer)}
                  className={`rounded-[22px] border p-5 text-right transition ${
                    active
                      ? "border-[#6877C8] bg-[#F1F3FF] shadow-[0_0_0_4px_rgba(104,119,200,0.10)]"
                      : "border-[#E3E7F5] bg-white hover:border-[#A9B9E6] hover:bg-[#FBFCFF]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-[#35467E]">
                        {influencer.full_name}
                      </p>
                      <p
                        dir="ltr"
                        className="mt-1 text-right text-xs text-[#8991A9]"
                      >
                        {influencer.mobile_e164}
                      </p>
                    </div>
                    <AvailabilityBadge influencer={influencer} />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs">
                    <InfoChip>{influencer.city || "المدينة غير محددة"}</InfoChip>
                    <InfoChip>اكتمال الملف {influencer.profile_completion}%</InfoChip>
                    <InfoChip>{influencer.social_accounts.length} منصة</InfoChip>
                  </div>
                  {!influencer.available && (
                    <p className="mt-4 rounded-xl bg-rose-50 px-3 py-3 text-xs font-bold leading-6 text-rose-700">
                      {availabilityDescription(influencer)}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {selectedInfluencer && (
          <div className="mt-7 border-t border-[#E5E8F5] pt-7">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-black text-[#3A4B80]">
                  حسابات {selectedInfluencer.full_name}
                </h3>
                <p className="mt-1 text-xs leading-6 text-[#8790AA]">
                  يمكنك اختيار أكثر من حساب. عند عدم وجود محتوى في خيار «أخرى» سيتم حفظ الحسابات دون إنشاء قطع محتوى.
                </p>
              </div>
              <span className="rounded-full bg-[#EEF1FF] px-4 py-2 text-xs font-black text-[#6575C7]">
                تم اختيار {Object.keys(selectedPlatforms).length}
              </span>
            </div>

            {!selectedInfluencer.available ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm font-bold leading-7 text-rose-700">
                {availabilityDescription(selectedInfluencer)}
              </div>
            ) : selectedInfluencer.social_accounts.length === 0 ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm font-bold text-amber-800">
                لا توجد حسابات تواصل محفوظة لهذا المؤثر. حدّثي ملفه قبل ربطه بالحملة.
              </div>
            ) : (
              <div className="space-y-4">
                {selectedInfluencer.social_accounts.map((account) => {
                  const selected = selectedPlatforms[account.id];
                  return (
                    <div
                      key={account.id}
                      className={`rounded-[22px] border p-4 transition ${
                        selected
                          ? "border-[#8C99E8] bg-[#F7F8FF]"
                          : "border-[#E4E7F4] bg-white"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => togglePlatform(account)}
                        className="flex w-full items-center justify-between gap-4 text-right"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`flex h-11 w-11 items-center justify-center rounded-2xl font-black ${
                              selected
                                ? "bg-[#6877C8] text-white"
                                : "bg-[#EEF1FA] text-[#6877C8]"
                            }`}
                          >
                            {selected ? "✓" : "+"}
                          </span>
                          <div>
                            <p className="font-black text-[#384A80]">
                              {platformLabels[account.platform] ?? account.platform}
                            </p>
                            <p
                              dir="ltr"
                              className="mt-1 text-right text-xs text-[#8991AA]"
                            >
                              @{account.username}
                            </p>
                          </div>
                        </div>
                        <span className="rounded-full bg-white px-3 py-2 text-xs font-black text-[#6975A5] shadow-sm">
                          {formatCompact(account.followersCount)} متابع
                        </span>
                      </button>

                      {selected && effectiveRequiresContent && (
                        <div className="mt-5 space-y-3 border-t border-[#E1E5F4] pt-5">
                          {selected.deliverables.map((deliverable) => (
                            <div
                              key={deliverable.id}
                              className="grid gap-3 rounded-2xl bg-white p-3 md:grid-cols-[1fr_130px_44px]"
                            >
                              <select
                                value={deliverable.contentType}
                                onChange={(event) =>
                                  updateDeliverable(account.id, deliverable.id, {
                                    contentType: event.target.value,
                                  })
                                }
                                className={inputClass}
                              >
                                {contentTypes.map((type) => (
                                  <option key={type} value={type}>
                                    {type}
                                  </option>
                                ))}
                              </select>
                              <input
                                type="number"
                                min={1}
                                max={50}
                                value={deliverable.quantity}
                                onChange={(event) =>
                                  updateDeliverable(account.id, deliverable.id, {
                                    quantity: Math.max(
                                      1,
                                      Math.min(
                                        50,
                                        Number(event.target.value) || 1,
                                      ),
                                    ),
                                  })
                                }
                                className={inputClass}
                                aria-label="عدد القطع"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  removeDeliverable(account.id, deliverable.id)
                                }
                                disabled={selected.deliverables.length === 1}
                                className="flex h-14 items-center justify-center rounded-2xl border border-rose-100 text-rose-500 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-30"
                                aria-label="حذف نوع المحتوى"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => addDeliverable(account.id)}
                            className="rounded-xl border border-dashed border-[#A9B9E6] px-4 py-3 text-xs font-black text-[#6373C4] transition hover:bg-white"
                          >
                            + إضافة نوع محتوى آخر
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
        <FieldError errors={state.fieldErrors?.platformsJson} />
      </section>

      <section className="rounded-[28px] border border-white/80 bg-white/94 p-5 shadow-[0_20px_55px_rgba(72,84,150,0.09)] sm:p-7">
        <SectionTitle
          number="02"
          title="تحديد خيارات التعاون"
          subtitle="اختاري منزلي أو حضوري أو تعاون آخر، وستظهر الحقول المطلوبة فقط"
        />

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <ChoiceCard
            active={executionType === "home"}
            title="منزلي"
            description="إرسال طلب للمؤثر وتنفيذ المحتوى من المنزل"
            onClick={() => setExecutionType("home")}
          />
          <ChoiceCard
            active={executionType === "in_branch"}
            title="حضوري"
            description="زيارة أحد فروع دار الأميرات أو موقع فعالية"
            onClick={() => setExecutionType("in_branch")}
          />
          <ChoiceCard
            active={executionType === "remote"}
            title="أخرى"
            description="اتفاق خاص أو تعاون لا يندرج تحت الخيارين السابقين"
            onClick={() => setExecutionType("remote")}
          />
        </div>

        {executionType === "home" && (
          <div className="mt-6 rounded-[22px] border border-[#E1E5F4] bg-[#FAFBFF] p-5">
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="رقم الطلب" required>
                <input
                  name="order_number"
                  value={orderNumber}
                  onChange={(event) => setOrderNumber(event.target.value)}
                  className={inputClass}
                  placeholder="مثال: ORD-10245"
                />
                <FieldError errors={state.fieldErrors?.orderNumber} />
              </Field>
              <Field label="مبلغ الطلب" required>
                <MoneyInput
                  value={orderAmount}
                  onChange={setOrderAmount}
                  placeholder="0.00"
                />
                <input
                  type="hidden"
                  name="order_invoice_amount"
                  value={orderAmount}
                />
                <FieldError errors={state.fieldErrors?.orderInvoiceAmount} />
              </Field>
            </div>
            <div className="mt-5">
              <Field label="ملاحظات الطلب">
                <textarea
                  name="order_notes"
                  value={orderNotes}
                  onChange={(event) => setOrderNotes(event.target.value)}
                  className={`${inputClass} min-h-28 resize-y py-4 leading-7`}
                  placeholder="تفاصيل تجهيز الطلب أو المنتجات المطلوب إرسالها..."
                />
              </Field>
            </div>
          </div>
        )}

        {executionType === "in_branch" && (
          <div className="mt-6 rounded-[22px] border border-[#E1E5F4] bg-[#FAFBFF] p-5">
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="الفرع" required>
                <input
                  name="branch_name"
                  list="campaign-branch-options"
                  value={branchName}
                  onChange={(event) => setBranchName(event.target.value)}
                  className={inputClass}
                  placeholder="ابحثي أو اكتبي اسم فرع جديد"
                />
                <BranchDatalist
                  id="campaign-branch-options"
                  branches={initialBranches}
                />
                <p className="mt-2 text-xs font-bold leading-6 text-[#8790AA]">
                  إذا كتبتِ اسمًا غير موجود فسيُحفظ تلقائيًا ليظهر لباقي الفريق مستقبلًا.
                </p>
                <FieldError errors={state.fieldErrors?.branchName} />
              </Field>
              <Field label="تاريخ ووقت الحضور">
                <input
                  type="datetime-local"
                  value={attendanceLocal}
                  onChange={(event) => setAttendanceLocal(event.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>
          </div>
        )}

        {executionType === "remote" && (
          <div className="mt-6 rounded-[22px] border border-[#E1E5F4] bg-[#FAFBFF] p-5">
            <Field label="تفاصيل نوع التعاون" required>
              <textarea
                name="other_execution_details"
                value={otherExecutionDetails}
                onChange={(event) => setOtherExecutionDetails(event.target.value)}
                className={`${inputClass} min-h-28 resize-y py-4 leading-7`}
                placeholder="اشرحي طبيعة التعاون وما تم الاتفاق عليه..."
              />
              <FieldError errors={state.fieldErrors?.otherExecutionDetails} />
            </Field>

            <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-[#DDE2F3] bg-white p-4">
              <input
                type="checkbox"
                checked={requiresContent}
                onChange={(event) => setRequiresContent(event.target.checked)}
                className="mt-1 h-5 w-5 accent-[#6877C8]"
              />
              <span>
                <span className="block text-sm font-black text-[#415184]">
                  يتطلب هذا التعاون تسليم محتوى ونشره
                </span>
                <span className="mt-1 block text-xs leading-6 text-[#8A92AA]">
                  عند إلغاء الاختيار لن تظهر مواعيد التسليم والنشر ولن تُنشأ قطع محتوى.
                </span>
              </span>
            </label>
          </div>
        )}

        {effectiveRequiresContent && (
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <Field label="موعد تسليم المحتوى">
              <input
                type="datetime-local"
                value={contentDueLocal}
                onChange={(event) => setContentDueLocal(event.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="موعد النشر">
              <input
                name="publishing_date"
                type="date"
                value={publishingDate}
                onChange={(event) => setPublishingDate(event.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
        )}
      </section>

      <section className="rounded-[28px] border border-white/80 bg-white/94 p-5 shadow-[0_20px_55px_rgba(72,84,150,0.09)] sm:p-7">
        <SectionTitle
          number="03"
          title="تفاصيل الدفع والمقابل"
          subtitle="يمكن اختيار تحويل وقسيمة ومنتجات معًا، ويظهر لكل خيار حقله المستقل"
        />

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <PaymentChoice
            active={selectedCompensations.bank_transfer}
            title="تحويل بنكي"
            description="مبلغ مالي يُجهز للإدارة المالية"
            onClick={() => toggleCompensation("bank_transfer")}
          />
          <PaymentChoice
            active={selectedCompensations.voucher}
            title="قسيمة مشتريات"
            description="تُصرف من الموقع أو من فرع محدد"
            onClick={() => toggleCompensation("voucher")}
          />
          <PaymentChoice
            active={selectedCompensations.product}
            title="مقابل منتجات"
            description="القيمة النقدية صفر مع حفظ قيمة المنتجات للتقارير"
            onClick={() => toggleCompensation("product")}
          />
        </div>

        {!Object.values(selectedCompensations).some(Boolean) && (
          <div className="mt-4 rounded-2xl border border-[#DFE4F3] bg-[#F8F9FD] px-5 py-4 text-sm font-bold text-[#737D9D]">
            لم يتم اختيار مقابل؛ سيُحفظ التكليف كـ «بدون مقابل».
          </div>
        )}

        <div className="mt-6 space-y-5">
          {selectedCompensations.bank_transfer && (
            <PaymentPanel title="التحويل البنكي" badge="تحويل">
              <div className="grid gap-5 md:grid-cols-2">
                <Field label="قيمة التحويل" required>
                  <MoneyInput
                    value={bankAmount}
                    onChange={setBankAmount}
                    placeholder="0.00"
                  />
                </Field>
                <Field label="موعد الدفع المتوقع">
                  <input
                    type="datetime-local"
                    value={bankExpectedLocal}
                    onChange={(event) => setBankExpectedLocal(event.target.value)}
                    className={inputClass}
                  />
                </Field>
              </div>
              <div className="mt-5">
                <Field label="ملاحظات التحويل">
                  <textarea
                    value={bankNotes}
                    onChange={(event) => setBankNotes(event.target.value)}
                    className={`${inputClass} min-h-24 resize-y py-4 leading-7`}
                    placeholder="أي تفاصيل مطلوبة للإدارة المالية..."
                  />
                </Field>
              </div>
            </PaymentPanel>
          )}

          {selectedCompensations.voucher && (
            <PaymentPanel title="قسيمة المشتريات" badge="قسيمة">
              <div className="grid gap-5 md:grid-cols-2">
                <Field label="قيمة القسيمة" required>
                  <MoneyInput
                    value={voucherAmount}
                    onChange={setVoucherAmount}
                    placeholder="0.00"
                  />
                </Field>
                <Field label="مكان صرف القسيمة" required>
                  <select
                    value={voucherSource}
                    onChange={(event) =>
                      setVoucherSource(event.target.value as "website" | "branch")
                    }
                    className={inputClass}
                  >
                    <option value="website">الموقع الإلكتروني</option>
                    <option value="branch">أحد الفروع</option>
                  </select>
                </Field>
              </div>

              {voucherSource === "branch" && (
                <div className="mt-5">
                  <Field label="فرع صرف القسيمة" required>
                    <input
                      list="voucher-branch-options"
                      value={voucherBranch}
                      onChange={(event) => setVoucherBranch(event.target.value)}
                      className={inputClass}
                      placeholder="ابحثي أو اكتبي اسم فرع جديد"
                    />
                    <BranchDatalist
                      id="voucher-branch-options"
                      branches={initialBranches}
                    />
                    <p className="mt-2 text-xs font-bold leading-6 text-[#8790AA]">
                      الفرع الجديد سيُحفظ تلقائيًا ضمن قائمة الفروع المشتركة.
                    </p>
                  </Field>
                </div>
              )}

              <div className="mt-5">
                <Field label="ملاحظات القسيمة">
                  <textarea
                    value={voucherNotes}
                    onChange={(event) => setVoucherNotes(event.target.value)}
                    className={`${inputClass} min-h-24 resize-y py-4 leading-7`}
                    placeholder="كود القسيمة أو طريقة التسليم عند توفرها..."
                  />
                </Field>
              </div>
            </PaymentPanel>
          )}

          {selectedCompensations.product && (
            <PaymentPanel title="مقابل المنتجات" badge="منتجات">
              <div className="grid gap-5 md:grid-cols-2">
                <Field label="القيمة النقدية للدفع">
                  <div className="relative">
                    <input
                      value="0"
                      readOnly
                      className={`${inputClass} cursor-not-allowed bg-[#F2F4FA] pl-20 text-[#78819B]`}
                    />
                    <CurrencyBadge />
                  </div>
                </Field>
                <Field label="قيمة المنتجات للتقارير">
                  <MoneyInput
                    value={productReferenceValue}
                    onChange={setProductReferenceValue}
                    placeholder="0.00"
                  />
                </Field>
              </div>
              <div className="mt-5">
                <Field label="وصف المنتجات" required>
                  <textarea
                    value={productDescription}
                    onChange={(event) => setProductDescription(event.target.value)}
                    className={`${inputClass} min-h-28 resize-y py-4 leading-7`}
                    placeholder="اكتبي المنتجات أو الباقة التي سيحصل عليها المؤثر..."
                  />
                </Field>
              </div>
              <div className="mt-5">
                <Field label="ملاحظات تسليم المنتجات">
                  <textarea
                    value={productNotes}
                    onChange={(event) => setProductNotes(event.target.value)}
                    className={`${inputClass} min-h-24 resize-y py-4 leading-7`}
                    placeholder="موعد التجهيز أو طريقة التسليم..."
                  />
                </Field>
              </div>
            </PaymentPanel>
          )}
        </div>

        <FieldError errors={state.fieldErrors?.compensationsJson} />

        <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <BudgetCard label="الميزانية التقديرية" value={budget.estimatedBudget} />
          <BudgetCard label="المبلغ المرتبط حاليًا" value={budget.committedAmount} />
          <BudgetCard label="المتبقي قبل الإضافة" value={budget.remainingAmount} />
          <BudgetCard
            label="المتبقي بعد الإضافة"
            value={remainingAfter}
            danger={remainingAfter < 0}
          />
        </div>

        <div className="mt-4 rounded-2xl border border-[#E2E6F3] bg-[#FAFBFF] px-5 py-4 text-xs font-bold leading-7 text-[#7C86A4]">
          يُخصم من ميزانية الحملة مجموع التحويلات البنكية وقيم القسائم فقط. قيمة الطلب المنزلي وقيمة المنتجات تظهران في التقارير بشكل منفصل.
        </div>

        {overBudgetAfter > 0 ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-bold leading-7 text-amber-800">
            سيتم تجاوز الميزانية التقديرية بمبلغ {formatMoney(overBudgetAfter)}. هذا تنبيه فقط ولن يمنع حفظ التكليف.
          </div>
        ) : budgetAmount > 0 ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-700">
            المقابل المالي ضمن الميزانية التقديرية، والمتبقي بعد الإضافة {formatMoney(remainingAfter)}.
          </div>
        ) : null}

        <div className="mt-7 rounded-[22px] border border-[#DDE2F3] bg-[#F9FAFF] p-5">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={hasContract}
              onChange={(event) => setHasContract(event.target.checked)}
              className="mt-1 h-5 w-5 accent-[#6877C8]"
            />
            <span>
              <span className="block text-sm font-black text-[#405084]">
                هذا التعاون مقيد بعقد أو اتفاق
              </span>
              <span className="mt-1 block text-xs leading-6 text-[#8A92AA]">
                سيظهر للإدارة المالية بوضوح، ويكون توقيت الدفع الافتراضي قبل النشر.
              </span>
            </span>
          </label>

          {hasContract && (
            <div className="mt-5 grid gap-5 border-t border-[#E0E4F2] pt-5 md:grid-cols-2">
              <Field label="مرجع العقد أو الاتفاق">
                <input
                  name="contract_reference"
                  value={contractReference}
                  onChange={(event) => setContractReference(event.target.value)}
                  className={inputClass}
                  placeholder="رقم العقد أو اسم الاتفاق"
                />
              </Field>
              <Field label="تاريخ الاتفاق">
                <input
                  name="agreement_date"
                  type="date"
                  value={agreementDate}
                  onChange={(event) => setAgreementDate(event.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="توقيت الدفع" required>
                <select
                  name="payment_timing"
                  value={paymentTiming}
                  onChange={(event) =>
                    setPaymentTiming(
                      event.target.value as
                        | "before_publish"
                        | "after_publish"
                        | "by_agreement",
                    )
                  }
                  className={inputClass}
                >
                  <option value="before_publish">قبل النشر</option>
                  <option value="after_publish">بعد النشر</option>
                  <option value="by_agreement">حسب الاتفاق</option>
                </select>
                <FieldError errors={state.fieldErrors?.paymentTiming} />
              </Field>
              <Field label="ملاحظات العقد">
                <textarea
                  name="contract_notes"
                  value={contractNotes}
                  onChange={(event) => setContractNotes(event.target.value)}
                  className={`${inputClass} min-h-28 resize-y py-4 leading-7`}
                  placeholder="الشروط المالية أو أي ملاحظات مهمة..."
                />
              </Field>
            </div>
          )}
        </div>

        <div className="mt-6">
          <Field label="ملاحظات المنسق العامة">
            <textarea
              name="coordinator_notes"
              value={coordinatorNotes}
              onChange={(event) => setCoordinatorNotes(event.target.value)}
              className={`${inputClass} min-h-32 resize-y py-4 leading-7`}
              placeholder="أي تعليمات أو اتفاقات إضافية خاصة بالمؤثر..."
            />
          </Field>
        </div>
      </section>

      <div className="sticky bottom-4 z-20 rounded-[24px] border border-white/80 bg-white/92 p-4 shadow-[0_20px_55px_rgba(62,72,130,0.18)] backdrop-blur-xl">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div>
            <p className="font-black text-[#33447F]">
              إضافة المؤثر إلى {campaignName}
            </p>
            <p className="mt-1 text-xs leading-6 text-[#7D86A4]">
              سيتم حفظ التكليف والمنصات والمحتوى والمقابل كوحدة واحدة، مع إعادة فحص توفر المؤثر قبل الحفظ.
            </p>
          </div>
          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#6877C8,#5263B9)] px-8 font-black text-white shadow-[0_14px_30px_rgba(82,99,185,0.28)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {pending ? <Spinner light /> : <PlusIcon />}
            {pending ? "جاري حفظ التكليف..." : "حفظ وإضافة المؤثر"}
          </button>
        </div>
      </div>
    </form>
  );
}

function ChoiceCard({
  active,
  title,
  description,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[22px] border p-5 text-right transition ${
        active
          ? "border-[#6877C8] bg-[#F1F3FF] shadow-[0_0_0_4px_rgba(104,119,200,0.09)]"
          : "border-[#E1E5F2] bg-white hover:border-[#A9B9E6]"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-black text-[#394A80]">{title}</span>
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black ${
            active
              ? "bg-[#6877C8] text-white"
              : "bg-[#EEF1F8] text-[#8A93AC]"
          }`}
        >
          {active ? "✓" : ""}
        </span>
      </div>
      <p className="mt-3 text-xs font-bold leading-6 text-[#8991A9]">
        {description}
      </p>
    </button>
  );
}

function PaymentChoice({
  active,
  title,
  description,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[22px] border p-5 text-right transition ${
        active
          ? "border-[#6877C8] bg-[#F2F4FF]"
          : "border-[#E1E5F2] bg-white hover:border-[#B7C1EA]"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-black text-[#3D4D81]">{title}</span>
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-lg border text-sm font-black ${
            active
              ? "border-[#6877C8] bg-[#6877C8] text-white"
              : "border-[#CDD3E4] bg-white text-transparent"
          }`}
        >
          ✓
        </span>
      </div>
      <p className="mt-3 text-xs font-bold leading-6 text-[#8991A9]">
        {description}
      </p>
    </button>
  );
}

function PaymentPanel({
  title,
  badge,
  children,
}: {
  title: string;
  badge: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[22px] border border-[#E0E4F2] bg-[#FAFBFF] p-5">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h3 className="font-black text-[#3C4C80]">{title}</h3>
        <span className="rounded-full bg-[#E9EDFF] px-3 py-2 text-[11px] font-black text-[#6474C5]">
          {badge}
        </span>
      </div>
      {children}
    </div>
  );
}

function MoneyInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <input
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${inputClass} pl-20`}
        placeholder={placeholder}
      />
      <CurrencyBadge />
    </div>
  );
}

function CurrencyBadge() {
  return (
    <span className="absolute left-4 top-1/2 -translate-y-1/2 rounded-lg bg-[#F1F3FF] px-3 py-1 text-xs font-black text-[#6171C7]">
      ر.س
    </span>
  );
}

function BranchDatalist({
  id,
  branches,
}: {
  id: string;
  branches: BranchOption[];
}) {
  return (
    <datalist id={id}>
      {branches.map((branch) => (
        <option key={branch.id} value={branch.name} />
      ))}
    </datalist>
  );
}

function InfoChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-[#F1F3FB] px-3 py-2 font-bold text-[#68749C]">
      {children}
    </span>
  );
}

function AvailabilityBadge({ influencer }: { influencer: InfluencerResult }) {
  if (influencer.available) {
    return (
      <span className="shrink-0 rounded-full bg-emerald-100 px-3 py-2 text-[11px] font-black text-emerald-700">
        متاح للربط
      </span>
    );
  }

  return (
    <span className="shrink-0 rounded-full bg-rose-100 px-3 py-2 text-[11px] font-black text-rose-700">
      غير متاح
    </span>
  );
}

function availabilityDescription(influencer: InfluencerResult) {
  if (influencer.availability_reason === "active_assignment") {
    return `مرتبط حاليًا بحملة ${influencer.blocking_campaign_name ?? "أخرى"}.`;
  }
  if (influencer.availability_reason === "settlement_pending") {
    return `لم تتم تسوية كامل مستحقاته في حملة ${influencer.blocking_campaign_name ?? "سابقة"}.`;
  }
  if (influencer.availability_reason === "cooldown") {
    const date = influencer.blocked_until
      ? new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium" }).format(
          new Date(influencer.blocked_until),
        )
      : "غير محدد";
    const days = influencer.days_remaining
      ? ` — متبقي ${influencer.days_remaining} يومًا`
      : "";
    return `فترة الحظر مستمرة حتى ${date}${days}.`;
  }
  return "المؤثر غير متاح حاليًا.";
}

function SectionTitle({
  number,
  title,
  subtitle,
}: {
  number: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#6877C8,#8C99E8)] text-sm font-black text-white shadow-[0_10px_24px_rgba(104,119,200,0.25)]">
        {number}
      </div>
      <div>
        <h2 className="text-xl font-black text-[#33447F]">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-[#7D86A4]">{subtitle}</p>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-black text-[#455487]">
        {label} {required && <span className="text-rose-500">*</span>}
      </span>
      {children}
    </label>
  );
}

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return <p className="mt-2 text-xs font-bold text-rose-600">{errors[0]}</p>;
}

function BudgetCard({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: number;
  danger?: boolean;
}) {
  return (
    <div
      className={`rounded-[20px] border p-4 ${
        danger
          ? "border-rose-200 bg-rose-50"
          : "border-[#E0E4F3] bg-[#FAFBFF]"
      }`}
    >
      <p
        className={`text-xs font-bold ${
          danger ? "text-rose-600" : "text-[#8991A9]"
        }`}
      >
        {label}
      </p>
      <p
        className={`mt-2 text-lg font-black ${
          danger ? "text-rose-700" : "text-[#3E4D7D]"
        }`}
      >
        {formatMoney(value)}
      </p>
    </div>
  );
}

function parseMoney(value: string) {
  const normalized = value.replace(/[\s,]/g, "");
  const number = Number(normalized);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function toIsoValue(value: string) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("ar-SA", {
    style: "currency",
    currency: "SAR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCompact(value: number | null) {
  if (value === null) return "—";
  return new Intl.NumberFormat("ar-SA", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function Spinner({ light = false }: { light?: boolean }) {
  return (
    <span
      className={`h-5 w-5 animate-spin rounded-full border-2 ${
        light
          ? "border-white/40 border-t-white"
          : "border-[#D8DDF7] border-t-[#6877C8]"
      }`}
    />
  );
}

function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path
        d="m16.5 16.5 4 4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}
