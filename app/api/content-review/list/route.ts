import { NextResponse } from "next/server";

const SMARTSUITE_API_URL = "https://app.smartsuite.com/api/v1";

const API_KEY = process.env.SMARTSUITE_API_KEY?.trim();
const ACCOUNT_ID = process.env.SMARTSUITE_ACCOUNT_ID?.trim();

const CONTENT_LIBRARY_TABLE_ID =
  process.env.SMARTSUITE_CONTENT_LIBRARY_TABLE_ID;

const CAMPAIGN_INFLUENCERS_TABLE_ID =
  process.env.SMARTSUITE_CAMPAIGN_INFLUENCERS_TABLE_ID;

function asArray(value: any): any[] {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return [value];
}

function extractLinks(value: any): string[] {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item;
        if (item?.url) return item.url;
        if (item?.href) return item.href;
        if (item?.value) return item.value;
        if (item?.display_value) return item.display_value;
        if (item?.text) return item.text;
        return "";
      })
      .flatMap((item) => {
        if (!item) return [];
        const matches = String(item).match(/https?:\/\/[^\s"'<>]+/g);
        return matches || [];
      })
      .filter(Boolean);
  }

  if (typeof value === "string") {
    const matches = value.match(/https?:\/\/[^\s"'<>]+/g);
    return matches || [];
  }

  if (value?.url) return [value.url];
  if (value?.href) return [value.href];
  if (value?.value) return extractLinks(value.value);
  if (value?.display_value) return extractLinks(value.display_value);
  if (value?.text) return extractLinks(value.text);

  return [];
}

function firstLink(value: any): string {
  return extractLinks(value)[0] || "";
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

function getMultiSelectValues(value: any): string[] {
  return asArray(value)
    .map((item) => getSingleSelectValue(item))
    .filter(Boolean);
}

function getExecutionType(value: any) {
  const rawValue = getSingleSelectValue(value);

  if (rawValue === "wtWNO") return "Home";
  if (rawValue === "jm1Gu") return "In-Branch";

  return "";
}

function getPlatformName(value: any) {
  const rawValue = getSingleSelectValue(value);

  const map: Record<string, string> = {
    rm2Kv: "Instagram",
    pIVAt: "TikTok",
    O7XK5: "Snapchat",
    cVjpu: "YouTube",
    okw05: "X",
    PcGwd: "Facebook",
    cI7TX: "Other",

    IAagD: "Instagram",
    IC8Tn: "TikTok",
    PLGTZ: "Snapchat",
    "0L87q": "YouTube",
    FVfaD: "X",
    EXvVf: "Facebook",
    D57tW: "Other",
  };

  return map[rawValue] || rawValue || "-";
}

function getContentTypeName(value: any) {
  const rawValue = getSingleSelectValue(value);

  const map: Record<string, string> = {
    aDwiB: "Reel",
    TnQ7W: "Story",
    f8pcO: "Post",
    qMbzF: "Snap",
    FDKXO: "TikTok Video",
    BECXx: "YouTube Short",
    U2TvZ: "Live",
    YCdyY: "Photo",
    p6uac: "Video",
    gsSYT: "Other",
  };

  return map[rawValue] || rawValue || "-";
}

function getApprovalStatusName(value: any) {
  const rawValue = getSingleSelectValue(asArray(value)[0] || value);

  const map: Record<string, string> = {
    "18326": "Pending",
    bPaKV: "Approved",
    tgq9n: "Rejected",
    F6Z83: "Needs Changes",
  };

  return map[rawValue] || rawValue || "";
}

function getCanReuseInAdsName(value: any) {
  const rawValue = getSingleSelectValue(value);

  const map: Record<string, string> = {
    HVgOG: "Yes",
    lQXRl: "No",
  };

  return map[rawValue] || rawValue || "";
}

function getPaymentTypeNames(value: any) {
  const ids = getMultiSelectValues(value);

  const map: Record<string, string> = {
    Cskhn: "تحويل بنكي",
    ObVPO: "قسيمة شرائية",
    "7nWjo": "منتجات",
    DyoCW: "عمولة",
    FSjcg: "أخرى",
  };

  return ids.map((id) => map[id] || id).filter(Boolean);
}

function formatValue(value: any) {
  if (value === null || value === undefined || value === "") return "";

  if (typeof value === "number") {
    return new Intl.NumberFormat("ar-SA").format(value);
  }

  return String(value);
}

function buildPaymentSummary(campaignInfluencer: any) {
  const paymentTypeNames = getPaymentTypeNames(campaignInfluencer?.sf6fbe2681);

  const bankAmount = formatValue(campaignInfluencer?.seb3ddba13);
  const voucherValue = formatValue(campaignInfluencer?.se72f3a482);
  const productValue = formatValue(campaignInfluencer?.s5ce29698a);

  const parts: string[] = [];

  if (bankAmount) parts.push(`تحويل: ${bankAmount} ريال`);
  if (voucherValue) parts.push(`قسيمة: ${voucherValue} ريال`);
  if (productValue) parts.push(`منتجات: ${productValue} ريال`);

  return {
    paymentType: paymentTypeNames.length ? paymentTypeNames.join(" + ") : "-",
    paymentSummary: parts.length ? parts.join(" | ") : "-",
    bankAmount,
    voucherValue,
    productValue,
  };
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

function findCampaignInfluencerById(records: any[], recordId: string) {
  return records.find((record) => {
    const id = String(record.id || record.record_id || "");
    return id === String(recordId);
  });
}

export async function GET() {
  try {
    if (!CONTENT_LIBRARY_TABLE_ID) {
      return NextResponse.json(
        { message: "Missing SMARTSUITE_CONTENT_LIBRARY_TABLE_ID" },
        { status: 500 }
      );
    }

    if (!CAMPAIGN_INFLUENCERS_TABLE_ID) {
      return NextResponse.json(
        { message: "Missing SMARTSUITE_CAMPAIGN_INFLUENCERS_TABLE_ID" },
        { status: 500 }
      );
    }

    const [contentRecords, campaignInfluencerRecords] = await Promise.all([
      listRecords(CONTENT_LIBRARY_TABLE_ID),
      listRecords(CAMPAIGN_INFLUENCERS_TABLE_ID),
    ]);

    const items = contentRecords
      .map((record: any) => {
        const id = String(record.id || record.record_id || record.title || "");

        const campaignInfluencerIds = asArray(record.s6476e8770);
        const campaignInfluencerId = String(campaignInfluencerIds[0] || "");

        const campaignInfluencer = findCampaignInfluencerById(
          campaignInfluencerRecords,
          campaignInfluencerId
        );

        const executionType = getExecutionType(campaignInfluencer?.s43d3f4c40);
        const approvalStatus = getApprovalStatusName(record.s8adf35d78);
        const paymentInfo = buildPaymentSummary(campaignInfluencer);

        return {
          id,

          campaignName:
            record.sf6e066e15 || campaignInfluencer?.s590fc77ca || "",
          influencerName:
            record.s65c64900d || campaignInfluencer?.scc4243592 || "",
          influencerMobile:
            record.sa3c04ed16 || campaignInfluencer?.sdaf7872a0 || "",

          campaignInfluencerId,
          executionType,

          platform:
            getPlatformName(record.s2ef379dbe) ||
            getPlatformName(campaignInfluencer?.se3b7cd09a),

          contentType: getContentTypeName(record.sac21f5178),

          promoCode:
            record.se2f73fc23 || campaignInfluencer?.s5dbd233a4 || "",

          postLinks: extractLinks(record.s4203b3432),
          contentLink:
            firstLink(record.s5364f427e) || firstLink(record.s382151ff7),
          screenshotLink: firstLink(record.s86487252f),

          usageRightsNote: record.s33dee34ae || "",
          canReuseInAds: getCanReuseInAdsName(record.sf0d95cb61),

          approvalStatus,
          supervisorNotes: record.sd79e91588 || "",

          paymentType: paymentInfo.paymentType,
          paymentSummary: paymentInfo.paymentSummary,
          bankAmount: paymentInfo.bankAmount,
          voucherValue: paymentInfo.voucherValue,
          productValue: paymentInfo.productValue,
        };
      })
      .filter((item: any) => item.approvalStatus === "Pending");

    return NextResponse.json({
      success: true,
      items,
    });
  } catch (error) {
    console.error("Content Review List API Error:", error);

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "حدث خطأ أثناء جلب محتوى المراجعة",
      },
      { status: 500 }
    );
  }
}