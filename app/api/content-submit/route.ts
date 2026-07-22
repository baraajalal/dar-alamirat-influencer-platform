import { NextResponse } from "next/server";

const SMARTSUITE_API_URL = "https://app.smartsuite.com/api/v1";

const API_KEY = process.env.SMARTSUITE_API_KEY?.trim();
const ACCOUNT_ID = process.env.SMARTSUITE_ACCOUNT_ID?.trim();

const CAMPAIGN_INFLUENCERS_TABLE_ID =
  process.env.SMARTSUITE_CAMPAIGN_INFLUENCERS_TABLE_ID;

const CONTENT_LIBRARY_TABLE_ID =
  process.env.SMARTSUITE_CONTENT_LIBRARY_TABLE_ID;

type ContentSubmissionPayload = {
  code: string;
  coordinatorServiceRating: number | "";
  influencerFeedback: string;
  items: Array<{
    platform: string;
    postLink: string;
    promoCode: string;
    contentType: string;
    contentFileLink: string;
    performanceScreenshotLink: string;
    canReuseInAds: "Yes" | "No" | "";
    usageRightsNote: string;
  }>;
};

function normalizeText(value: string) {
  return String(value || "").trim().toLowerCase();
}

function asArray(value: any): any[] {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return [value];
}

function todayDate() {
  const today = new Date().toISOString().split("T")[0];

  return {
    date: `${today}T00:00:00.000000Z`,
    include_time: false,
  };
}

function normalizeUrl(value: string) {
  const text = String(value || "").trim();

  if (!text) return "";

  const withProtocol =
    text.startsWith("http://") || text.startsWith("https://")
      ? text
      : `https://${text}`;

  try {
    const url = new URL(withProtocol);
    return url.href;
  } catch {
    return "";
  }
}

