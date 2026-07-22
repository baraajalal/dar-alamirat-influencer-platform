import { NextResponse } from "next/server";

const SMARTSUITE_API_URL = "https://app.smartsuite.com/api/v1";

const API_KEY = process.env.SMARTSUITE_API_KEY?.trim();
const ACCOUNT_ID = process.env.SMARTSUITE_ACCOUNT_ID?.trim();

const INFLUENCERS_TABLE_ID = process.env.SMARTSUITE_INFLUENCERS_TABLE_ID;
const SOCIAL_ACCOUNTS_TABLE_ID =
  process.env.SMARTSUITE_SOCIAL_ACCOUNTS_TABLE_ID;
const CAMPAIGN_INFLUENCERS_TABLE_ID =
  process.env.SMARTSUITE_CAMPAIGN_INFLUENCERS_TABLE_ID;
const PAYMENTS_TABLE_ID = process.env.SMARTSUITE_PAYMENTS_TABLE_ID;

const CLOSED_STATUS_ID = "4UcYP";
const REJECTED_STATUS_ID = "MDC3A";

const PAYMENT_STATUS_PAID = "cQLKE";
const PAYMENT_STATUS_CANCELLED = "8Nsjn";

const COOLDOWN_DAYS = 45;

function asArray(value: any): any[] {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return [value];
}

function normalizeMobile(value: any) {
  let mobile = String(value || "")
    .replace(/\s/g, "")
    .replace(/\+/g, "")
    .replace(/-/g, "")
    .replace(/[^\d]/g, "")
    .trim();

  if (!mobile) return "";

  if (mobile.startsWith("00966")) {
    mobile = mobile.replace(/^00966/, "966");
  }

  if (mobile.startsWith("0") && mobile.length === 10) {
    mobile = `966${mobile.slice(1)}`;
  }

  if (mobile.startsWith("5") && mobile.length === 9) {
    mobile = `966${mobile}`;
  }

  return mobile;
}

function getRecordId(record: any) {
  return String(record?.id || record?.record_id || "");
}

function getSingleSelectValue(value: any) {
  if (!value) return "";

  const normalizedValue = Array.isArray(value) ? value[0] : value;

  if (!normalizedValue) return "";

  if (typeof normalizedValue === "string") return normalizedValue;

  if (normalizedValue?.value) return normalizedValue.value;
  if (normalizedValue?.id) return normalizedValue.id;
  if (normalizedValue?.label) return normalizedValue.label;
  if (normalizedValue?.name) return normalizedValue.name;

  return "";
}

