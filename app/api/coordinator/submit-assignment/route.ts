import { NextResponse } from "next/server";

const SMARTSUITE_API_URL = "https://app.smartsuite.com/api/v1";

const API_KEY = process.env.SMARTSUITE_API_KEY?.trim();
const ACCOUNT_ID = process.env.SMARTSUITE_ACCOUNT_ID?.trim();

const CAMPAIGN_INFLUENCERS_TABLE_ID =
  process.env.SMARTSUITE_CAMPAIGN_INFLUENCERS_TABLE_ID;

const APP_BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

type SubmitAssignmentPayload = {
  coordinator: {
    name: string;
    code: string;
    mobile: string;
  };
  campaign: {
    recordId: string;
    campaignName: string;
  };
  influencer: {
    recordId: string;
    fullName: string;
    mobile: string;
    hasMawthooq: string;
  };
  socialAccounts: Array<{
    recordId: string;
    platform: string;
    username: string;
  }>;
  assignment: {
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
};

function normalizeMobile(value: string) {
  return String(value || "")
    .replace(/\s/g, "")
    .replace(/\+/g, "")
    .replace(/-/g, "")
    .trim();
}

function normalizeText(value: string) {
  return String(value || "").trim().toLowerCase();
}

function getInfluencerTypeId(hasMawthooq: string) {
  if (hasMawthooq === "Trusted") return ["sJgBl"];
  if (hasMawthooq === "Untrusted") return ["zZE8m"];
  return ["Y5vrc"];
}

function getPaymentTypeIds(values: string[]) {
  const ids: string[] = [];

  values.forEach((value) => {
    const text = normalizeText(value);

    if (
      text.includes("bank") ||
      text.includes("transfer") ||
      text.includes("تحويل")
    ) {
      ids.push("Cskhn");
      return;
    }

    if (text.includes("voucher") || text.includes("قسيم")) {
      ids.push("ObVPO");
      return;
    }

    if (text.includes("product") || text.includes("منتج")) {
      ids.push("7nWjo");
      return;
    }

    if (text.includes("commission") || text.includes("عمول")) {
      ids.push("DyoCW");
      return;
    }

    ids.push("FSjcg");
  });

  return Array.from(new Set(ids));
}

function getExecutionTypeId(value: string) {
  if (value === "Home") return "wtWNO";
  if (value === "In-Branch") return "jm1Gu";
  return null;
}

function getBranchId(value: string) {
  const text = normalizeText(value);

  if (!text) return null;

  if (text.includes("صحاف")) return "Dv09E";
  if (text.includes("تخصص")) return "kxovu";
  if (text.includes("ابوبكر") || text.includes("أبوبكر")) return "i8moq";

  if (
    text.includes("مكرونه") ||
    text.includes("مكرونة") ||
    text.includes("جده") ||
    text.includes("جدة")
  ) {
    return "9lQbf";
  }

  if (text.includes("خبر")) return "yOInv";

  return null;
}

function getVoucherSourceId(value: string) {
  if (value === "Branch Voucher") return "Z46Zb";
  if (value === "Website Code") return "fA63w";
  return null;
}

function getVoucherBranchId(value: string) {
  const text = normalizeText(value);

  if (!text) return null;

  if (text.includes("صحاف")) return "NrHVo";
  if (text.includes("تخصص")) return "7B1Z1";
  if (text.includes("ابوبكر") || text.includes("أبوبكر")) return "FzyHT";

  if (
    text.includes("مكرونه") ||
    text.includes("مكرونة") ||
    text.includes("جده") ||
    text.includes("جدة")
  ) {
    return "sukqq";
  }

  if (text.includes("خبر")) return "gGBi3";

  return null;
}

function getPlatformId(platform: string) {
  const text = normalizeText(platform);

  if (text.includes("instagram") || text.includes("انستا")) return "IAagD";
  if (text.includes("tiktok") || text.includes("تيك")) return "IC8Tn";
  if (text.includes("snap") || text.includes("سناب")) return "PLGTZ";
  if (text.includes("youtube") || text.includes("يوتيوب")) return "0L87q";
  if (text === "x" || text.includes("twitter")) return "FVfaD";
  if (text.includes("facebook")) return "EXvVf";

  return "D57tW";
}

function getPlatformIds(socialAccounts: Array<{ platform: string }>) {
  return Array.from(
    new Set(socialAccounts.map((account) => getPlatformId(account.platform)))
  );
}

function paymentIncludesVoucher(paymentTypes: string[]) {
  return paymentTypes.some((type) => normalizeText(type).includes("voucher"));
}

function paymentIncludesBankTransfer(paymentTypes: string[]) {
  return paymentTypes.some((type) => {
    const text = normalizeText(type);

    return (
      text.includes("bank") ||
      text.includes("transfer") ||
      text.includes("تحويل")
    );
  });
}

function generateSubmissionCode() {
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `DA-CNT-${random}`;
}

function buildSubmissionLink(code: string) {
  return `${APP_BASE_URL}/content-submit?code=${encodeURIComponent(code)}`;
}

function todayDate() {
  const today = new Date().toISOString().split("T")[0];

  return {
    date: `${today}T00:00:00.000000Z`,
    include_time: false,
  };
}

async function smartSuiteRequest(
  url: string,
  options: {
    method: "POST" | "PATCH";
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
      body: { limit: 1000 },
    }
  );

  return result.items || result.results || result.records || [];
}

