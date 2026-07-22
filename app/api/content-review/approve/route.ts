import { NextResponse } from "next/server";

const SMARTSUITE_API_URL = "https://app.smartsuite.com/api/v1";

const API_KEY = process.env.SMARTSUITE_API_KEY?.trim();
const ACCOUNT_ID = process.env.SMARTSUITE_ACCOUNT_ID?.trim();

const CONTENT_LIBRARY_TABLE_ID =
  process.env.SMARTSUITE_CONTENT_LIBRARY_TABLE_ID;

const CAMPAIGN_INFLUENCERS_TABLE_ID =
  process.env.SMARTSUITE_CAMPAIGN_INFLUENCERS_TABLE_ID;

const PAYMENTS_TABLE_ID = process.env.SMARTSUITE_PAYMENTS_TABLE_ID;

const INFLUENCERS_TABLE_ID = process.env.SMARTSUITE_INFLUENCERS_TABLE_ID;

type ReviewDecision = "approve" | "needs_changes" | "reject";

type ReviewPayload = {
  contentRecordId: string;
  reviewDecision?: ReviewDecision;
  isSuitableForAds?: "Yes" | "No";
  supervisorNotes?: string;
};

function asArray(value: any): any[] {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return [value];
}

function normalizeMobile(value: string) {
  return String(value || "")
    .replace(/\s/g, "")
    .replace(/\+/g, "")
    .replace(/-/g, "")
    .trim();
}

function todayDate() {
  const today = new Date().toISOString().split("T")[0];

  return {
    date: `${today}T00:00:00.000000Z`,
    include_time: false,
  };
}

function getSuitableForAdsId(value?: "Yes" | "No") {
  if (value === "Yes") return "pwZQV";
  if (value === "No") return "aH6nt";
  return "aH6nt";
}

function getPostLink(contentRecord: any) {
  const links = asArray(contentRecord.s4203b3432);
  return links[0] || "";
}

function getPaymentTypeNames(paymentTypeIds: any[]) {
  const names: string[] = [];
  const ids = paymentTypeIds.map(String);

  if (ids.includes("Cskhn")) names.push("Bank Transfer");
  if (ids.includes("ObVPO")) names.push("Voucher");
  if (ids.includes("7nWjo")) names.push("Product");
  if (ids.includes("DyoCW")) names.push("Commission");
  if (ids.includes("FSjcg")) names.push("Other");

  return names;
}

function shouldCreatePayment(paymentTypeIds: any[]) {
  const ids = paymentTypeIds.map(String);
  return ids.includes("Cskhn") || ids.includes("ObVPO");
}

