"use client";

import { useEffect, useState } from "react";

type Coordinator = {
  recordId: string;
  name: string;
  code: string;
  mobile: string;
  status: string;
};

type Campaign = {
  recordId: string;
  campaignName: string;
  brand: string;
  product: string;
  status: string;
};

type Influencer = {
  recordId: string;
  fullName: string;
  mobile: string;
  city: string;
  country: string;
  hasMawthooq: string;
};

type SocialAccount = {
  recordId: string;
  id?: string;
  platformId?: string;
  campaignPlatformId?: string;
  platform: string;
  username: string;
  profileUrl: string;
  followersCount: string;
  followers?: string;
};

type AssignmentForm = {
  executionType: "Home" | "In-Branch" | "";
  paymentTypes: string[];
  agreedAmount: string;
  voucherValue: string;
  orderNumber: string;
  orderCode: string;
  orderInvoiceAmount: string;
  branch: string;
  voucherSource: string;
  voucherBranch: string;
};

type Eligibility = {
  eligible: boolean;
  blockReason: string;
  reasonCode: string;
  daysRemaining: number | null;
  lastPublishingDate: string;
};

function textValue(value: any): string {
  if (!value) return "";

  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);

  if (Array.isArray(value)) {
    return value.map(textValue).filter(Boolean).join(", ");
  }

  if (typeof value === "object") {
    if (value.title) return String(value.title);
    if (value.fullName) return String(value.fullName);
    if (value.full_name) return String(value.full_name);
    if (value.name) return String(value.name);
    if (value.label) return String(value.label);
    if (value.value) return String(value.value);

    const nameParts = [value.first_name, value.middle_name, value.last_name]
      .map((part) => String(part || "").trim())
      .filter(Boolean);

    if (nameParts.length) return nameParts.join(" ");
  }

  return "";
}

function getCampaignKey(campaign: Campaign, index: number) {
  return (
    campaign.recordId ||
    `${campaign.campaignName || "campaign"}-${campaign.brand || "brand"}-${index}`
  );
}

function getSocialAccountId(account: SocialAccount, index: number) {
  return (
    account.recordId ||
    account.id ||
    account.campaignPlatformId ||
    account.platformId ||
    `${account.platform || "platform"}-${account.username || "user"}-${index}`
  );
}

function getSocialAccountKey(account: SocialAccount, index: number) {
  return getSocialAccountId(account, index);
}