async function createRecord(tableId: string, data: Record<string, unknown>) {
  return smartSuiteRequest(
    `${SMARTSUITE_API_URL}/applications/${tableId}/records/`,
    {
      method: "POST",
      body: data,
    }
  );
}

async function updateRecord(
  tableId: string,
  recordId: string,
  data: Record<string, unknown>
) {
  return smartSuiteRequest(
    `${SMARTSUITE_API_URL}/applications/${tableId}/records/${recordId}/`,
    {
      method: "PATCH",
      body: data,
    }
  );
}

function findExistingAssignment(
  records: any[],
  campaignName: string,
  mobile: string
) {
  const targetCampaign = normalizeText(campaignName);
  const targetMobile = normalizeMobile(mobile);

  return records.find((record) => {
    const recordCampaign = normalizeText(record.s590fc77ca || "");
    const recordMobile = normalizeMobile(record.sdaf7872a0 || "");

    return recordCampaign === targetCampaign && recordMobile === targetMobile;
  });
}

function validatePayload(payload: SubmitAssignmentPayload) {
  const { campaign, influencer, socialAccounts, assignment } = payload;

  if (!campaign.recordId || !campaign.campaignName) {
    return "يرجى اختيار الحملة";
  }

  if (!influencer.recordId || !influencer.mobile) {
    return "يرجى البحث عن المؤثر واختياره";
  }

  if (!socialAccounts || socialAccounts.length === 0) {
    return "يرجى اختيار منصة واحدة على الأقل";
  }

  if (!assignment.executionType) {
    return "يرجى اختيار نوع التنفيذ";
  }

  if (!assignment.paymentTypes || assignment.paymentTypes.length === 0) {
    return "يرجى اختيار نوع دفع واحد على الأقل";
  }

  if (
    paymentIncludesBankTransfer(assignment.paymentTypes) &&
    !assignment.agreedAmount
  ) {
    return "يرجى إدخال مبلغ التحويل";
  }

  if (paymentIncludesVoucher(assignment.paymentTypes) && !assignment.voucherValue) {
    return "يرجى إدخال قيمة القسيمة";
  }

  if (assignment.executionType === "Home") {
    if (!assignment.orderNumber) {
      return "رقم الطلب مطلوب للإعلان المنزلي";
    }

    if (!assignment.orderInvoiceAmount) {
      return "مبلغ فاتورة الطلب مطلوب للإعلان المنزلي";
    }
  }

  if (assignment.executionType === "In-Branch") {
    if (!assignment.branch) {
      return "الفرع مطلوب للإعلان الحضوري";
    }
  }

  if (paymentIncludesVoucher(assignment.paymentTypes)) {
    if (!assignment.voucherSource) {
      return "يرجى تحديد مصدر القسيمة";
    }

    if (
      assignment.voucherSource === "Branch Voucher" &&
      !assignment.voucherBranch
    ) {
      return "يرجى تحديد فرع صرف القسيمة";
    }
  }

  return "";
}

