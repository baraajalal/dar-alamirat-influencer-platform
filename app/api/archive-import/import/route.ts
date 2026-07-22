import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

const SMARTSUITE_API_URL = "https://app.smartsuite.com/api/v1";

const API_KEY = process.env.SMARTSUITE_API_KEY?.trim();
const ACCOUNT_ID = process.env.SMARTSUITE_ACCOUNT_ID?.trim();

const INFLUENCERS_TABLE_ID = process.env.SMARTSUITE_INFLUENCERS_TABLE_ID;
const SOCIAL_ACCOUNTS_TABLE_ID = process.env.SMARTSUITE_SOCIAL_ACCOUNTS_TABLE_ID;
const CAMPAIGNS_TABLE_ID = process.env.SMARTSUITE_CAMPAIGNS_TABLE_ID;
const CAMPAIGN_INFLUENCERS_TABLE_ID =
  process.env.SMARTSUITE_CAMPAIGN_INFLUENCERS_TABLE_ID;
const CONTENT_LIBRARY_TABLE_ID = process.env.SMARTSUITE_CONTENT_LIBRARY_TABLE_ID;
const PAYMENTS_TABLE_ID = process.env.SMARTSUITE_PAYMENTS_TABLE_ID;

type Row = Record<string, string>;

type ImportError = {
  sheet: string;
  row: number;
  message: string;
};

const SHEET_ALIASES = {
  influencers: ["Influencers_01", "01_Influencers"],
  socialAccounts: ["Social_Accounts_02", "02_Social_Accounts"],
  campaigns: ["Campaigns_03", "03_Campaigns"],
  collaborations: ["Campaign_Influencers_04", "04_Campaign_Influencers"],
  content: ["Content_05", "05_Content"],
  payments: ["Payments_06", "06_Payments"],
};

const IMPORT_STEP_ORDER = [
  "influencers",
  "campaigns",
  "socialAccounts",
  "collaborations",
  "content",
  "payments",
];

const SOURCE_ARCHIVE_ID = "caOKg";
const PAYMENT_SOURCE_ARCHIVE_ID = "hMufn";

const CONTENT_STATUS_PUBLISHED_ID = "oxfXk";
const CONTENT_APPROVED_ID = "bPaKV";
const READY_FOR_PAYMENT_YES_ID = "6CaYy";

const ADS_YES_ID = "pwZQV";
const ADS_NO_ID = "aH6nt";
const CAN_REUSE_YES_ID = "HVgOG";
const CAN_REUSE_NO_ID = "lQXRl";

const CAMPAIGN_STATUS_IDS: Record<string, string> = {
  Closed: "4UcYP",
  "Payment Pending": "2wwDC",
  Published: "NQAqe",
  Rejected: "MDC3A",
  "Brief Sent": "4cHxM",
  "Product Sent": "PNZY3",
};

const PAYMENT_APPROVAL_IDS: Record<string, string[]> = {
  Pending: ["usCF2"],
  Approved: ["AU65Z"],
  Rejected: ["Sjw17"],
  "Need Review": ["Vvp4i"],
};

const PAYMENT_STATUS_IDS: Record<string, string> = {
  "Ready for Finance": "Iv4Iq",
  Paid: "cQLKE",
  "Partially Paid": "pddMx",
  Cancelled: "8Nsjn",
};

const PAYMENT_TYPE_IDS: Record<string, string> = {
  "Bank Transfer": "Cskhn",
  Voucher: "ObVPO",
  Product: "7nWjo",
  Commission: "DyoCW",
  Other: "FSjcg",
};

const PLATFORM_CAMPAIGN_IDS: Record<string, string> = {
  Instagram: "IAagD",
  TikTok: "IC8Tn",
  Snapchat: "PLGTZ",
  YouTube: "0L87q",
  X: "FVfaD",
  Facebook: "EXvVf",
  Other: "D57tW",
};

const PLATFORM_CONTENT_IDS: Record<string, string> = {
  Instagram: "rm2Kv",
  TikTok: "pIVAt",
  Snapchat: "O7XK5",
  YouTube: "cVjpu",
  X: "okw05",
  Facebook: "PcGwd",
  Other: "cI7TX",
};

const PLATFORM_SOCIAL_IDS: Record<string, string> = {
  Instagram: "lewTg",
  TikTok: "fcPmm",
  Snapchat: "ignLA",
  YouTube: "Gbbgd",
  X: "jHhHD",
  Facebook: "vQc7l",
  Other: "UUtcJ",
};

const CONTENT_TYPE_IDS: Record<string, string> = {
  Reel: "aDwiB",
  Story: "TnQ7W",
  Post: "f8pcO",
  Snap: "qMbzF",
  "TikTok Video": "FDKXO",
  "YouTube Short": "BECXx",
  Live: "U2TvZ",
  Photo: "YCdyY",
  Video: "p6uac",
  Other: "gsSYT",
};

const EXECUTION_TYPE_IDS: Record<string, string> = {
  Home: "wtWNO",
  "In-Branch": "jm1Gu",
};

const BRANCH_IDS: Record<string, string> = {
  "الصحافه": "Dv09E",
  "الصحافة": "Dv09E",
  "التخصصي": "kxovu",
  "ابوبكر": "i8moq",
  "أبوبكر": "i8moq",
  "جده/المكرونه": "9lQbf",
  "جدة/المكرونة": "9lQbf",
  "الخبر": "yOInv",
};

const VOUCHER_SOURCE_IDS: Record<string, string> = {
  "Branch Voucher": "Z46Zb",
  "Website Code": "fA63w",
};

const VOUCHER_BRANCH_IDS: Record<string, string> = {
  "الصحافه": "NrHVo",
  "الصحافة": "NrHVo",
  "التخصصي": "7B1Z1",
  "ابوبكر": "FzyHT",
  "أبوبكر": "FzyHT",
  "جده/المكرونه": "sukqq",
  "جدة/المكرونة": "sukqq",
  "الخبر": "gGBi3",
};