export default function CoordinatorPage() {
  const [coordinator, setCoordinator] = useState<Coordinator | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(false);

  const [mobileSearch, setMobileSearch] = useState("");
  const [isSearchingInfluencer, setIsSearchingInfluencer] = useState(false);
  const [influencerMessage, setInfluencerMessage] = useState("");
  const [influencer, setInfluencer] = useState<Influencer | null>(null);
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([]);
  const [selectedSocialAccountIds, setSelectedSocialAccountIds] = useState<
    string[]
  >([]);

  const [eligibility, setEligibility] = useState<Eligibility | null>(null);

  const [assignmentForm, setAssignmentForm] = useState<AssignmentForm>({
    executionType: "",
    paymentTypes: [],
    agreedAmount: "",
    voucherValue: "",
    orderNumber: "",
    orderCode: "",
    orderInvoiceAmount: "",
    branch: "",
    voucherSource: "",
    voucherBranch: "",
  });

  const [isSavingAssignment, setIsSavingAssignment] = useState(false);

  const [successPopup, setSuccessPopup] = useState<{
    message: string;
    submissionLink: string;
  } | null>(null);

  useEffect(() => {
    const storedCoordinator = localStorage.getItem("coordinator");

    if (!storedCoordinator) {
      window.location.href = "/coordinator/login";
      return;
    }

    setCoordinator(JSON.parse(storedCoordinator));
    loadCampaigns();
  }, []);

  async function loadCampaigns() {
    try {
      setIsLoadingCampaigns(true);

      const response = await fetch("/api/coordinator/campaigns");
      const result = await response.json();

      if (!response.ok) {
        alert(result.message || "تعذر جلب الحملات");
        return;
      }

      const normalizedCampaigns = (result.campaigns || []).map(
        (campaign: any, index: number) => ({
          recordId:
            textValue(campaign.recordId) ||
            textValue(campaign.id) ||
            textValue(campaign.record_id) ||
            `campaign-${index}`,
          campaignName: textValue(campaign.campaignName),
          brand: textValue(campaign.brand),
          product: textValue(campaign.product),
          status: textValue(campaign.status),
        })
      );

      setCampaigns(normalizedCampaigns);
    } catch (error) {
      console.error(error);
      alert("حدث خطأ أثناء جلب الحملات");
    } finally {
      setIsLoadingCampaigns(false);
    }
  }

  async function searchInfluencer() {
    if (!selectedCampaignId) {
      alert("يرجى اختيار الحملة أولًا");
      return;
    }

    if (!mobileSearch.trim()) {
      alert("يرجى إدخال رقم جوال المؤثر");
      return;
    }

    try {
      setIsSearchingInfluencer(true);
      setInfluencerMessage("");
      setInfluencer(null);
      setSocialAccounts([]);
      setSelectedSocialAccountIds([]);
      setEligibility(null);

      const response = await fetch("/api/coordinator/check-influencer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mobile: mobileSearch,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        alert(result.message || "تعذر البحث عن المؤثر");
        return;
      }

      setEligibility({
        eligible: Boolean(result.eligible),
        blockReason: textValue(result.blockReason),
        reasonCode: textValue(result.reasonCode),
        daysRemaining:
          result.daysRemaining === null || result.daysRemaining === undefined
            ? null
            : Number(result.daysRemaining),
        lastPublishingDate: textValue(result.lastPublishingDate),
      });

      if (!result.exists && !result.found) {
        setInfluencerMessage(result.message || "المؤثر غير موجود");
        return;
      }

      const resultInfluencer = result.influencer || {};

      setInfluencer({
        recordId:
          textValue(resultInfluencer.recordId) ||
          textValue(resultInfluencer.id),
        fullName:
          textValue(resultInfluencer.fullName) ||
          textValue(resultInfluencer.name) ||
          "غير محدد",
        mobile:
          textValue(resultInfluencer.mobile) ||
          textValue(resultInfluencer.phone) ||
          mobileSearch,
        city: textValue(resultInfluencer.city),
        country: textValue(resultInfluencer.country),
        hasMawthooq:
          textValue(resultInfluencer.hasMawthooq) ||
          textValue(resultInfluencer.mawthooq),
      });

      const normalizedSocialAccounts = (
        result.socialAccounts ||
        result.accounts ||
        result.platforms ||
        []
      ).map((account: any, index: number) => ({
        recordId:
          textValue(account.recordId) ||
          textValue(account.id) ||
          textValue(account.campaignPlatformId) ||
          textValue(account.platformId) ||
          `social-${index}`,
        id: textValue(account.id),
        platformId: textValue(account.platformId),
        campaignPlatformId: textValue(account.campaignPlatformId),
        platform: textValue(account.platform) || textValue(account.platformName),
        username: textValue(account.username),
        profileUrl: textValue(account.profileUrl) || textValue(account.url),
        followersCount:
          textValue(account.followersCount) || textValue(account.followers),
        followers: textValue(account.followers),
      }));

      setSocialAccounts(normalizedSocialAccounts);

      if (result.eligible === false) {
        setInfluencerMessage(
          result.blockReason ||
            "تم العثور على المؤثر، لكنه غير مؤهل للتعاون الآن."
        );
      } else {
        setInfluencerMessage("تم العثور على المؤثر. اختاري المنصات للمتابعة.");
      }
    } catch (error) {
      console.error(error);
      alert("حدث خطأ أثناء البحث عن المؤثر");
    } finally {
      setIsSearchingInfluencer(false);
    }
  }

  function updateAssignmentField(field: keyof AssignmentForm, value: string) {
    setAssignmentForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function toggleSocialAccount(accountId: string) {
    setSelectedSocialAccountIds((current) =>
      current.includes(accountId)
        ? current.filter((id) => id !== accountId)
        : [...current, accountId]
    );
  }

  function togglePaymentType(paymentType: string) {
    setAssignmentForm((current) => {
      const exists = current.paymentTypes.includes(paymentType);

      return {
        ...current,
        paymentTypes: exists
          ? current.paymentTypes.filter((type) => type !== paymentType)
          : [...current.paymentTypes, paymentType],
      };
    });
  }

  function paymentIncludesVoucher() {
    return assignmentForm.paymentTypes.includes("Voucher");
  }

  function paymentIncludesBankTransfer() {
    return assignmentForm.paymentTypes.includes("Bank Transfer");
  }

  async function saveAssignment() {
    if (!coordinator) {
      alert("يرجى تسجيل الدخول مرة أخرى");
      return;
    }

    if (eligibility && !eligibility.eligible) {
      alert(eligibility.blockReason || "لا يمكن إضافة هذا المؤثر الآن");
      return;
    }

    const selectedCampaign = campaigns.find(
      (campaign) => campaign.recordId === selectedCampaignId
    );

    const selectedSocialAccounts = socialAccounts.filter((account, index) =>
      selectedSocialAccountIds.includes(getSocialAccountId(account, index))
    );

    if (!selectedCampaign) {
      alert("يرجى اختيار الحملة");
      return;
    }

    if (!influencer) {
      alert("يرجى البحث عن المؤثر");
      return;
    }

    if (selectedSocialAccounts.length === 0) {
      alert("يرجى اختيار منصة واحدة على الأقل");
      return;
    }

    try {
      setIsSavingAssignment(true);

      const response = await fetch("/api/coordinator/submit-assignment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          coordinator: {
            name: coordinator.name,
            code: coordinator.code,
            mobile: coordinator.mobile,
          },
          campaign: {
            recordId: selectedCampaign.recordId,
            campaignName: selectedCampaign.campaignName,
          },
          influencer: {
            recordId: influencer.recordId,
            fullName: influencer.fullName,
            mobile: influencer.mobile,
            hasMawthooq: influencer.hasMawthooq,
          },
          socialAccounts: selectedSocialAccounts.map((account, index) => ({
            recordId: getSocialAccountId(account, index),
            platform: account.platform,
            username: account.username,
          })),
          assignment: assignmentForm,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        alert(result.message || "تعذر حفظ الربط");
        return;
      }

      setSuccessPopup({
        message: result.message || "تم الحفظ بنجاح",
        submissionLink: result.submissionLink || "",
      });

      setAssignmentForm({
        executionType: "",
        paymentTypes: [],
        agreedAmount: "",
        voucherValue: "",
        orderNumber: "",
        orderCode: "",
        orderInvoiceAmount: "",
        branch: "",
        voucherSource: "",
        voucherBranch: "",
      });

      setSelectedSocialAccountIds([]);
    } catch (error) {
      console.error(error);
      alert("حدث خطأ أثناء حفظ الربط");
    } finally {
      setIsSavingAssignment(false);
    }
  }

  async function copySubmissionLink() {
    if (!successPopup?.submissionLink) return;

    try {
      await navigator.clipboard.writeText(successPopup.submissionLink);
      alert("تم نسخ رابط محتوى المؤثر");
    } catch {
      alert("تعذر نسخ الرابط، يرجى نسخه يدويًا");
    }
  }

  function logout() {
    localStorage.removeItem("coordinator");
    window.location.href = "/coordinator/login";
  }

  if (!coordinator) {
    return null;
  }

  const selectedCampaign = campaigns.find(
    (campaign) => campaign.recordId === selectedCampaignId
  );

  const isInfluencerBlocked = eligibility !== null && !eligibility.eligible;

  return (
    <main className="min-h-screen bg-[#F5F5F7] text-[#1B1B1F]" dir="rtl">
      <header className="header-lavender px-5 py-6 md:px-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <img
              src="/da-logo.png"
              alt="Dar Al Ameerat Logo"
              className="h-16 w-auto object-contain"
            />

            <div>
              <h1 className="text-2xl font-extrabold">
                بوابة منسقي الحملات
              </h1>
              <p className="text-sm text-white/80">
                Campaign Coordinators Portal
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-white/15 px-4 py-3 text-sm text-white">
            <div className="font-bold">{coordinator.name}</div>
            <div className="text-white/80">
              {coordinator.code} | {coordinator.mobile}
            </div>
          </div>

          <button
            type="button"
            onClick={logout}
            className="rounded-2xl bg-white px-5 py-3 text-sm font-bold text-[#6F4EB0]"
          >
            تسجيل خروج
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-8">
        <div className="card">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-[#241D35]">
              ربط مؤثر بحملة
            </h2>
            <p className="mt-1 text-sm text-[#777]">
              اختاري الحملة ثم ابحثي عن المؤثر برقم الجوال لإضافة بيانات الإعلان.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <label className="block">
              <div className="mb-2">
                <div className="text-sm font-semibold text-[#25252A]">
                  الحملة
                </div>
                <div className="text-xs text-[#777]">Campaign</div>
              </div>

              <select
                className="input"
                value={selectedCampaignId}
                onChange={(event) => setSelectedCampaignId(event.target.value)}
                disabled={isLoadingCampaigns}
              >
                <option value="">
                  {isLoadingCampaigns
                    ? "جاري تحميل الحملات..."
                    : "اختاري الحملة"}
                </option>

                {campaigns.map((campaign, index) => (
                  <option
                    key={getCampaignKey(campaign, index)}
                    value={campaign.recordId}
                  >
                    {campaign.campaignName}
                    {campaign.brand ? ` - ${campaign.brand}` : ""}
                  </option>
                ))}
              </select>
            </label>

            <div className="rounded-2xl bg-[#F8F5FC] p-4">
              <div className="text-sm font-bold text-[#6F4EB0]">
                بيانات الحملة المختارة
              </div>

              {selectedCampaign ? (
                <div className="mt-3 space-y-1 text-sm text-[#4A4358]">
                  <div>
                    <span className="font-semibold">الحملة:</span>{" "}
                    {selectedCampaign.campaignName}
                  </div>
                  <div>
                    <span className="font-semibold">العلامة:</span>{" "}
                    {selectedCampaign.brand || "غير محدد"}
                  </div>
                  <div>
                    <span className="font-semibold">المنتج:</span>{" "}
                    {selectedCampaign.product || "غير محدد"}
                  </div>
                </div>
              ) : (
                <div className="mt-3 text-sm text-[#777]">
                  لم يتم اختيار حملة بعد.
                </div>
              )}
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-[#EEE9F7] bg-white p-5">
            <h3 className="text-lg font-bold text-[#241D35]">
              البحث عن المؤثر
            </h3>

            <p className="mt-2 text-sm leading-7 text-[#777]">
              أدخلي رقم جوال المؤثر للبحث عن بياناته ومنصاته المسجلة.
            </p>

            <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto]">
              <input
                className="input"
                placeholder="رقم جوال المؤثر"
                value={mobileSearch}
                onChange={(event) => setMobileSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") searchInfluencer();
                }}
              />

              <button
                type="button"
                onClick={searchInfluencer}
                disabled={isSearchingInfluencer}
                className="rounded-2xl bg-[#8E6CCB] px-6 py-3 font-bold text-white transition hover:bg-[#7C5DBC] disabled:opacity-60"
              >
                {isSearchingInfluencer ? "جاري البحث..." : "بحث"}
              </button>
            </div>

            {influencerMessage && (
              <div className="mt-4 rounded-2xl bg-[#F8F5FC] px-4 py-3 text-sm font-semibold text-[#6F4EB0]">
                {influencerMessage}
              </div>
            )}

            {isInfluencerBlocked && eligibility ? (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                <div className="font-bold">لا يمكن إضافة هذا المؤثر الآن</div>
                <div className="mt-1">{eligibility.blockReason}</div>

                {eligibility.lastPublishingDate ? (
                  <div className="mt-2 text-xs">
                    آخر تاريخ نشر: {eligibility.lastPublishingDate}
                  </div>
                ) : null}

                {eligibility.daysRemaining ? (
                  <div className="mt-1 text-xs">
                    الأيام المتبقية: {eligibility.daysRemaining}
                  </div>
                ) : null}
              </div>
            ) : null}

            {influencer && (
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl bg-[#F8F5FC] p-4">
                  <div className="text-sm font-bold text-[#6F4EB0]">
                    بيانات المؤثر
                  </div>

                  <div className="mt-3 space-y-1 text-sm text-[#4A4358]">
                    <div>
                      <span className="font-semibold">الاسم:</span>{" "}
                      {influencer.fullName || "غير محدد"}
                    </div>
                    <div>
                      <span className="font-semibold">الجوال:</span>{" "}
                      {influencer.mobile}
                    </div>
                    <div>
                      <span className="font-semibold">المدينة:</span>{" "}
                      {influencer.city || "غير محدد"}
                    </div>
                    <div>
                      <span className="font-semibold">موثوق:</span>{" "}
                      {influencer.hasMawthooq || "غير محدد"}
                    </div>
                  </div>
                </div>

                <div className="block rounded-2xl bg-[#FCFBFE] p-4">
                  <div className="mb-2">
                    <div className="text-sm font-semibold text-[#25252A]">
                      منصات الإعلان
                    </div>
                    <div className="text-xs text-[#777]">
                      يمكن اختيار أكثر من منصة لنفس الاتفاق.
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3">
                    {socialAccounts.map((account, index) => {
                      const accountId = getSocialAccountId(account, index);

                      return (
                        <label
                          key={getSocialAccountKey(account, index)}
                          className="flex cursor-pointer items-center justify-between rounded-2xl border border-[#EEE9F7] bg-white px-4 py-3"
                        >
                          <div>
                            <div className="font-semibold text-[#241D35]">
                              {account.platform}
                              {account.username ? ` - ${account.username}` : ""}
                            </div>

                            {account.followersCount ? (
                              <div className="text-xs text-[#777]">
                                Followers: {account.followersCount}
                              </div>
                            ) : null}
                          </div>

                          <input
                            type="checkbox"
                            checked={selectedSocialAccountIds.includes(
                              accountId
                            )}
                            onChange={() => toggleSocialAccount(accountId)}
                            className="h-5 w-5"
                            disabled={isInfluencerBlocked}
                          />
                        </label>
                      );
                    })}
                  </div>

                  {socialAccounts.length === 0 && (
                    <div className="mt-3 text-sm text-red-500">
                      لا توجد منصات مسجلة لهذا المؤثر. يرجى تحديث بياناته من
                      فورم المؤثرين.
                    </div>
                  )}
                </div>
              </div>
            )}

            {influencer &&
              selectedSocialAccountIds.length > 0 &&
              !isInfluencerBlocked && (
                <div className="mt-6 rounded-2xl border border-[#EEE9F7] bg-[#FCFBFE] p-5">
                  <h3 className="text-lg font-bold text-[#241D35]">
                    بيانات الإعلان والاتفاق
                  </h3>

                  <p className="mt-2 text-sm text-[#777]">
                    حددي نوع التنفيذ، ثم أدخلي بيانات الدفع والطلب أو الفرع حسب نوع الإعلان.
                  </p>

                  <div className="mt-5 grid gap-5 md:grid-cols-2">
                    <label className="block">
                      <div className="mb-2 text-sm font-semibold">
                        نوع التنفيذ
                      </div>
                      <select
                        className="input"
                        value={assignmentForm.executionType}
                        onChange={(event) =>
                          updateAssignmentField(
                            "executionType",
                            event.target.value
                          )
                        }
                      >
                        <option value="">اختاري نوع التنفيذ</option>
                        <option value="Home">منزلي / Home</option>
                        <option value="In-Branch">حضوري / In-Branch</option>
                      </select>
                    </label>

                    <div className="md:col-span-2">
                      <div className="mb-2 text-sm font-semibold">
                        نوع الدفع
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                        {[
                          ["Bank Transfer", "تحويل بنكي"],
                          ["Voucher", "قسيمة"],
                          ["Product", "منتج"],
                          ["Commission", "عمولة"],
                          ["Other", "أخرى"],
                        ].map(([value, label]) => {
                          const checked =
                            assignmentForm.paymentTypes.includes(value);

                          return (
                            <button
                              key={`payment-type-${value}`}
                              type="button"
                              onClick={() => togglePaymentType(value)}
                              className={`rounded-2xl border px-4 py-3 text-sm font-bold transition ${
                                checked
                                  ? "border-[#8E6CCB] bg-[#F1EAFB] text-[#6F4EB0]"
                                  : "border-[#EEE9F7] bg-white text-[#4A4358]"
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {paymentIncludesBankTransfer() && (
                      <label className="block">
                        <div className="mb-2 text-sm font-semibold">
                          مبلغ التحويل المدفوع
                        </div>
                        <input
                          className="input"
                          placeholder="مثال: 800"
                          value={assignmentForm.agreedAmount}
                          onChange={(event) =>
                            updateAssignmentField(
                              "agreedAmount",
                              event.target.value
                            )
                          }
                        />
                      </label>
                    )}

                    {paymentIncludesVoucher() && (
                      <label className="block">
                        <div className="mb-2 text-sm font-semibold">
                          قيمة القسيمة
                        </div>
                        <input
                          className="input"
                          placeholder="مثال: 300"
                          value={assignmentForm.voucherValue}
                          onChange={(event) =>
                            updateAssignmentField(
                              "voucherValue",
                              event.target.value
                            )
                          }
                        />
                      </label>
                    )}

                    {paymentIncludesVoucher() && (
                      <>
                        <label className="block">
                          <div className="mb-2 text-sm font-semibold">
                            مصدر القسيمة
                          </div>
                          <select
                            className="input"
                            value={assignmentForm.voucherSource}
                            onChange={(event) =>
                              updateAssignmentField(
                                "voucherSource",
                                event.target.value
                              )
                            }
                          >
                            <option value="">اختاري مصدر القسيمة</option>
                            <option value="Branch Voucher">قسيمة من الفرع</option>
                            <option value="Website Code">كود من الموقع</option>
                          </select>
                        </label>

                        {assignmentForm.voucherSource === "Branch Voucher" && (
                          <label className="block">
                            <div className="mb-2 text-sm font-semibold">
                              فرع صرف القسيمة
                            </div>
                            <select
                              className="input"
                              value={assignmentForm.voucherBranch}
                              onChange={(event) =>
                                updateAssignmentField(
                                  "voucherBranch",
                                  event.target.value
                                )
                              }
                            >
                              <option value="">اختاري فرع صرف القسيمة</option>
                              <option value="الصحافه">الصحافه</option>
                              <option value="التخصصي">التخصصي</option>
                              <option value="ابوبكر">ابوبكر</option>
                              <option value="جده/المكرونه">جده/المكرونه</option>
                              <option value="الخبر">الخبر</option>
                            </select>
                          </label>
                        )}
                      </>
                    )}

                    {assignmentForm.executionType === "Home" && (
                      <>
                        <label className="block">
                          <div className="mb-2 text-sm font-semibold">
                            رقم الطلب
                          </div>
                          <input
                            className="input"
                            placeholder="Order Number"
                            value={assignmentForm.orderNumber}
                            onChange={(event) =>
                              updateAssignmentField(
                                "orderNumber",
                                event.target.value
                              )
                            }
                          />
                        </label>

                        <label className="block">
                          <div className="mb-2 text-sm font-semibold">
                            كود الطلب
                          </div>
                          <input
                            className="input"
                            placeholder="Order Code"
                            value={assignmentForm.orderCode}
                            onChange={(event) =>
                              updateAssignmentField(
                                "orderCode",
                                event.target.value
                              )
                            }
                          />
                        </label>

                        <label className="block">
                          <div className="mb-2 text-sm font-semibold">
                            مبلغ فاتورة الطلب
                          </div>
                          <input
                            className="input"
                            placeholder="Order Invoice Amount"
                            value={assignmentForm.orderInvoiceAmount}
                            onChange={(event) =>
                              updateAssignmentField(
                                "orderInvoiceAmount",
                                event.target.value
                              )
                            }
                          />
                        </label>
                      </>
                    )}

                    {assignmentForm.executionType === "In-Branch" && (
                      <label className="block">
                        <div className="mb-2 text-sm font-semibold">الفرع</div>
                        <select
                          className="input"
                          value={assignmentForm.branch}
                          onChange={(event) =>
                            updateAssignmentField("branch", event.target.value)
                          }
                        >
                          <option value="">اختاري الفرع</option>
                          <option value="الصحافه">الصحافه</option>
                          <option value="التخصصي">التخصصي</option>
                          <option value="ابوبكر">ابوبكر</option>
                          <option value="جده/المكرونه">جده/المكرونه</option>
                          <option value="الخبر">الخبر</option>
                        </select>
                      </label>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={saveAssignment}
                    disabled={isSavingAssignment || isInfluencerBlocked}
                    className="mt-6 w-full rounded-2xl bg-[#8E6CCB] px-6 py-4 font-bold text-white shadow-lg shadow-[#8E6CCB]/25 transition hover:bg-[#7C5DBC] disabled:opacity-60"
                  >
                    {isSavingAssignment
                      ? "جاري الحفظ..."
                      : "حفظ ربط المؤثر بالحملة"}
                  </button>
                </div>
              )}
          </div>
        </div>
      </section>

      {successPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 text-center shadow-2xl">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#F1EAFB] text-2xl">
              ✓
            </div>

            <h2 className="text-2xl font-extrabold text-[#241D35]">
              تم الحفظ بنجاح
            </h2>

            <p className="mt-3 text-sm leading-7 text-[#555]">
              {successPopup.message}
            </p>

            <p className="mt-2 text-sm font-semibold text-[#6F4EB0]">
              قومي بنسخ رابط محتوى المؤثر الذي قمتِ بإضافته، ثم أرسليه للمؤثر لاستخدامه عند رفع رابط النشر والمادة الإعلانية.
            </p>

            {successPopup.submissionLink ? (
              <div
                className="mt-5 rounded-2xl border border-[#EEE9F7] bg-[#F8F5FC] p-3 text-left"
                dir="ltr"
              >
                <div className="break-all text-sm text-[#241D35]">
                  {successPopup.submissionLink}
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-2xl bg-red-50 p-3 text-sm text-red-600">
                لم يتم العثور على رابط المحتوى. راجعي سجل Campaign Influencer في SmartSuite.
              </div>
            )}

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={copySubmissionLink}
                disabled={!successPopup.submissionLink}
                className="rounded-2xl bg-[#8E6CCB] px-5 py-3 font-bold text-white transition hover:bg-[#7C5DBC] disabled:opacity-50"
              >
                نسخ الرابط
              </button>

              <button
                type="button"
                onClick={() => setSuccessPopup(null)}
                className="rounded-2xl border border-[#D7C7EE] bg-white px-5 py-3 font-bold text-[#6F4EB0]"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}