function buildPayload(
  payload: SubmitAssignmentPayload,
  submissionCode?: string,
  submissionLink?: string
) {
  const { coordinator, campaign, influencer, assignment, socialAccounts } =
    payload;

  const title = `${campaign.campaignName} - ${influencer.mobile}`;

  return {
    title,

    // Campaign linked record
    s01944895f: [campaign.recordId],

    // Campaign Name
    s590fc77ca: campaign.campaignName,

    // Influencer linked record
    s85138512a: [influencer.recordId],

    // Influencer Name
    scc4243592: influencer.fullName,

    // Coordinator Name
    s07467f562: coordinator.name,

    // Influencer Type
    s4ca700cd4: getInfluencerTypeId(influencer.hasMawthooq),

    // Payment Type - multiple
    sf6fbe2681: getPaymentTypeIds(assignment.paymentTypes),

    // Platforms - multiple
    se3b7cd09a: getPlatformIds(socialAccounts),

    // Agreed Amount / Bank Transfer Amount
    seb3ddba13: assignment.agreedAmount,

    // Voucher Value
    se72f3a482: assignment.voucherValue,

    // Order Invoice Amount
    s5ce29698a: assignment.orderInvoiceAmount,

    // Product Sent?
    // Home = Yes because order number confirms order/product process
    // In-Branch = No
    s147931a69: assignment.executionType === "Home" ? "i3Ivq" : "ArZS6",

    // Brief Sent? = No
    s4a83b4d1a: "iDp2F",

    // Mobile search
    sdaf7872a0: influencer.mobile,

    // Last Updated Date
    s153a28310: todayDate(),

    // Record Source = Form
    sac3648c3c: "9rxou",

    ...(submissionCode
      ? {
          // Content Submission Code
          sc0deec50a: submissionCode,

          // Content Submission Link
          sfcf42d598: [submissionLink || buildSubmissionLink(submissionCode)],
        }
      : {}),

    // Campaign Execution Type
    s43d3f4c40: getExecutionTypeId(assignment.executionType),

    // Order Number
    s296f3cf5a: assignment.orderNumber,

    // Order Code
    s7cea72877: assignment.orderCode,

    // Branch for In-Branch coverage
    s45965d1dd:
      assignment.executionType === "In-Branch"
        ? getBranchId(assignment.branch)
        : null,

    // Voucher Source
    s8c13ff8df: paymentIncludesVoucher(assignment.paymentTypes)
      ? getVoucherSourceId(assignment.voucherSource)
      : null,

    // Voucher Branch
    sf118d1731:
      paymentIncludesVoucher(assignment.paymentTypes) &&
      assignment.voucherSource === "Branch Voucher"
        ? getVoucherBranchId(assignment.voucherBranch)
        : null,

    // Collaboration Status = Approved
    status: {
      value: "mkBlA",
    },

    description: {
      data: {
        type: "doc",
        content: [],
      },
      html: `<div class="rendered">
        <strong>Coordinator:</strong> ${coordinator.name || ""}<br>
        <strong>Coordinator Code:</strong> ${coordinator.code || ""}<br>
        <strong>Coordinator Mobile:</strong> ${coordinator.mobile || ""}<br>
        <strong>Execution Type:</strong> ${assignment.executionType || ""}<br>
        <strong>Payment Types:</strong> ${(assignment.paymentTypes || []).join(", ")}<br>
        <strong>Platforms:</strong> ${socialAccounts
          .map((account) => account.platform)
          .join(", ")}<br>
        <strong>Content Submission Code:</strong> ${submissionCode || ""}
      </div>`,
      preview: `Coordinator: ${coordinator.name || ""}`,
    },
  };
}

export async function POST(request: Request) {
  try {
    if (!CAMPAIGN_INFLUENCERS_TABLE_ID) {
      return NextResponse.json(
        { message: "Missing SMARTSUITE_CAMPAIGN_INFLUENCERS_TABLE_ID" },
        { status: 500 }
      );
    }

    const body = (await request.json()) as SubmitAssignmentPayload;

    const validationMessage = validatePayload(body);

    if (validationMessage) {
      return NextResponse.json(
        { message: validationMessage },
        { status: 400 }
      );
    }

    const records = await listRecords(CAMPAIGN_INFLUENCERS_TABLE_ID);

    const existing = findExistingAssignment(
      records,
      body.campaign.campaignName,
      body.influencer.mobile
    );

    const existingCode = existing?.sc0deec50a || "";
    const submissionCode = existingCode || generateSubmissionCode();
    const submissionLink = buildSubmissionLink(submissionCode);

    const payload = buildPayload(body, submissionCode, submissionLink);

    if (existing) {
      const recordId = existing.id || existing.record_id || "";

      if (!recordId) {
        throw new Error("Existing assignment record ID not found");
      }

      await updateRecord(CAMPAIGN_INFLUENCERS_TABLE_ID, recordId, payload);

      return NextResponse.json({
        success: true,
        action: "updated",
        submissionCode,
        submissionLink,
        message: "تم تحديث ربط المؤثر بالحملة بنجاح",
      });
    }

    await createRecord(CAMPAIGN_INFLUENCERS_TABLE_ID, {
      ...payload,

      // Created Date
      s058cfa307: todayDate(),
    });

    return NextResponse.json({
      success: true,
      action: "created",
      submissionCode,
      submissionLink,
      message: "تم ربط المؤثر بالحملة بنجاح",
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "حدث خطأ أثناء حفظ الربط",
      },
      { status: 500 }
    );
  }
}