export async function POST(req: Request) {
  const errors: ImportError[] = [];

  try {
    checkEnv();

    const formData = await req.formData();
    const file = formData.get("file");
    const archiveYear = cleanText(formData.get("archiveYear") || "2026");
    const archiveMonth = cleanText(formData.get("archiveMonth") || "May");
    const startStep = cleanText(formData.get("startStep") || "influencers");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "لم يتم رفع ملف." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });

    const influencers = filterByMonth(
      readSmartSheet(workbook, findSheet(workbook, SHEET_ALIASES.influencers)).rows,
      archiveMonth,
      archiveYear
    );

    const socialAccounts = filterByMonth(
      readSmartSheet(workbook, findSheet(workbook, SHEET_ALIASES.socialAccounts)).rows,
      archiveMonth,
      archiveYear
    );

    const campaigns = filterByMonth(
      readSmartSheet(workbook, findSheet(workbook, SHEET_ALIASES.campaigns)).rows,
      archiveMonth,
      archiveYear
    );

    const collaborations = filterByMonth(
      readSmartSheet(workbook, findSheet(workbook, SHEET_ALIASES.collaborations)).rows,
      archiveMonth,
      archiveYear
    );

    const contentRows = filterByMonth(
      readSmartSheet(workbook, findSheet(workbook, SHEET_ALIASES.content)).rows,
      archiveMonth,
      archiveYear
    );

    const existingInfluencers = await listRecords(INFLUENCERS_TABLE_ID!);
    const existingSocialAccounts = await listRecords(SOCIAL_ACCOUNTS_TABLE_ID!);
    const existingCampaigns = await listRecords(CAMPAIGNS_TABLE_ID!);
    const existingCollaborations = await listRecords(CAMPAIGN_INFLUENCERS_TABLE_ID!);
    const existingContent = await listRecords(CONTENT_LIBRARY_TABLE_ID!);
    const existingPayments = await listRecords(PAYMENTS_TABLE_ID!);

    const created = {
      influencers: 0,
      socialAccounts: 0,
      campaigns: 0,
      collaborations: 0,
      content: 0,
      payments: 0,
    };

    const existing = {
      influencers: 0,
      socialAccounts: 0,
      campaigns: 0,
      collaborations: 0,
      content: 0,
      payments: 0,
    };

    const skipped = {
      duplicates: 0,
      productPayments: 0,
      missingContentLink: 0,
      skippedByStartStep: 0,
    };

    const influencerMap = new Map<string, any>();
    const campaignMap = new Map<string, any>();
    const socialAccountMap = new Map<string, any>();
    const collaborationMap = new Map<string, any>();
    const contentMap = new Map<string, any>();
    const paymentMap = new Map<string, any>();

    for (const record of existingInfluencers) {
      const mobile = normalizeMobile(record.se22f3e19b || "");
      if (mobile) influencerMap.set(mobile, record);
    }

    for (const record of existingCampaigns) {
      const campaignKey = getCampaignExistingKey(record);
      if (campaignKey) campaignMap.set(campaignKey, record);
    }

    for (const record of existingSocialAccounts) {
      const key = getSocialExistingKey(record);
      if (key) socialAccountMap.set(key, record);
    }

    for (const record of existingCollaborations) {
      const key = buildCollaborationKeyFromRecord(record);
      if (key) collaborationMap.set(key, record);
    }

    for (const record of existingContent) {
      const key = getContentExistingKey(record);
      if (key) contentMap.set(key, record);
    }

    for (const record of existingPayments) {
      const key = getPaymentExistingKey(record);
      if (key) paymentMap.set(key, record);
    }

    // 1. Influencers
    if (shouldRunStep(startStep, "influencers")) {
      for (const row of influencers) {
        const mobile = normalizeMobile(get(row, ["Influencer Mobile", "Mobile", "Phone"]));
        if (!mobile) continue;

        const found = influencerMap.get(mobile);

        if (found) {
          existing.influencers += 1;

          const updateData = buildInfluencerPayload(row, false);
          if (Object.keys(updateData).length > 0) {
            await updateRecord(INFLUENCERS_TABLE_ID!, getRecordId(found), updateData);
          }

          continue;
        }

        const createdRecord = await createRecord(
          INFLUENCERS_TABLE_ID!,
          buildInfluencerPayload(row, true)
        );

        influencerMap.set(mobile, createdRecord);
        created.influencers += 1;
      }
    } else {
      skipped.skippedByStartStep += influencers.length;
    }

    // 2. Campaigns
    if (shouldRunStep(startStep, "campaigns")) {
      for (const row of campaigns) {
        const campaignName = get(row, ["Campaign Name"]);
        const key = normalizeText(campaignName);
        if (!key) continue;

        const found = campaignMap.get(key);

        if (found) {
          existing.campaigns += 1;

          await updateRecord(
            CAMPAIGNS_TABLE_ID!,
            getRecordId(found),
            buildCampaignPayload(row)
          );

          continue;
        }

        const createdRecord = await createRecord(
          CAMPAIGNS_TABLE_ID!,
          buildCampaignPayload(row)
        );

        campaignMap.set(key, createdRecord);
        created.campaigns += 1;
      }
    } else {
      skipped.skippedByStartStep += campaigns.length;
    }

    // 3. Social Accounts
    if (shouldRunStep(startStep, "socialAccounts")) {
      for (const row of socialAccounts) {
        const mobile = normalizeMobile(get(row, ["Influencer Mobile", "Mobile", "Phone"]));
        const platform = get(row, ["Platform"]) || "Other";

        if (!mobile || !platform) continue;

        const influencer = influencerMap.get(mobile);

        if (!influencer) {
          errors.push({
            sheet: "Social_Accounts_02",
            row: rowNumber(row),
            message: `لا يوجد مؤثر مطابق لهذا الجوال: ${mobile}`,
          });
          continue;
        }

        const socialKey = getSocialRowKey(row);
        const found = socialAccountMap.get(socialKey);

        if (found) {
          existing.socialAccounts += 1;

          await updateRecord(
            SOCIAL_ACCOUNTS_TABLE_ID!,
            getRecordId(found),
            buildSocialAccountPayload(row, getRecordId(influencer))
          );

          continue;
        }

        const createdSocial = await createRecord(
          SOCIAL_ACCOUNTS_TABLE_ID!,
          buildSocialAccountPayload(row, getRecordId(influencer))
        );

        socialAccountMap.set(socialKey, createdSocial);
        created.socialAccounts += 1;
      }
    } else {
      skipped.skippedByStartStep += socialAccounts.length;
    }

    // 4. Campaign Influencers
    if (shouldRunStep(startStep, "collaborations")) {
      for (const row of collaborations) {
        const mobile = normalizeMobile(get(row, ["Influencer Mobile", "Mobile", "Phone"]));
        const campaignName = get(row, ["Campaign Name"]);
        const publishingDate = get(row, ["Publishing Date", "Post Date"]);

        if (!mobile || !campaignName || !publishingDate) {
          errors.push({
            sheet: "Campaign_Influencers_04",
            row: rowNumber(row),
            message: "رقم الجوال واسم الحملة وتاريخ النشر مطلوبة.",
          });
          continue;
        }

        const influencer = influencerMap.get(mobile);
        const campaign = campaignMap.get(normalizeText(campaignName));

        if (!influencer) {
          errors.push({
            sheet: "Campaign_Influencers_04",
            row: rowNumber(row),
            message: `لم يتم العثور على المؤثر: ${mobile}`,
          });
          continue;
        }

        if (!campaign) {
          errors.push({
            sheet: "Campaign_Influencers_04",
            row: rowNumber(row),
            message: `لم يتم العثور على الحملة: ${campaignName}`,
          });
          continue;
        }

        const duplicateKey = buildCollaborationKey(mobile, campaignName, publishingDate);
        const duplicate = collaborationMap.get(duplicateKey);

        if (duplicate) {
          existing.collaborations += 1;
          skipped.duplicates += 1;

          await updateRecord(
            CAMPAIGN_INFLUENCERS_TABLE_ID!,
            getRecordId(duplicate),
            buildCampaignInfluencerPayload(row, getRecordId(campaign), getRecordId(influencer))
          );

          continue;
        }

        const createdCollaboration = await createRecord(
          CAMPAIGN_INFLUENCERS_TABLE_ID!,
          buildCampaignInfluencerPayload(row, getRecordId(campaign), getRecordId(influencer))
        );

        collaborationMap.set(duplicateKey, createdCollaboration);
        created.collaborations += 1;
      }
    } else {
      skipped.skippedByStartStep += collaborations.length;
    }

    // 5. Content Library
    if (shouldRunStep(startStep, "content")) {
      for (const row of contentRows) {
        const mobile = normalizeMobile(get(row, ["Influencer Mobile", "Mobile", "Phone"]));
        const campaignName = get(row, ["Campaign Name"]);
        const postLink = getFirstLink(get(row, ["Post Link", "Published Link"]));
        const postDate = get(row, ["Post Date", "Publishing Date"]);

        if (!postLink) {
          skipped.missingContentLink += 1;
          continue;
        }

        const influencer = influencerMap.get(mobile);
        const campaign = campaignMap.get(normalizeText(campaignName));
        const collaboration =
          collaborationMap.get(buildCollaborationKey(mobile, campaignName, postDate)) ||
          findCollaborationByMobileCampaign(existingCollaborations, mobile, campaignName);

        if (!influencer || !campaign || !collaboration) {
          errors.push({
            sheet: "Content_05",
            row: rowNumber(row),
            message: "تعذر ربط المحتوى بالمؤثر أو الحملة أو التعاون.",
          });
          continue;
        }

    const contentTitle = buildContentTitle(row);
const contentLinkKey = postLink ? `link|${normalizeText(postLink)}` : "";
const contentTitleKey = `title|${normalizeText(contentTitle)}`;

const duplicateContent =
  (contentLinkKey ? contentMap.get(contentLinkKey) : null) ||
  contentMap.get(contentTitleKey);
        if (duplicateContent) {
          existing.content += 1;
          skipped.duplicates += 1;
          continue;
        }

        const createdContent = await createRecord(
          CONTENT_LIBRARY_TABLE_ID!,
          buildContentPayload(
            row,
            getRecordId(campaign),
            getRecordId(influencer),
            getRecordId(collaboration)
          )
        );

        if (contentLinkKey) contentMap.set(contentLinkKey, createdContent);
contentMap.set(contentTitleKey, createdContent);
        created.content += 1;
      }
    } else {
      skipped.skippedByStartStep += contentRows.length;
    }

    // 6. Payments - auto generated from Campaign_Influencers_04
    if (shouldRunStep(startStep, "payments")) {
      for (const row of collaborations) {
        const paymentType = get(row, ["Payment Type"]);
        const mobile = normalizeMobile(get(row, ["Influencer Mobile", "Mobile", "Phone"]));
        const campaignName = get(row, ["Campaign Name"]);
        const publishingDate = get(row, ["Publishing Date", "Post Date"]);

        if (normalizeText(paymentType) === "product") {
          skipped.productPayments += 1;
          continue;
        }

        if (!shouldCreatePayment(paymentType)) continue;

        const influencer = influencerMap.get(mobile);
        const campaign = campaignMap.get(normalizeText(campaignName));
        const collaboration =
          collaborationMap.get(buildCollaborationKey(mobile, campaignName, publishingDate)) ||
          findCollaborationByMobileCampaign(existingCollaborations, mobile, campaignName);

        if (!influencer || !campaign || !collaboration) {
          errors.push({
            sheet: "Campaign_Influencers_04",
            row: rowNumber(row),
            message: "تعذر إنشاء الدفع لأن الربط أو المؤثر أو الحملة غير موجود.",
          });
          continue;
        }

        const paymentKey = buildPaymentRowKey(row);
        const paymentDuplicate = paymentMap.get(paymentKey);

        if (paymentDuplicate) {
          existing.payments += 1;
          skipped.duplicates += 1;
          continue;
        }

        const createdPayment = await createRecord(
          PAYMENTS_TABLE_ID!,
          buildPaymentPayload(row, influencer, campaign, collaboration)
        );

        paymentMap.set(paymentKey, createdPayment);
        created.payments += 1;
      }
    } else {
      skipped.skippedByStartStep += collaborations.length;
    }

    return NextResponse.json({
      success: true,
      archiveMonth,
      archiveYear,
      startStep,
      created,
      existing,
      skipped,
      errors,
      message:
        errors.length === 0
          ? "تم الاستيراد بنجاح"
          : "تم الاستيراد مع وجود بعض الأخطاء",
    });
  } catch (error) {
    console.error("Archive import error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "حدث خطأ أثناء الاستيراد",
      },
      { status: 500 }
    );
  }
}