function isProductOnly(paymentTypeIds: any[]) {
  const ids = paymentTypeIds.map(String);
  return ids.length > 0 && ids.every((id) => id === "7nWjo");
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

function findRecordById(records: any[], recordId: string) {
  return records.find((record) => {
    const id = record.id || record.record_id || "";
    return String(id) === String(recordId);
  });
}

function findInfluencerRecord(
  influencerRecords: any[],
  influencerId: string,
  influencerMobile: string
) {
  const targetInfluencerId = String(influencerId || "");
  const targetMobile = normalizeMobile(influencerMobile);

  const byId = influencerRecords.find((record) => {
    const id = String(record.id || record.record_id || "");
    return id === targetInfluencerId;
  });

  if (byId) return byId;

  return influencerRecords.find((record) => {
    const recordMobile = normalizeMobile(record.se22f3e19b || "");
    return recordMobile === targetMobile;
  });
}

function findExistingPaymentByCampaignInfluencer(
  paymentRecords: any[],
  campaignInfluencerId: string
) {
  return paymentRecords.find((record) => {
    const linkedCampaignInfluencers = asArray(record.s55faf09aa).map(String);
    return linkedCampaignInfluencers.includes(String(campaignInfluencerId));
  });
}

function buildPaymentPayload({
  campaignInfluencerId,
  campaignInfluencer,
  influencerRecord,
  contentRecord,
  contentRecordId,
}: {
  campaignInfluencerId: string;
  campaignInfluencer: any;
  influencerRecord: any;
  contentRecord: any;
  contentRecordId: string;
}) {
  const campaignName = campaignInfluencer.s590fc77ca || "";
  const influencerName = campaignInfluencer.scc4243592 || "";
  const influencerMobile = campaignInfluencer.sdaf7872a0 || "";

  const paymentTypeIds = asArray(campaignInfluencer.sf6fbe2681);
  const paymentTypeNames = getPaymentTypeNames(paymentTypeIds);

  const postLink = getPostLink(contentRecord);

  return {
    title: `${campaignName} - ${influencerMobile} - Payment`,

    // Campaign Influencer
    s55faf09aa: [campaignInfluencerId],

    // Campaign Name
    sa1654cad3: campaignName,

    // Influencer Name
    s687ecf684: influencerName,

    // INF_Mobaile
    sdd0d4ce20: influencerMobile,

    // Influencer Type
    s3e3506c2b: asArray(campaignInfluencer.s4ca700cd4).join(", "),

    // Payment Type
    sb6b0099cb: paymentTypeNames.join(", "),

    // Agreed Amount
    s21c247bb2: campaignInfluencer.seb3ddba13 || "",

    // Voucher Value
    s81aa1999e: campaignInfluencer.se72f3a482 || "",

    // Product / Order Invoice Value
    s6091f3df9: campaignInfluencer.s5ce29698a || "",

    // Bank Name
    s4a71c5551: influencerRecord?.s510a1c6cb || "",

    // IBAN
    s410fa372a: influencerRecord?.s067f7fb0b || "",

    // Account Holder Name
    s07d531627: influencerRecord?.s36be478d5 || "",

    // National ID
    sa51914e57: influencerRecord?.sdf5e7d6fa || "",

    // Post Link
    s8a401e43b: postLink,

    // Payment Status = Ready for Finance
    sc5f22146c: "Iv4Iq",

    // Influencer linked record
    s6c51cc843: asArray(campaignInfluencer.s85138512a),

    // Content Item
    s3bc2b1f1b: [contentRecordId],

    // Record Source = Automation
    sc93f1010d: "rlTY1",

    // Finance Batch Number intentionally empty
    seee344772: "",
  };
}

async function handleNeedsChanges({
  contentRecordId,
  linkedCampaignInfluencerIds,
  supervisorNotes,
}: {
  contentRecordId: string;
  linkedCampaignInfluencerIds: any[];
  supervisorNotes: string;
}) {
  await updateRecord(CONTENT_LIBRARY_TABLE_ID!, contentRecordId, {
    // Approval Status = Needs Changes
    s8adf35d78: ["F6Z83"],

    // Content Status = Needs Edits
    s9727fc2c7: "XoSz4",

    // Ready for Payment? = NO
    sc2f8312a6: "p2BHC",

    // Is Suitable for Ads = No
    s12cf00ef2: "aH6nt",

    // Supervisor Review Notes
    sd79e91588: supervisorNotes,

    // Last Updated Date
    s68059f011: todayDate(),
  });

  for (const campaignInfluencerIdValue of linkedCampaignInfluencerIds) {
    const campaignInfluencerId = String(campaignInfluencerIdValue);

    await updateRecord(
      CAMPAIGN_INFLUENCERS_TABLE_ID!,
      campaignInfluencerId,
      {
        // Keep Collaboration Status = Published
        status: {
          value: "NQAqe",
        },

        // Payment Approval Status = Need Review
        sc42ee4059: ["Vvp4i"],

        // Payment Record Created = No
        s5549fe7d8: "sfiex",

        // Last Updated Date
        s153a28310: todayDate(),
      }
    );
  }
}

async function handleReject({
  contentRecordId,
  linkedCampaignInfluencerIds,
  supervisorNotes,
}: {
  contentRecordId: string;
  linkedCampaignInfluencerIds: any[];
  supervisorNotes: string;
}) {
  await updateRecord(CONTENT_LIBRARY_TABLE_ID!, contentRecordId, {
    // Approval Status = Rejected
    s8adf35d78: ["tgq9n"],

    // Ready for Payment? = NO
    sc2f8312a6: "p2BHC",

    // Is Suitable for Ads = No
    s12cf00ef2: "aH6nt",

    // Supervisor Review Notes
    sd79e91588: supervisorNotes,

    // Last Updated Date
    s68059f011: todayDate(),
  });

  for (const campaignInfluencerIdValue of linkedCampaignInfluencerIds) {
    const campaignInfluencerId = String(campaignInfluencerIdValue);

    await updateRecord(
      CAMPAIGN_INFLUENCERS_TABLE_ID!,
      campaignInfluencerId,
      {
        // Collaboration Status = Rejected
        status: {
          value: "MDC3A",
        },

        // Payment Approval Status = Rejected
        sc42ee4059: ["Sjw17"],

        // Payment Record Created = No
        s5549fe7d8: "sfiex",

        // Last Updated Date
        s153a28310: todayDate(),
      }
    );
  }
}

async function handleApprove({
  contentRecordId,
  contentRecord,
  linkedCampaignInfluencerIds,
  campaignInfluencerRecords,
  influencerRecords,
  supervisorNotes,
  isSuitableForAds,
}: {
  contentRecordId: string;
  contentRecord: any;
  linkedCampaignInfluencerIds: any[];
  campaignInfluencerRecords: any[];
  influencerRecords: any[];
  supervisorNotes: string;
  isSuitableForAds: "Yes" | "No";
}) {
  await updateRecord(CONTENT_LIBRARY_TABLE_ID!, contentRecordId, {
    // Approval Status = Approved
    s8adf35d78: ["bPaKV"],

    // Ready for Payment? = YES
    sc2f8312a6: "6CaYy",

    // Is Suitable for Ads
    s12cf00ef2: getSuitableForAdsId(isSuitableForAds),

    // Supervisor Review Notes
    sd79e91588: supervisorNotes,

    // Last Updated Date
    s68059f011: todayDate(),
  });

  const paymentRecords = await listRecords(PAYMENTS_TABLE_ID!);

  let createdPayments = 0;
  let updatedPayments = 0;
  let productOnlyClosed = 0;

  for (const campaignInfluencerIdValue of linkedCampaignInfluencerIds) {
    const campaignInfluencerId = String(campaignInfluencerIdValue);

    const campaignInfluencer = findRecordById(
      campaignInfluencerRecords,
      campaignInfluencerId
    );

    if (!campaignInfluencer) continue;

    const paymentTypeIds = asArray(campaignInfluencer.sf6fbe2681);

    const influencerId = String(
      asArray(campaignInfluencer.s85138512a)[0] || ""
    );
    const influencerMobile = campaignInfluencer.sdaf7872a0 || "";

    const influencerRecord = findInfluencerRecord(
      influencerRecords,
      influencerId,
      influencerMobile
    );

    if (isProductOnly(paymentTypeIds)) {
      await updateRecord(
        CAMPAIGN_INFLUENCERS_TABLE_ID!,
        campaignInfluencerId,
        {
          // Collaboration Status = Closed
          status: {
            value: "4UcYP",
          },

          // Payment Approval Status = Approved
          sc42ee4059: ["AU65Z"],

          // Payment Record Created = Yes
          s5549fe7d8: "G13Zt",

          // Last Updated Date
          s153a28310: todayDate(),
        }
      );

      productOnlyClosed += 1;
      continue;
    }

    if (!shouldCreatePayment(paymentTypeIds)) {
      await updateRecord(
        CAMPAIGN_INFLUENCERS_TABLE_ID!,
        campaignInfluencerId,
        {
          // Collaboration Status = Payment Pending
          status: {
            value: "2wwDC",
          },

          // Payment Approval Status = Approved
          sc42ee4059: ["AU65Z"],

          // Last Updated Date
          s153a28310: todayDate(),
        }
      );

      continue;
    }

    const paymentPayload = buildPaymentPayload({
      campaignInfluencerId,
      campaignInfluencer,
      influencerRecord,
      contentRecord,
      contentRecordId,
    });

    const existingPayment = findExistingPaymentByCampaignInfluencer(
      paymentRecords,
      campaignInfluencerId
    );

    let paymentRecordId = "";

    if (existingPayment) {
      paymentRecordId = existingPayment.id || existingPayment.record_id || "";

      if (!paymentRecordId) {
        throw new Error("Existing payment record ID not found");
      }

      await updateRecord(PAYMENTS_TABLE_ID!, paymentRecordId, paymentPayload);
      updatedPayments += 1;
    } else {
      const createdPayment = await createRecord(
        PAYMENTS_TABLE_ID!,
        paymentPayload
      );

      paymentRecordId =
        createdPayment.id ||
        createdPayment.record_id ||
        createdPayment.record?.id ||
        "";

      createdPayments += 1;
    }

    await updateRecord(
      CAMPAIGN_INFLUENCERS_TABLE_ID!,
      campaignInfluencerId,
      {
        // Collaboration Status = Payment Pending
        status: {
          value: "2wwDC",
        },

        // Payment Approval Status = Approved
        sc42ee4059: ["AU65Z"],

        // Payment Record Created = Yes
        s5549fe7d8: "G13Zt",

        // Link to Payments
        ...(paymentRecordId ? { spf6hbef: [paymentRecordId] } : {}),

        // Last Updated Date
        s153a28310: todayDate(),
      }
    );
  }

  return {
    createdPayments,
    updatedPayments,
    productOnlyClosed,
  };
}

export async function POST(request: Request) {
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

    if (!PAYMENTS_TABLE_ID) {
      return NextResponse.json(
        { message: "Missing SMARTSUITE_PAYMENTS_TABLE_ID" },
        { status: 500 }
      );
    }

    if (!INFLUENCERS_TABLE_ID) {
      return NextResponse.json(
        { message: "Missing SMARTSUITE_INFLUENCERS_TABLE_ID" },
        { status: 500 }
      );
    }

    const body = (await request.json()) as ReviewPayload;

    if (!body.contentRecordId) {
      return NextResponse.json(
        { message: "Content Record ID مطلوب" },
        { status: 400 }
      );
    }

    const reviewDecision: ReviewDecision = body.reviewDecision || "approve";
    const supervisorNotes = body.supervisorNotes || "";
    const isSuitableForAds: "Yes" | "No" = body.isSuitableForAds || "No";

    const [contentRecords, campaignInfluencerRecords, influencerRecords] =
      await Promise.all([
        listRecords(CONTENT_LIBRARY_TABLE_ID),
        listRecords(CAMPAIGN_INFLUENCERS_TABLE_ID),
        listRecords(INFLUENCERS_TABLE_ID),
      ]);

    const contentRecord = findRecordById(contentRecords, body.contentRecordId);

    if (!contentRecord) {
      return NextResponse.json(
        { message: "لم يتم العثور على سجل المحتوى" },
        { status: 404 }
      );
    }

    const linkedCampaignInfluencerIds = asArray(contentRecord.s6476e8770);

    if (linkedCampaignInfluencerIds.length === 0) {
      return NextResponse.json(
        {
          message:
            "سجل المحتوى غير مربوط بسجل Campaign Influencer، لا يمكن إكمال المراجعة",
        },
        { status: 400 }
      );
    }

    if (reviewDecision === "needs_changes") {
      await handleNeedsChanges({
        contentRecordId: body.contentRecordId,
        linkedCampaignInfluencerIds,
        supervisorNotes,
      });

      return NextResponse.json({
        success: true,
        reviewDecision,
        message: "تم حفظ القرار: المحتوى يحتاج تعديل، ولم يتم تجهيزه للدفع.",
      });
    }

    if (reviewDecision === "reject") {
      await handleReject({
        contentRecordId: body.contentRecordId,
        linkedCampaignInfluencerIds,
        supervisorNotes,
      });

      return NextResponse.json({
        success: true,
        reviewDecision,
        message: "تم رفض المحتوى، ولم يتم تجهيزه للدفع.",
      });
    }

    const paymentResult = await handleApprove({
      contentRecordId: body.contentRecordId,
      contentRecord,
      linkedCampaignInfluencerIds,
      campaignInfluencerRecords,
      influencerRecords,
      supervisorNotes,
      isSuitableForAds,
    });

    return NextResponse.json({
      success: true,
      reviewDecision,
      ...paymentResult,
      message:
        "تم اعتماد المحتوى وتجهيز الدفع حسب نوع المقابل. رقم مجموعة الدفع يضاف يدويًا من المالية.",
    });
  } catch (error) {
    console.error("Content Review API Error:", error);

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "حدث خطأ أثناء مراجعة المحتوى",
      },
      { status: 500 }
    );
  }
}