function getTextValue(value: any): string {
  if (!value) return "";

  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);

  if (Array.isArray(value)) {
    return value.map(getTextValue).filter(Boolean).join(", ");
  }

  if (typeof value === "object") {
    if (value.title) return String(value.title);
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

function getDateValue(value: any): string {
  const date = parseSmartSuiteDate(value);

  if (!date) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseSmartSuiteDate(value: any): Date | null {
  if (!value) return null;

  if (typeof value === "string") {
    const cleaned = value.trim();
    if (!cleaned) return null;

    let dateOnly = cleaned.includes("T") ? cleaned.split("T")[0] : cleaned;

    const slashMatch = dateOnly.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);

    if (slashMatch) {
      const month = slashMatch[1].padStart(2, "0");
      const day = slashMatch[2].padStart(2, "0");
      let year = slashMatch[3];

      if (year.length === 2) {
        year = `20${year}`;
      }

      dateOnly = `${year}-${month}-${day}`;
    }

    const parsed = new Date(`${dateOnly}T00:00:00`);

    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof value === "object" && value.date) {
    const dateOnly = String(value.date).split("T")[0];
    const parsed = new Date(`${dateOnly}T00:00:00`);

    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof value === "object" && value.value) {
    const dateOnly = String(value.value).split("T")[0];
    const parsed = new Date(`${dateOnly}T00:00:00`);

    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

function daysBetween(dateString: string) {
  if (!dateString) return null;

  const start = new Date(`${dateString}T00:00:00`);
  const today = new Date();

  const current = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  const diff = current.getTime() - start.getTime();

  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function getPlatformName(value: any) {
  const rawValue = getSingleSelectValue(value);

  const map: Record<string, string> = {
    lewTg: "Instagram",
    fcPmm: "TikTok",
    ignLA: "Snapchat",
    Gbbgd: "YouTube",
    jHhHD: "X",
    vQc7l: "Facebook",
    UUtcJ: "Other",

    IAagD: "Instagram",
    IC8Tn: "TikTok",
    PLGTZ: "Snapchat",
    "0L87q": "YouTube",
    FVfaD: "X",
    EXvVf: "Facebook",
    D57tW: "Other",
  };

  return map[rawValue] || rawValue || "";
}

function getPlatformIdForCampaignInfluencers(value: any) {
  const rawValue = getSingleSelectValue(value);

  const map: Record<string, string> = {
    lewTg: "IAagD",
    fcPmm: "IC8Tn",
    ignLA: "PLGTZ",
    Gbbgd: "0L87q",
    jHhHD: "FVfaD",
    vQc7l: "EXvVf",
    UUtcJ: "D57tW",
  };

  return map[rawValue] || rawValue || "";
}

function getMawthooqName(value: any) {
  const rawValue = getSingleSelectValue(value);

  const map: Record<string, string> = {
    OgXe2: "نعم",
    RpV6I: "لا",
  };

  return map[rawValue] || rawValue || "";
}

function isOpenCollaboration(record: any) {
  const statusId = getSingleSelectValue(record.status);

  if (!statusId) return true;

  if (statusId === CLOSED_STATUS_ID) return false;
  if (statusId === REJECTED_STATUS_ID) return false;

  return true;
}

function isPaymentUnpaid(paymentRecord: any) {
  const paymentStatus = getSingleSelectValue(paymentRecord.sc5f22146c);

  if (!paymentStatus) return true;

  if (paymentStatus === PAYMENT_STATUS_PAID) return false;
  if (paymentStatus === PAYMENT_STATUS_CANCELLED) return false;

  return true;
}

async function smartSuiteRequest(
  url: string,
  options: {
    method: "POST";
    body?: Record<string, unknown>;
  }
) {
  if (!API_KEY) throw new Error("Missing SMARTSUITE_API_KEY");
  if (!ACCOUNT_ID) throw new Error("Missing SMARTSUITE_ACCOUNT_ID");

  const response = await fetch(url, {
    method: options.method,
    headers: {
      Authorization: `Token ${API_KEY}`,
      "ACCOUNT-ID": ACCOUNT_ID,
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();

  let result: any;

  try {
    result = text ? JSON.parse(text) : {};
  } catch {
    console.error("SmartSuite non-JSON response:", text);
    throw new Error("SmartSuite returned non-JSON response");
  }

  if (!response.ok) {
    console.error("SmartSuite API Error:", JSON.stringify(result, null, 2));
    throw new Error(JSON.stringify(result));
  }

  return result;
}

async function listRecords(tableId: string) {
  const result = await smartSuiteRequest(
    `${SMARTSUITE_API_URL}/applications/${tableId}/records/list/`,
    {
      method: "POST",
      body: {
        limit: 1000,
      },
    }
  );

  return result.items || result.results || result.records || [];
}

function findInfluencerByMobile(influencerRecords: any[], mobile: string) {
  const normalizedTarget = normalizeMobile(mobile);

  return influencerRecords.find((record) => {
    const recordMobile = normalizeMobile(record.se22f3e19b);
    return recordMobile === normalizedTarget;
  });
}

function getSocialAccountsForInfluencer({
  socialAccountRecords,
  influencerRecordId,
  mobile,
}: {
  socialAccountRecords: any[];
  influencerRecordId: string;
  mobile: string;
}) {
  const normalizedMobile = normalizeMobile(mobile);

  return socialAccountRecords.filter((record) => {
    const linkedInfluencers = asArray(record.sf702e7fac).map(String);
    const socialMobile = normalizeMobile(record.sfd995e159);

    const linkMatch =
      Boolean(influencerRecordId) &&
      linkedInfluencers.includes(influencerRecordId);

    const mobileMatch = socialMobile === normalizedMobile;

    return linkMatch || mobileMatch;
  });
}

function mapSocialAccount(record: any) {
  const platformId = getSingleSelectValue(record.s6eb45309);
  const platformName = getPlatformName(record.s6eb45309);
  const campaignPlatformId = getPlatformIdForCampaignInfluencers(
    record.s6eb45309
  );

  return {
    id: getRecordId(record) || `${platformId}-${getTextValue(record.s2da4f29f5)}`,

    platform: platformName,
    platformName,
    platformId,
    campaignPlatformId,

    profileUrl: getTextValue(record.s0337da55a),
    url: getTextValue(record.s0337da55a),

    username: getTextValue(record.s2da4f29f5),
    followers: getTextValue(record.sd03185167),
    averageViews: getTextValue(record.sc00535482),
    averageLikes: getTextValue(record.s41ebd9627),
    averageComments: getTextValue(record.s3a367ccb5),
    engagementRate: getTextValue(record.s3317459b2),

    femaleAudience: getTextValue(record.sb1b76358f),
    maleAudience: getTextValue(record.se9195b09e),
    audienceMainCity: getTextValue(record.s42f7bb236),
    audienceMainCountry: getTextValue(record.s3ad5a52db),
  };
}

function getInfluencerCampaigns({
  campaignInfluencerRecords,
  influencerRecordId,
  mobile,
}: {
  campaignInfluencerRecords: any[];
  influencerRecordId: string;
  mobile: string;
}) {
  const normalizedMobile = normalizeMobile(mobile);

  return campaignInfluencerRecords.filter((record) => {
    const recordMobile = normalizeMobile(record.sdaf7872a0);
    const linkedInfluencers = asArray(record.s85138512a).map(String);

    const mobileMatch = recordMobile === normalizedMobile;
    const influencerLinkMatch =
      Boolean(influencerRecordId) &&
      linkedInfluencers.includes(influencerRecordId);

    return mobileMatch || influencerLinkMatch;
  });
}

function getPaymentsForCampaignInfluencers({
  paymentRecords,
  campaignInfluencerIds,
}: {
  paymentRecords: any[];
  campaignInfluencerIds: string[];
}) {
  return paymentRecords.filter((payment) => {
    const linkedCampaignInfluencers = asArray(payment.s55faf09aa).map(String);

    return linkedCampaignInfluencers.some((id) =>
      campaignInfluencerIds.includes(id)
    );
  });
}

function getLatestPublishingDate(records: any[]) {
  const dates = records
    .map((record) => getDateValue(record.s4121894d1))
    .filter(Boolean)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  return dates[0] || "";
}

function buildEligibilityResult({
  influencerCampaigns,
  influencerPayments,
}: {
  influencerCampaigns: any[];
  influencerPayments: any[];
}) {
  const openCampaign = influencerCampaigns.find((record) =>
    isOpenCollaboration(record)
  );

  if (openCampaign) {
    return {
      eligible: false,
      reasonCode: "OPEN_COLLABORATION",
      blockReason:
        "لا يمكن إضافة هذا المؤثر الآن، لديه تعاون مفتوح مع حملة أخرى.",
      blockedCampaignName: getTextValue(openCampaign.s590fc77ca),
      blockedCampaignInfluencerId: getRecordId(openCampaign),
      daysRemaining: null,
      lastPublishingDate: getDateValue(openCampaign.s4121894d1),
    };
  }

  const unpaidPayment = influencerPayments.find((payment) =>
    isPaymentUnpaid(payment)
  );

  if (unpaidPayment) {
    return {
      eligible: false,
      reasonCode: "UNPAID_PAYMENT",
      blockReason:
        "لا يمكن إضافة هذا المؤثر الآن، لديه مستحقات مالية غير مدفوعة.",
      blockedPaymentId: getRecordId(unpaidPayment),
      daysRemaining: null,
      lastPublishingDate: "",
    };
  }

  const latestPublishingDate = getLatestPublishingDate(influencerCampaigns);

  const daysSinceLastPublishing = latestPublishingDate
    ? daysBetween(latestPublishingDate)
    : null;

  if (
    daysSinceLastPublishing !== null &&
    daysSinceLastPublishing < COOLDOWN_DAYS
  ) {
    const daysRemaining = COOLDOWN_DAYS - daysSinceLastPublishing;

    return {
      eligible: false,
      reasonCode: "COOLDOWN_45_DAYS",
      blockReason: `لا يمكن إضافة هذا المؤثر الآن، لم يمر 45 يوم على آخر إعلان. المتبقي ${daysRemaining} يوم.`,
      daysRemaining,
      lastPublishingDate: latestPublishingDate,
    };
  }

  return {
    eligible: true,
    reasonCode: "",
    blockReason: "",
    daysRemaining: 0,
    lastPublishingDate: latestPublishingDate,
  };
}

async function checkInfluencer(mobile: string) {
  if (!INFLUENCERS_TABLE_ID) {
    throw new Error("Missing SMARTSUITE_INFLUENCERS_TABLE_ID");
  }

  if (!SOCIAL_ACCOUNTS_TABLE_ID) {
    throw new Error("Missing SMARTSUITE_SOCIAL_ACCOUNTS_TABLE_ID");
  }

  if (!CAMPAIGN_INFLUENCERS_TABLE_ID) {
    throw new Error("Missing SMARTSUITE_CAMPAIGN_INFLUENCERS_TABLE_ID");
  }

  if (!PAYMENTS_TABLE_ID) {
    throw new Error("Missing SMARTSUITE_PAYMENTS_TABLE_ID");
  }

  const [
    influencerRecords,
    socialAccountRecords,
    campaignInfluencerRecords,
    paymentRecords,
  ] = await Promise.all([
    listRecords(INFLUENCERS_TABLE_ID),
    listRecords(SOCIAL_ACCOUNTS_TABLE_ID),
    listRecords(CAMPAIGN_INFLUENCERS_TABLE_ID),
    listRecords(PAYMENTS_TABLE_ID),
  ]);

  const influencerRecord = findInfluencerByMobile(influencerRecords, mobile);
  const influencerRecordId = influencerRecord ? getRecordId(influencerRecord) : "";

  const socialAccounts = getSocialAccountsForInfluencer({
    socialAccountRecords,
    influencerRecordId,
    mobile,
  }).map(mapSocialAccount);

  const influencerCampaigns = getInfluencerCampaigns({
    campaignInfluencerRecords,
    influencerRecordId,
    mobile,
  });

  const campaignInfluencerIds = influencerCampaigns
    .map((record) => getRecordId(record))
    .filter(Boolean);

  const influencerPayments = getPaymentsForCampaignInfluencers({
    paymentRecords,
    campaignInfluencerIds,
  });

  const eligibility = buildEligibilityResult({
    influencerCampaigns,
    influencerPayments,
  });

  const influencerName =
    getTextValue(influencerRecord?.s8a2442cdf) || "غير محدد";

  const influencer = influencerRecord
    ? {
        id: influencerRecordId,

        name: influencerName,
        fullName: influencerName,

        mobile: getTextValue(influencerRecord.se22f3e19b) || mobile,
        phone: getTextValue(influencerRecord.se22f3e19b) || mobile,

        city: getTextValue(influencerRecord.s5498d745d),
        country: getTextValue(influencerRecord.s5f7a6d1b0),
        nationalId: getTextValue(influencerRecord.sdf5e7d6fa),

        hasMawthooq: getMawthooqName(influencerRecord.scd2b75e3b),
        mawthooq: getMawthooqName(influencerRecord.scd2b75e3b),
        mawthooqNumber: getTextValue(influencerRecord.sfd0838d52),

        bankName: getTextValue(influencerRecord.s510a1c6cb),
        iban: getTextValue(influencerRecord.s067f7fb0b),
        accountHolderName: getTextValue(influencerRecord.s36be478d5),
      }
    : null;

  return {
    success: true,

    found: Boolean(influencerRecord),
    exists: Boolean(influencerRecord),

    influencer,

    socialAccounts,
    accounts: socialAccounts,
    platforms: socialAccounts,

    hasSocialAccounts: socialAccounts.length > 0,

    totalPreviousCampaigns: influencerCampaigns.length,
    totalPayments: influencerPayments.length,

    ...eligibility,
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const mobile =
      body.mobile ||
      body.phone ||
      body.influencerMobile ||
      body.mobileNumber ||
      "";

    if (!mobile) {
      return NextResponse.json(
        { message: "رقم الجوال مطلوب" },
        { status: 400 }
      );
    }

    const result = await checkInfluencer(mobile);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Coordinator Check Influencer API Error:", error);

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "حدث خطأ أثناء فحص المؤثر",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const mobile = url.searchParams.get("mobile") || "";

    if (!mobile) {
      return NextResponse.json(
        { message: "رقم الجوال مطلوب" },
        { status: 400 }
      );
    }

    const result = await checkInfluencer(mobile);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Coordinator Check Influencer API Error:", error);

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "حدث خطأ أثناء فحص المؤثر",
      },
      { status: 500 }
    );
  }
}