function shouldRunStep(startStep: string, currentStep: string) {
  const startIndex = IMPORT_STEP_ORDER.indexOf(startStep);
  const currentIndex = IMPORT_STEP_ORDER.indexOf(currentStep);

  if (startIndex === -1) return true;
  if (currentIndex === -1) return false;

  return currentIndex >= startIndex;
}

function checkEnv() {
  const missing = [
    ["SMARTSUITE_API_KEY", API_KEY],
    ["SMARTSUITE_ACCOUNT_ID", ACCOUNT_ID],
    ["SMARTSUITE_INFLUENCERS_TABLE_ID", INFLUENCERS_TABLE_ID],
    ["SMARTSUITE_SOCIAL_ACCOUNTS_TABLE_ID", SOCIAL_ACCOUNTS_TABLE_ID],
    ["SMARTSUITE_CAMPAIGNS_TABLE_ID", CAMPAIGNS_TABLE_ID],
    ["SMARTSUITE_CAMPAIGN_INFLUENCERS_TABLE_ID", CAMPAIGN_INFLUENCERS_TABLE_ID],
    ["SMARTSUITE_CONTENT_LIBRARY_TABLE_ID", CONTENT_LIBRARY_TABLE_ID],
    ["SMARTSUITE_PAYMENTS_TABLE_ID", PAYMENTS_TABLE_ID],
  ].filter(([, value]) => !value);

  if (missing.length > 0) {
    throw new Error(`Missing env variables: ${missing.map(([key]) => key).join(", ")}`);
  }
}

