import { NextResponse } from "next/server";

const SMARTSUITE_API_URL = "https://app.smartsuite.com/api/v1";

const API_KEY = process.env.SMARTSUITE_API_KEY?.trim();
const ACCOUNT_ID = process.env.SMARTSUITE_ACCOUNT_ID?.trim();

const CAMPAIGN_INFLUENCERS_TABLE_ID =
  process.env.SMARTSUITE_CAMPAIGN_INFLUENCERS_TABLE_ID;

const CONTENT_LIBRARY_TABLE_ID =
  process.env.SMARTSUITE_CONTENT_LIBRARY_TABLE_ID;

function normalizeText(value: string) {
  return String(value || "").trim().toLowerCase();
}

function asArray(value: any): any[] {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return [value];
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
      body: { limit: 1000 },
    }
  );

  return result.items || result.results || result.records || [];
}

function getPlatformNames(platformIds: string[]) {
  const platformMap: Record<string, string> = {
    IAagD: "Instagram",
    IC8Tn: "TikTok",
    PLGTZ: "Snapchat",
    "0L87q": "YouTube",
    FVfaD: "X",
    EXvVf: "Facebook",
    D57tW: "Other",
  };

  return (platformIds || []).map((id) => platformMap[id]).filter(Boolean);
}

function getPlatformNameFromContentLibraryId(platformId: string) {
  const platformMap: Record<string, string> = {
    rm2Kv: "Instagram",
    pIVAt: "TikTok",
    O7XK5: "Snapchat",
    cVjpu: "YouTube",
    okw05: "X",
    PcGwd: "Facebook",
    cI7TX: "Other",
  };

  return platformMap[platformId] || "Other";
}

function getContentTypeName(contentTypeId: string) {
  const typeMap: Record<string, string> = {
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

  return typeMap[contentTypeId] || "";
}

function getCanReuseValue(value: string) {
  if (value === "HVgOG") return "Yes";
  if (value === "lQXRl") return "No";
  return "";
}

function getPaymentTypeNames(paymentTypeIds: string[]) {
  const paymentTypeMap: Record<string, string> = {
    Cskhn: "Bank Transfer",
    ObVPO: "Voucher",
    "7nWjo": "Product",
    DyoCW: "Commission",
    FSjcg: "Other",
  };

  return (paymentTypeIds || [])
    .map((id) => paymentTypeMap[id])
    .filter(Boolean);
}

function findAssignmentByCode(records: any[], code: string) {
  const targetCode = normalizeText(code);

  return records.find((record) => {
    const recordCode = normalizeText(record.sc0deec50a || "");
    return recordCode === targetCode;
  });
}

function extractSmartDocLink(value: any) {
  if (!value) return "";

  const preview = String(value.preview || "");
  const html = String(value.html || "");
  const source = preview || html;

  const match = source.match(/https?:\/\/[^\s"<]+/);

  return match ? match[0] : "";
}

function getExistingContentItems(
  contentRecords: any[],
  assignmentRecordId: string
) {
  return contentRecords
    .filter((record) => {
      const linkedAssignments = asArray(record.s6476e8770).map(String);
      return linkedAssignments.includes(String(assignmentRecordId));
    })
    .map((record) => {
      const platformId = asArray(record.s2ef379dbe)[0] || "";
      const contentTypeId = asArray(record.sac21f5178)[0] || "";
      const postLink = asArray(record.s4203b3432)[0] || "";

      return {
        recordId: record.id || record.record_id || "",
        platform: getPlatformNameFromContentLibraryId(String(platformId)),
        postLink: String(postLink || ""),
        promoCode: record.se2f73fc23 || "",
        contentType: getContentTypeName(String(contentTypeId)),
        contentFileLink:
          record.s5364f427e || extractSmartDocLink(record.s382151ff7),
        performanceScreenshotLink: extractSmartDocLink(record.s86487252f),
        canReuseInAds: getCanReuseValue(record.sf0d95cb61 || ""),
        usageRightsNote: record.s33dee34ae || "",
      };
    });
}

export async function GET(request: Request) {
  try {
    if (!CAMPAIGN_INFLUENCERS_TABLE_ID) {
      return NextResponse.json(
        { message: "Missing SMARTSUITE_CAMPAIGN_INFLUENCERS_TABLE_ID" },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code") || "";

    if (!code) {
      return NextResponse.json(
        { message: "رابط المحتوى غير مكتمل" },
        { status: 400 }
      );
    }

    const assignments = await listRecords(CAMPAIGN_INFLUENCERS_TABLE_ID);
    const assignment = findAssignmentByCode(assignments, code);

    if (!assignment) {
      return NextResponse.json(
        { message: "لم يتم العثور على اتفاق بهذا الرابط" },
        { status: 404 }
      );
    }

    const assignmentRecordId = assignment.id || assignment.record_id || "";
    const platforms = getPlatformNames(assignment.se3b7cd09a || []);
    const paymentTypes = getPaymentTypeNames(assignment.sf6fbe2681 || []);

    let existingItems: any[] = [];

    if (CONTENT_LIBRARY_TABLE_ID) {
      try {
        const contentRecords = await listRecords(CONTENT_LIBRARY_TABLE_ID);
        existingItems = getExistingContentItems(
          contentRecords,
          assignmentRecordId
        );
      } catch (contentError) {
        console.error("Failed to load existing content items:", contentError);
        existingItems = [];
      }
    }

    return NextResponse.json({
      success: true,
      assignment: {
        recordId: assignmentRecordId,
        code: assignment.sc0deec50a || "",

        campaignName: assignment.s590fc77ca || "",
        influencerName: assignment.scc4243592 || "",
        influencerMobile: assignment.sdaf7872a0 || "",

        platforms,
        existingItems,

        hiddenAgreement: {
          paymentTypes,
          bankTransferAmount: assignment.seb3ddba13 || "",
          voucherValue: assignment.se72f3a482 || "",
          orderInvoiceAmount: assignment.s5ce29698a || "",
          coordinatorName: assignment.s07467f562 || "",
        },
      },
    });
  } catch (error) {
    console.error("Assignment API Error:", error);

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "حدث خطأ أثناء جلب بيانات الاتفاق",
      },
      { status: 500 }
    );
  }
}