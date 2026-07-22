import { NextResponse } from "next/server";

const SMARTSUITE_API_URL = "https://app.smartsuite.com/api/v1";

const API_KEY = process.env.SMARTSUITE_API_KEY?.trim();
const ACCOUNT_ID = process.env.SMARTSUITE_ACCOUNT_ID?.trim();

const PAYMENTS_TABLE_ID = process.env.SMARTSUITE_PAYMENTS_TABLE_ID;
const CAMPAIGN_INFLUENCERS_TABLE_ID =
  process.env.SMARTSUITE_CAMPAIGN_INFLUENCERS_TABLE_ID;

const PAYMENT_STATUS_PAID = "cQLKE";

const CAMPAIGN_STATUS_CLOSED = "4UcYP";
const PAYMENT_APPROVAL_APPROVED = "AU65Z";
const PAYMENT_RECORD_CREATED_YES = "G13Zt";

function asArray(value: any): any[] {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return [value];
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
      body: {
        limit: 1000,
      },
    }
  );

  return result.items || result.results || result.records || [];
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

function getRecordId(record: any) {
  return String(record?.id || record?.record_id || "");
}

export async function POST() {
  try {
    if (!PAYMENTS_TABLE_ID) {
      return NextResponse.json(
        { message: "Missing SMARTSUITE_PAYMENTS_TABLE_ID" },
        { status: 500 }
      );
    }

    if (!CAMPAIGN_INFLUENCERS_TABLE_ID) {
      return NextResponse.json(
        { message: "Missing SMARTSUITE_CAMPAIGN_INFLUENCERS_TABLE_ID" },
        { status: 500 }
      );
    }

    const paymentRecords = await listRecords(PAYMENTS_TABLE_ID);

const paidPayments = paymentRecords.filter((payment: any) => {
  const paymentStatus = getSingleSelectValue(payment.sc5f22146c);
  return paymentStatus === PAYMENT_STATUS_PAID;
});

    let closedCount = 0;
    const skipped: any[] = [];

    for (const payment of paidPayments) {
      const paymentId = getRecordId(payment);
      const linkedCampaignInfluencerIds = asArray(payment.s55faf09aa).map(
        String
      );

      if (linkedCampaignInfluencerIds.length === 0) {
        skipped.push({
          paymentId,
          reason: "Payment is not linked to Campaign Influencer",
        });
        continue;
      }

      for (const campaignInfluencerId of linkedCampaignInfluencerIds) {
        await updateRecord(
          CAMPAIGN_INFLUENCERS_TABLE_ID,
          campaignInfluencerId,
          {
            // Collaboration Status = Closed
            status: {
              value: CAMPAIGN_STATUS_CLOSED,
            },

            // Payment Approval Status = Approved
            sc42ee4059: [PAYMENT_APPROVAL_APPROVED],

            // Payment Record Created = Yes
            s5549fe7d8: PAYMENT_RECORD_CREATED_YES,

            // Last Updated Date
            s153a28310: todayDate(),
          }
        );

        closedCount += 1;
      }
    }

    return NextResponse.json({
      success: true,
      message: `تمت مزامنة المدفوعات المدفوعة وإغلاق ${closedCount} تعاون.`,
      paidPaymentsCount: paidPayments.length,
      closedCount,
      skipped,
    });
  } catch (error) {
    console.error("Sync Paid Payments API Error:", error);

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "حدث خطأ أثناء مزامنة المدفوعات",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return POST();
}