async function smartSuiteRequest(
  url: string,
  options: {
    method: "POST" | "PATCH";
    body?: Record<string, unknown>;
  },
  attempt = 1
): Promise<any> {
  if (!API_KEY) throw new Error("Missing SMARTSUITE_API_KEY");
  if (!ACCOUNT_ID) throw new Error("Missing SMARTSUITE_ACCOUNT_ID");

  try {
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
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (attempt < 3 && isRetryableNetworkError(message)) {
      console.warn(`SmartSuite request failed. Retrying attempt ${attempt + 1}/3`);
      await wait(1000 * attempt);
      return smartSuiteRequest(url, options, attempt + 1);
    }

    throw error;
  }
}

function isRetryableNetworkError(message: string) {
  const text = message.toLowerCase();

  return (
    text.includes("econnreset") ||
    text.includes("fetch failed") ||
    text.includes("socket") ||
    text.includes("timeout") ||
    text.includes("network")
  );
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function listRecords(tableId: string): Promise<any[]> {
  const result = await smartSuiteRequest(
    `${SMARTSUITE_API_URL}/applications/${tableId}/records/list/`,
    {
      method: "POST",
      body: { limit: 1000 },
    }
  );

  return result.items || result.results || result.records || [];
}

async function createRecord(tableId: string, data: Record<string, unknown>) {
  try {
    console.log("====================================");
    console.log("Creating SmartSuite record");
    console.log("Table ID:", tableId);
    console.log("Table Name:", getTableName(tableId));
    console.log("Payload Keys:", Object.keys(data));
    console.log("====================================");

    return await smartSuiteRequest(
      `${SMARTSUITE_API_URL}/applications/${tableId}/records/`,
      {
        method: "POST",
        body: cleanPayload(data),
      }
    );
  } catch (error) {
    console.error("Create record failed in table:", getTableName(tableId));
    console.error("Table ID:", tableId);
    console.error("Payload:", JSON.stringify(data, null, 2));
    throw error;
  }
}

async function updateRecord(
  tableId: string,
  recordId: string,
  data: Record<string, unknown>
) {
  if (!recordId) return null;

  return smartSuiteRequest(
    `${SMARTSUITE_API_URL}/applications/${tableId}/records/${recordId}/`,
    {
      method: "PATCH",
      body: cleanPayload(data),
    }
  );
}

function cleanPayload(data: Record<string, unknown>) {
  const cleaned: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue;
    cleaned[key] = value;
  }

  return cleaned;
}

function getTableName(tableId: string) {
  if (tableId === INFLUENCERS_TABLE_ID) return "Influencers PI";
  if (tableId === SOCIAL_ACCOUNTS_TABLE_ID) return "Social Accounts";
  if (tableId === CAMPAIGNS_TABLE_ID) return "Campaigns";
  if (tableId === CAMPAIGN_INFLUENCERS_TABLE_ID) return "Campaign Influencers";
  if (tableId === CONTENT_LIBRARY_TABLE_ID) return "Content Library";
  if (tableId === PAYMENTS_TABLE_ID) return "Payments";
  return "Unknown Table";
}

