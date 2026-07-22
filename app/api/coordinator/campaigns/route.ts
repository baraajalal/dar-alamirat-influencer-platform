import { NextResponse } from "next/server";

const SMARTSUITE_API_URL = "https://app.smartsuite.com/api/v1";

const API_KEY = process.env.SMARTSUITE_API_KEY?.trim();
const ACCOUNT_ID = process.env.SMARTSUITE_ACCOUNT_ID?.trim();
const CAMPAIGNS_TABLE_ID = process.env.SMARTSUITE_CAMPAIGNS_TABLE_ID;

async function listRecords(tableId: string) {
  if (!API_KEY) throw new Error("Missing SMARTSUITE_API_KEY");
  if (!ACCOUNT_ID) throw new Error("Missing SMARTSUITE_ACCOUNT_ID");

  const response = await fetch(
    `${SMARTSUITE_API_URL}/applications/${tableId}/records/list/`,
    {
      method: "POST",
      headers: {
        Authorization: `Token ${API_KEY}`,
        "ACCOUNT-ID": ACCOUNT_ID,
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify({ limit: 1000 }),
    }
  );

  const text = await response.text();

  let result: any;

  try {
    result = text ? JSON.parse(text) : {};
  } catch {
    throw new Error("SmartSuite returned non-JSON response");
  }

  if (!response.ok) {
    console.error("SmartSuite API Error:", JSON.stringify(result, null, 2));
    throw new Error("Failed to get campaigns");
  }

  return result.items || result.results || result.records || [];
}

export async function GET() {
  try {
    if (!CAMPAIGNS_TABLE_ID) {
      return NextResponse.json(
        { message: "Missing SMARTSUITE_CAMPAIGNS_TABLE_ID" },
        { status: 500 }
      );
    }

    const records = await listRecords(CAMPAIGNS_TABLE_ID);

    const campaigns = records
      .map((record: any) => ({
        recordId: record.id || record.record_id || "",
        campaignName: record.s53c807f15 || record.title || "",
        brand: record.s3fa372904 || "",
        product: record.s3869eb683 || "",
        status: record.status?.value || record.status || "",
      }))
      .filter((campaign: any) => campaign.campaignName);

    return NextResponse.json({
      campaigns,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "حدث خطأ أثناء جلب الحملات",
      },
      { status: 500 }
    );
  }
}