function smartDocFromLink(label: string, link: string) {
  if (!link) {
    return {
      data: {
        type: "doc",
        content: [],
      },
      html: "",
      preview: "",
    };
  }

  return {
    data: {
      type: "doc",
      content: [],
    },
    html: `<div class="rendered"><strong>${label}:</strong> <a href="${link}" target="_blank">${link}</a></div>`,
    preview: `${label}: ${link}`,
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

function findAssignmentByCode(records: any[], code: string) {
  const targetCode = normalizeText(code);

  return records.find((record) => {
    const recordCode = normalizeText(record.sc0deec50a || "");
    return recordCode === targetCode;
  });
}

function getPlatformId(platform: string) {
  const text = normalizeText(platform);

  if (text.includes("instagram")) return "rm2Kv";
  if (text.includes("tiktok")) return "pIVAt";
  if (text.includes("snapchat")) return "O7XK5";
  if (text.includes("youtube")) return "cVjpu";
  if (text === "x" || text.includes("twitter")) return "okw05";
  if (text.includes("facebook")) return "PcGwd";

  return "cI7TX";
}

function getContentTypeId(contentType: string) {
  const text = normalizeText(contentType);

  if (text.includes("reel")) return "aDwiB";
  if (text.includes("story")) return "TnQ7W";
  if (text.includes("post")) return "f8pcO";
  if (text.includes("snap")) return "qMbzF";
  if (text.includes("tiktok")) return "FDKXO";
  if (text.includes("youtube")) return "BECXx";
  if (text.includes("live")) return "U2TvZ";
  if (text.includes("photo")) return "YCdyY";
  if (text.includes("video")) return "p6uac";

  return "gsSYT";
}

function getCanReuseId(value: string) {
  if (value === "Yes") return "HVgOG";
  if (value === "No") return "lQXRl";
  return null;
}

function validatePayload(payload: ContentSubmissionPayload) {
  if (!payload.code) {
    return "رابط المحتوى غير مكتمل";
  }

  if (!payload.items || payload.items.length === 0) {
    return "لا توجد منصات لإرسال المحتوى";
  }

  for (const item of payload.items) {
    if (!item.platform) {
      return "اسم المنصة مفقود";
    }

    const normalizedPostLink = normalizeUrl(item.postLink);

    if (!normalizedPostLink) {
      return `رابط النشر غير صحيح أو مفقود لمنصة ${item.platform}`;
    }

    if (item.contentFileLink && !normalizeUrl(item.contentFileLink)) {
      return `رابط المادة الإعلانية غير صحيح لمنصة ${item.platform}`;
    }

    if (
      item.performanceScreenshotLink &&
      !normalizeUrl(item.performanceScreenshotLink)
    ) {
      return `رابط سكرين الأداء أو الترويج غير صحيح لمنصة ${item.platform}`;
    }

    if (!item.contentType) {
      return `نوع المحتوى مطلوب لمنصة ${item.platform}`;
    }

    if (!item.canReuseInAds) {
      return `يرجى تحديد خيار استخدام المحتوى لمنصة ${item.platform}`;
    }
  }

  if (
    payload.coordinatorServiceRating !== "" &&
    (Number(payload.coordinatorServiceRating) < 1 ||
      Number(payload.coordinatorServiceRating) > 5)
  ) {
    return "تقييم تجربة المنسق يجب أن يكون من 1 إلى 5";
  }

  return "";
}

function findExistingContentRecord(
  records: any[],
  assignmentRecordId: string,
  platform: string
) {
  const platformId = getPlatformId(platform);

  return records.find((record) => {
    const linkedAssignmentIds = asArray(record.s6476e8770);
    const platformIds = asArray(record.s2ef379dbe);

    const sameAssignment = linkedAssignmentIds.includes(assignmentRecordId);
    const samePlatform = platformIds.includes(platformId);

    return sameAssignment && samePlatform;
  });
}

function buildContentRecordPayload(
  assignment: any,
  item: ContentSubmissionPayload["items"][number],
  payload: ContentSubmissionPayload
) {
  const assignmentRecordId = assignment.id || assignment.record_id || "";
  const postLink = normalizeUrl(item.postLink);
  const contentFileLink = normalizeUrl(item.contentFileLink);
  const performanceScreenshotLink = normalizeUrl(
    item.performanceScreenshotLink
  );

  const recordTitle = `${assignment.s590fc77ca || "Campaign"} - ${
    assignment.scc4243592 || "Influencer"
  } - ${item.platform} - Content`;

  return {
    // Content ID / Title
    title: recordTitle,

    // Campaign Influencer
    s6476e8770: [assignmentRecordId],

    // Campaign ID
    s9a088e938: asArray(assignment.s01944895f)[0] || "",

    // Campaign Name
    sf6e066e15: assignment.s590fc77ca || "",

    // Influencer ID
    s43b94b221: asArray(assignment.s85138512a)[0] || "",

    // Influencer Name
    s65c64900d: assignment.scc4243592 || "",

    // Influencer Mobile
    sa3c04ed16: assignment.sdaf7872a0 || "",

    // Platform
    s2ef379dbe: [getPlatformId(item.platform)],

    // Content Type
    sac21f5178: [getContentTypeId(item.contentType)],

    // Content Status = Received
    s9727fc2c7: ["5tJhS"],

    // Content File / Attachment
    s382151ff7: smartDocFromLink("Content File Link", contentFileLink),

    // Content Link
    s5364f427e: contentFileLink,

    // Post Link
    s4203b3432: [postLink],

    // Promo Code
    se2f73fc23: item.promoCode || "",

    // Usage Rights Note
    s33dee34ae: item.usageRightsNote || "",

    // Can Reuse in Ads?
    sf0d95cb61: getCanReuseId(item.canReuseInAds),

    // Date
    s981a45b97: todayDate(),

    // Performance Screenshot
    s86487252f: smartDocFromLink(
      "Performance Screenshot Link",
      performanceScreenshotLink
    ),

    // Last Updated Date
    s68059f011: todayDate(),

    // Approval Status = Pending
    s8adf35d78: ["18326"],

    // Coordinator Service Rating
    s39bb53712:
      payload.coordinatorServiceRating === ""
        ? null
        : Number(payload.coordinatorServiceRating),

    // Influencer Feedback
    description: payload.influencerFeedback || "",

    // Is Suitable for Ads
    s12cf00ef2: null,

    // Ready for Payment? = NO
    sc2f8312a6: "p2BHC",
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

    if (!CONTENT_LIBRARY_TABLE_ID) {
      return NextResponse.json(
        { message: "Missing SMARTSUITE_CONTENT_LIBRARY_TABLE_ID" },
        { status: 500 }
      );
    }

    const body = (await request.json()) as ContentSubmissionPayload;

    const validationMessage = validatePayload(body);

    if (validationMessage) {
      return NextResponse.json(
        { message: validationMessage },
        { status: 400 }
      );
    }

    const assignments = await listRecords(CAMPAIGN_INFLUENCERS_TABLE_ID);
    const assignment = findAssignmentByCode(assignments, body.code);

    if (!assignment) {
      return NextResponse.json(
        { message: "لم يتم العثور على اتفاق بهذا الرابط" },
        { status: 404 }
      );
    }

    const assignmentRecordId = assignment.id || assignment.record_id || "";

    if (!assignmentRecordId) {
      throw new Error("Assignment record ID not found");
    }

    const existingContentRecords = await listRecords(CONTENT_LIBRARY_TABLE_ID);

    let createdCount = 0;
    let updatedCount = 0;

    for (const item of body.items) {
      const recordPayload = buildContentRecordPayload(assignment, item, body);

      const existingContent = findExistingContentRecord(
        existingContentRecords,
        assignmentRecordId,
        item.platform
      );

      if (existingContent) {
        const contentRecordId = existingContent.id || existingContent.record_id;

        if (!contentRecordId) {
          throw new Error("Existing content record ID not found");
        }

        await updateRecord(
          CONTENT_LIBRARY_TABLE_ID,
          contentRecordId,
          recordPayload
        );

        updatedCount += 1;
      } else {
        await createRecord(CONTENT_LIBRARY_TABLE_ID, {
          ...recordPayload,

          // Created Date
          s8d0592f7a: todayDate(),
        });

        createdCount += 1;
      }
    }

    // Update Campaign Influencer after receiving content
 // Update Campaign Influencer after receiving content
await updateRecord(CAMPAIGN_INFLUENCERS_TABLE_ID, assignmentRecordId, {
  // Collaboration Status = Published
  status: {
    value: "NQAqe",
  },

  // Payment Approval Status = Pending
  // إذا الحقل List في SmartSuite يحتاج Array
  sc42ee4059: ["usCF2"],

  // Last Updated Date
  s153a28310: todayDate(),
});

    return NextResponse.json({
      success: true,
      createdCount,
      updatedCount,
      message:
        "تم استلام المحتوى بنجاح. تستغرق عملية مراجعة المحتوى وتقييم أداء الإعلان من 5 إلى 7 أيام. سعدنا بمشاركتكم معنا للوصول إلى أكبر عدد من المستفيدين من الحملة.",
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "حدث خطأ أثناء إرسال بيانات المحتوى",
      },
      { status: 500 }
    );
  }
}