function buildInfluencerPayload(row: Row, isCreate: boolean) {
  const payload: Record<string, unknown> = {};

  const influencerName = get(row, ["Influencer Name", "Full Name", "Name"]);
  const influencerMobile = normalizeMobile(
    get(row, ["Influencer Mobile", "Mobile", "Phone"])
  );

  // مهم: نحفظ الاسم في العنوان الأساسي دائمًا، وليس فقط عند الإنشاء
  if (influencerName) {
    payload.title = influencerName;
  } else if (isCreate && influencerMobile) {
    payload.title = influencerMobile;
  }

  // Full Name
  setIfValue(payload, "s8a2442cdf", influencerName);

  // Mobile
  setIfValue(payload, "se22f3e19b", influencerMobile);

  // City
  setIfValue(payload, "s5498d745d", get(row, ["City"]));

  // Country
  setIfValue(payload, "s5f7a6d1b0", get(row, ["Country"]));

  // National ID / Iqama
  setIfValue(
    payload,
    "sdf5e7d6fa",
    get(row, ["National ID / Iqama", "National ID"])
  );

  // Bank Name
  setIfValue(payload, "s510a1c6cb", get(row, ["Bank Name"]));

  // IBAN
  setIfValue(payload, "s067f7fb0b", get(row, ["IBAN"]));

  // Account Holder Name
  setIfValue(payload, "s36be478d5", get(row, ["Account Holder Name"]));

  // Mawthooq Number
  setIfValue(payload, "sfd0838d52", get(row, ["Mawthooq Number"]));

  const mawthooq = get(row, ["Has Mawthooq"]);

  if (mawthooq) {
    payload.scd2b75e3b = normalizeText(mawthooq) === "yes" ? "OgXe2" : "RpV6I";
  }

  return payload;
}

function buildCampaignPayload(row: Row) {
  const campaignName = get(row, ["Campaign Name"]);

  return {
    title: campaignName,
    s53c807f15: campaignName,
    s3fa372904: get(row, ["Brand"]),
    s3869eb683: get(row, ["Product"]),
    sbc6fe7be1: get(row, ["Campaign Type"]),
    s1889ebf16: dateValue(get(row, ["Start Date"])),
    s415b6fd8d: dateValue(get(row, ["End Date"])),
    sba730f59b: get(row, ["Manager"]),
    s97c8d3f53: get(row, ["Brief"]),
    s0230230dc: todayDate(),
    s83d15330a: todayDate(),
  };
}

function buildSocialAccountPayload(row: Row, influencerRecordId: string) {
  const platform = get(row, ["Platform"]) || "Other";

  return {
    title: `${get(row, ["Influencer Name"])} - ${platform}`,
    sf702e7fac: [influencerRecordId],
    s2071e9c0b: get(row, ["Influencer Name"]),
    sfd995e159: normalizeMobile(get(row, ["Influencer Mobile"])),
    s6eb45309: PLATFORM_SOCIAL_IDS[platform] || PLATFORM_SOCIAL_IDS.Other,
    s0337da55a: limitText(getFirstLink(get(row, ["Profile URL"])), 500),
    s2da4f29f5: get(row, ["Username"]),
    sd03185167: numberOrBlank(get(row, ["Followers Count"])),
    sc00535482: numberOrBlank(get(row, ["Average View"])),
    s41ebd9627: numberOrBlank(get(row, ["Average Likes"])),
    s3a367ccb5: numberOrBlank(get(row, ["Average Comments"])),
    s3317459b2: get(row, ["Engagement Rate"]),
    s42f7bb236: get(row, ["Audience Main City"]),
    s3ad5a52db: get(row, ["Audience Main Country"]),
    sb90b7e360: todayDate(),
  };
}

function buildCampaignInfluencerPayload(
  row: Row,
  campaignRecordId: string,
  influencerRecordId: string
) {
  const paymentType = get(row, ["Payment Type"]);
  const status = get(row, ["Collaboration Status"]) || "Closed";
  const paymentApproval = get(row, ["Payment Approval Status"]) || "Approved";
  const paymentRecordCreated = get(row, ["Payment Record Created"]);
  const executionType = get(row, ["Campaign Execution Type"]);
  const platforms = splitMulti(get(row, ["Platforms"]));

  return {
    title: `${get(row, ["Campaign Name"])} - ${get(row, ["Influencer Mobile"])}`,
    s01944895f: [campaignRecordId],
    s590fc77ca: get(row, ["Campaign Name"]),
    s85138512a: [influencerRecordId],
    scc4243592: get(row, ["Influencer Name"]),
    s4ca700cd4: getInfluencerTypeId(get(row, ["Influencer Type"])),
    sf6fbe2681: getPaymentTypeIds(paymentType),
    seb3ddba13: get(row, ["Agreed Amount"]),
    se72f3a482: get(row, ["Voucher Value"]),
    s5ce29698a: get(row, ["Order Invoice Amount"]),
    scd8bebe3e: dateString(get(row, ["Content Due Date"])),
    s4121894d1: dateString(get(row, ["Publishing Date", "Post Date"])),
    sbb87657da: limitText(getFirstLink(get(row, ["Published Link", "Post Link"])), 500),
    s5dbd233a4: get(row, ["Promo Code"]),
    s07467f562: get(row, ["Coordinator Name"]),
    s296f3cf5a: get(row, ["Order Number"]),
    s7cea72877: get(row, ["Order Code"]),
    s43d3f4c40: EXECUTION_TYPE_IDS[executionType] || null,
    s45965d1dd: getBranchId(get(row, ["Branch"])),
    s8c13ff8df: VOUCHER_SOURCE_IDS[get(row, ["Voucher Source"])] || null,
    sf118d1731: getVoucherBranchId(get(row, ["Voucher Branch"])),
    se3b7cd09a:
      platforms.length > 0
        ? platforms.map((platform) => PLATFORM_CAMPAIGN_IDS[platform] || PLATFORM_CAMPAIGN_IDS.Other)
        : [],
    sdaf7872a0: normalizeMobile(get(row, ["Influencer Mobile"])),
    sc42ee4059: PAYMENT_APPROVAL_IDS[paymentApproval] || PAYMENT_APPROVAL_IDS.Approved,
    s5549fe7d8: normalizeText(paymentRecordCreated) === "yes" ? "G13Zt" : "sfiex",

    // Required fields in your SmartSuite table
    s4a83b4d1a: "nERlc", // Brief Sent? = Yes
    s147931a69: "i3Ivq", // Product Sent? = Yes

    sac3648c3c: SOURCE_ARCHIVE_ID,
    s058cfa307: todayDate(),
    s153a28310: todayDate(),
    status: {
      value: CAMPAIGN_STATUS_IDS[status] || CAMPAIGN_STATUS_IDS.Closed,
    },
    description: richTextDoc(
      `Archive Import
Month: ${get(row, ["Archive Month"])}
Year: ${get(row, ["Archive Year"])}
Notes: ${get(row, ["Notes"])}`
    ),
  };
}

function buildContentPayload(
  row: Row,
  campaignRecordId: string,
  influencerRecordId: string,
  collaborationRecordId: string
) {
  const platform = get(row, ["Platform"]) || "Other";
  const contentType = get(row, ["Content Type"]) || "Other";
  const canReuse = get(row, ["Can Reuse in Ads?"]);
  const suitable = get(row, ["Is Suitable for Ads"]);
  const postLink = getFirstLink(get(row, ["Post Link", "Published Link"]));

  return {
   title: buildContentTitle(row),
    description: get(row, ["Supervisor Review Notes", "Notes"]),
    s6476e8770: [collaborationRecordId],
    s9a088e938: [campaignRecordId],
    sf6e066e15: get(row, ["Campaign Name"]),
    s43b94b221: [influencerRecordId],
    s65c64900d: get(row, ["Influencer Name"]),
    sa3c04ed16: normalizeMobile(get(row, ["Influencer Mobile"])),
    s2ef379dbe: PLATFORM_CONTENT_IDS[platform] || PLATFORM_CONTENT_IDS.Other,
    sac21f5178: CONTENT_TYPE_IDS[contentType] || CONTENT_TYPE_IDS.Other,
    s9727fc2c7: CONTENT_STATUS_PUBLISHED_ID,
    s5364f427e: limitText(postLink, 500),
    s4203b3432: postLink ? [postLink] : [],
    sf0d95cb61: normalizeText(canReuse) === "yes" ? CAN_REUSE_YES_ID : CAN_REUSE_NO_ID,
    s12cf00ef2: normalizeText(suitable) === "yes" ? ADS_YES_ID : ADS_NO_ID,
    s981a45b97: dateValue(get(row, ["Post Date", "Publishing Date"])),
    s8adf35d78: CONTENT_APPROVED_ID,
    sc2f8312a6: READY_FOR_PAYMENT_YES_ID,
    sd79e91588: get(row, ["Supervisor Review Notes"]),
    se2f73fc23: get(row, ["Promo Code"]),
    s7f3f19ab5: numberOrBlank(get(row, ["Views"])),
    sbb576df23: numberOrBlank(get(row, ["Likes"])),
    sa77891b1b: numberOrBlank(get(row, ["Comments"])),
    s8c139781b: numberOrBlank(get(row, ["Shares"])),
    s893d5c666: numberOrBlank(get(row, ["Saves"])),
    s8d0592f7a: todayDate(),
    s68059f011: todayDate(),
  };
}

function buildPaymentPayload(row: Row, influencer: any, campaign: any, collaboration: any) {
  const paymentType = get(row, ["Payment Type"]);
  const status = get(row, ["Collaboration Status"]);
  const paidDateFromRow = get(row, ["Paid Date"]);
  const postLink = getFirstLink(get(row, ["Published Link", "Post Link"]));

  const paymentStatus =
    status === "Closed"
      ? "Paid"
      : status === "Payment Pending"
      ? "Ready for Finance"
      : status === "Rejected"
      ? "Cancelled"
      : "Ready for Finance";

  return {
    title: `PAY-${get(row, ["Campaign Name"])}-${get(row, ["Influencer Mobile"])}`,
    s55faf09aa: [getRecordId(collaboration)],
    sa1654cad3: get(row, ["Campaign Name"]),
    s687ecf684: get(row, ["Influencer Name"]),
    s3e3506c2b: get(row, ["Influencer Type"]),
    sb6b0099cb: paymentType,
    s21c247bb2: get(row, ["Agreed Amount"]),
    s81aa1999e: get(row, ["Voucher Value"]),
    s6091f3df9: get(row, ["Order Invoice Amount"]),
    s4a71c5551: influencer.s510a1c6cb || get(row, ["Bank Name"]),
    s410fa372a: influencer.s067f7fb0b || get(row, ["IBAN"]),
    s07d531627: influencer.s36be478d5 || get(row, ["Account Holder Name"]),
    sa51914e57: influencer.sdf5e7d6fa || get(row, ["National ID / Iqama"]),
    s8a401e43b: limitText(postLink, 500),
    sc5f22146c: PAYMENT_STATUS_IDS[paymentStatus],
    sa7e6743a1:
      paymentStatus === "Paid"
        ? dateValue(paidDateFromRow || get(row, ["Publishing Date", "Post Date"]))
        : null,
    s48364d932: get(row, ["Notes"]),
    s6c51cc843: [getRecordId(influencer)],
    sc93f1010d: PAYMENT_SOURCE_ARCHIVE_ID,
    sdd0d4ce20: normalizeMobile(get(row, ["Influencer Mobile"])),
  };
}

function shouldCreatePayment(paymentType: string) {
  const text = normalizeText(paymentType);

  return (
    text.includes("bank") ||
    text.includes("transfer") ||
    text.includes("voucher") ||
    text.includes("commission") ||
    text.includes("other")
  );
}

function getPaymentTypeIds(value: string) {
  const parts = splitMulti(value);
  const ids: string[] = [];

  for (const part of parts) {
    if (PAYMENT_TYPE_IDS[part]) {
      ids.push(PAYMENT_TYPE_IDS[part]);
      continue;
    }

    const text = normalizeText(part);

    if (text.includes("bank") || text.includes("transfer")) {
      ids.push(PAYMENT_TYPE_IDS["Bank Transfer"]);
    } else if (text.includes("voucher")) {
      ids.push(PAYMENT_TYPE_IDS.Voucher);
    } else if (text.includes("product")) {
      ids.push(PAYMENT_TYPE_IDS.Product);
    } else if (text.includes("commission")) {
      ids.push(PAYMENT_TYPE_IDS.Commission);
    } else {
      ids.push(PAYMENT_TYPE_IDS.Other);
    }
  }

  return Array.from(new Set(ids));
}

function getInfluencerTypeId(value: string) {
  const text = normalizeText(value);

  if (text.includes("trusted")) return ["sJgBl"];
  if (text.includes("untrusted")) return ["zZE8m"];

  return ["Y5vrc"];
}

function getBranchId(value: string) {
  return BRANCH_IDS[cleanText(value)] || null;
}

function getVoucherBranchId(value: string) {
  return VOUCHER_BRANCH_IDS[cleanText(value)] || null;
}

function getPlatformNameFromSocialId(value: string) {
  const entry = Object.entries(PLATFORM_SOCIAL_IDS).find(([, id]) => id === value);
  return entry?.[0] || "";
}

function buildCollaborationKeyFromRecord(record: any) {
  const mobile = normalizeMobile(record.sdaf7872a0 || "");
  const campaignName = record.s590fc77ca || "";
  const date = extractDateKey(record.s4121894d1);

  if (!mobile || !campaignName || !date) return "";

  return buildCollaborationKey(mobile, campaignName, date);
}

function buildCollaborationKey(mobile: string, campaignName: string, publishingDate: string) {
  return `${normalizeMobile(mobile)}|${normalizeText(campaignName)}|${normalizeDateKey(publishingDate)}`;
}

function findCollaborationByMobileCampaign(records: any[], mobile: string, campaignName: string) {
  const targetMobile = normalizeMobile(mobile);
  const targetCampaign = normalizeText(campaignName);

  return records.find((record: any) => {
    const recordMobile = normalizeMobile(record.sdaf7872a0 || "");
    const recordCampaign = normalizeText(record.s590fc77ca || "");

    return recordMobile === targetMobile && recordCampaign === targetCampaign;
  });
}

function getContentExistingKey(record: any) {
  const links = Array.isArray(record.s4203b3432) ? record.s4203b3432 : [];
  const first = links[0] || record.s5364f427e || "";
  const linkKey = normalizeText(getFirstLink(first));

  if (linkKey) return `link|${linkKey}`;

  const title = normalizeText(record.title || "");
  if (title) return `title|${title}`;

  return "";
}

function getPaymentExistingKey(record: any) {
  const mobile = normalizeMobile(record.sdd0d4ce20 || "");
  const campaign = normalizeText(record.sa1654cad3 || "");
  const type = normalizeText(record.sb6b0099cb || "");
  const amount = cleanText(record.s21c247bb2 || "");
  const voucher = cleanText(record.s81aa1999e || "");

  return `${mobile}|${campaign}|${type}|${amount}|${voucher}`;
}

function buildPaymentRowKey(row: Row) {
  const mobile = normalizeMobile(get(row, ["Influencer Mobile", "Mobile", "Phone"]));
  const campaign = normalizeText(get(row, ["Campaign Name"]));
  const type = normalizeText(get(row, ["Payment Type"]));
  const amount = cleanText(get(row, ["Agreed Amount"]));
  const voucher = cleanText(get(row, ["Voucher Value"]));

  return `${mobile}|${campaign}|${type}|${amount}|${voucher}`;
}

function filterByMonth(rows: Row[], archiveMonth: string, archiveYear: string) {
  return rows.filter((row) => {
    const month = normalizeText(get(row, ["Archive Month"]));
    const year = normalizeText(get(row, ["Archive Year"]));

    return month === normalizeText(archiveMonth) && year === normalizeText(archiveYear);
  });
}

function findSheet(workbook: XLSX.WorkBook, possibleNames: string[]): string | null {
  const normalizedNames = workbook.SheetNames.map((name) => ({
    original: name,
    normalized: normalizeHeader(name),
  }));

  for (const possible of possibleNames) {
    const found = normalizedNames.find(
      (item) => item.normalized === normalizeHeader(possible)
    );

    if (found) return found.original;
  }

  return null;
}

function readSmartSheet(
  workbook: XLSX.WorkBook,
  sheetName: string | null
): { rows: Row[]; headers: string[] } {
  if (!sheetName) return { rows: [], headers: [] };

  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return { rows: [], headers: [] };

  const matrix = XLSX.utils.sheet_to_json<any[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  });

  if (!matrix.length) return { rows: [], headers: [] };

  const headerRowIndex = findHeaderRowIndex(matrix);
  const headers = matrix[headerRowIndex].map((cell) => cleanText(cell));
  const rows: Row[] = [];

  for (let i = headerRowIndex + 1; i < matrix.length; i++) {
    const line = matrix[i];
    const hasAnyValue = line.some((cell) => cleanText(cell) !== "");

    if (!hasAnyValue) continue;

    const row: Row = {};

    headers.forEach((header, index) => {
      if (!header) return;
      row[header] = cleanText(line[index]);
    });

    row.__excelRowNumber = String(i + 1);
    rows.push(row);
  }

  return { rows, headers };
}

function findHeaderRowIndex(matrix: any[][]): number {
  const knownHeaders = [
    "Influencer Mobile",
    "Influencer Name",
    "Campaign Name",
    "Payment Type",
    "Collaboration Status",
    "Platform",
    "Post Link",
  ];

  let bestIndex = 0;
  let bestScore = 0;

  for (let i = 0; i < Math.min(matrix.length, 20); i++) {
    const row = matrix[i] || [];
    const normalizedCells = row.map((cell) => normalizeHeader(cleanText(cell)));

    let score = 0;

    for (const header of knownHeaders) {
      if (normalizedCells.includes(normalizeHeader(header))) {
        score += 1;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  return bestIndex;
}

function get(row: Row, possibleKeys: string[]) {
  for (const key of possibleKeys) {
    const direct = row[key];

    if (direct !== undefined && direct !== null && cleanText(direct) !== "") {
      return cleanText(direct);
    }
  }

  for (const [actualKey, actualValue] of Object.entries(row)) {
    for (const expectedKey of possibleKeys) {
      if (normalizeHeader(actualKey) === normalizeHeader(expectedKey)) {
        return cleanText(actualValue);
      }
    }
  }

  return "";
}

function setIfValue(payload: Record<string, unknown>, key: string, value: string) {
  if (cleanText(value)) payload[key] = cleanText(value);
}

function cleanText(input: any): string {
  return String(input ?? "")
    .replace(/\u00A0/g, " ")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\r?\n|\r/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeHeader(input: string): string {
  return cleanText(input).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeText(input: string) {
  return cleanText(input).toLowerCase();
}

function normalizeMobile(value: string) {
  let mobile = cleanText(value)
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

function normalizeDateKey(value: string) {
  return dateString(value);
}

function extractDateKey(value: any) {
  if (!value) return "";

  if (typeof value === "object" && value.date) {
    return normalizeDateKey(value.date);
  }

  return normalizeDateKey(String(value));
}

function splitMulti(value: string) {
  return cleanText(value)
    .split(/[,،+]/)
    .map((item) => cleanText(item))
    .filter(Boolean);
}

function numberOrBlank(value: string) {
  const cleaned = cleanText(value).replace(/,/g, "");
  if (!cleaned) return "";
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : "";
}

function dateValue(value: string) {
  const cleaned = cleanText(value);
  if (!cleaned) return null;

  const dateOnly = dateString(cleaned);

  return {
    date: `${dateOnly}T00:00:00.000000Z`,
    include_time: false,
  };
}

function dateString(value: string) {
  const cleaned = cleanText(value);
  if (!cleaned) return "";

  if (/^\d{4}-\d{2}-\d{2}/.test(cleaned)) {
    return cleaned.split("T")[0];
  }

  const slashMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);

  if (slashMatch) {
    const month = slashMatch[1].padStart(2, "0");
    const day = slashMatch[2].padStart(2, "0");
    let year = slashMatch[3];

    if (year.length === 2) {
      year = `20${year}`;
    }

    return `${year}-${month}-${day}`;
  }

  return cleaned.split("T")[0];
}

function todayDate() {
  const today = new Date().toISOString().split("T")[0];

  return {
    date: `${today}T00:00:00.000000Z`,
    include_time: false,
  };
}

function getRecordId(record: any) {
  return record.id || record.record_id || "";
}

function rowNumber(row: Row) {
  const rowNumberValue = Number(row.__excelRowNumber);
  return Number.isFinite(rowNumberValue) ? rowNumberValue : 0;
}

function richTextDoc(text: string) {
  const safeText = cleanText(text);

  return {
    data: {
      type: "doc",
      content: [],
    },
    html: `<div class="rendered">${safeText.replace(/\n/g, "<br>")}</div>`,
    preview: safeText.slice(0, 120),
  };
}

function getSelectValue(value: any) {
  if (Array.isArray(value)) {
    return cleanText(value[0]);
  }

  if (value && typeof value === "object") {
    return cleanText(value.value || value.id || value.slug || "");
  }

  return cleanText(value);
}

function getCampaignExistingKey(record: any) {
  return normalizeText(record.s53c807f15 || record.title || record.name || "");
}

function getSocialExistingKey(record: any) {
  const mobile = normalizeMobile(record.sfd995e159 || "");
  const platformId = getSelectValue(record.s6eb45309);
  const platformName = getPlatformNameFromSocialId(platformId);

  if (!mobile || !platformName) return "";

  return `${mobile}|${normalizeText(platformName)}`;
}

function getSocialRowKey(row: Row) {
  const mobile = normalizeMobile(get(row, ["Influencer Mobile", "Mobile", "Phone"]));
  const platform = get(row, ["Platform"]) || "Other";

  return `${mobile}|${normalizeText(platform)}`;
}

function limitText(value: string, maxLength: number) {
  const cleaned = cleanText(value);
  if (!cleaned) return "";
  return cleaned.length > maxLength ? cleaned.slice(0, maxLength) : cleaned;
}

function getFirstLink(value: string) {
  const cleaned = cleanText(value);
  if (!cleaned) return "";

  const parts = cleaned
    .split(/[\s,،]+/)
    .map((part) => cleanText(part))
    .filter(Boolean);

  const link = parts.find(
    (part) => part.startsWith("http://") || part.startsWith("https://")
  );

  return link || cleaned;
}
function buildContentTitle(row: Row) {
  const campaignName = limitText(get(row, ["Campaign Name"]), 80);
  const influencerName = limitText(get(row, ["Influencer Name"]), 60);
  const platform = get(row, ["Platform"]) || "Other";
  const postDate = dateString(get(row, ["Post Date", "Publishing Date"]));
  const rowNo = rowNumber(row);
  const postLink = getFirstLink(get(row, ["Post Link", "Published Link"]));
  const hash = shortHash(postLink || `${campaignName}-${influencerName}-${platform}-${postDate}-${rowNo}`);

  return limitText(
    `${campaignName} - ${influencerName} - ${platform} - ${postDate || "NoDate"} - R${rowNo}-${hash}`,
    250
  );
}

function shortHash(value: string) {
  const text = cleanText(value);
  let hash = 0;

  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }

  return Math.abs(hash).toString(36).slice(0, 8);
}