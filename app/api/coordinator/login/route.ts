import { NextResponse } from "next/server";

const SMARTSUITE_API_URL = "https://app.smartsuite.com/api/v1";

const API_KEY = process.env.SMARTSUITE_API_KEY?.trim();
const ACCOUNT_ID = process.env.SMARTSUITE_ACCOUNT_ID?.trim();
const COORDINATORS_TABLE_ID = process.env.SMARTSUITE_COORDINATORS_TABLE_ID;

function normalize(value: string) {
  return String(value || "")
    .replace(/\s/g, "")
    .replace(/\+/g, "")
    .replace(/-/g, "")
    .trim()
    .toLowerCase();
}

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
      body: JSON.stringify({
        limit: 1000,
      }),
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
    throw new Error("Failed to get coordinators");
  }

  return result.items || result.results || result.records || [];
}

export async function POST(request: Request) {
  try {
    if (!COORDINATORS_TABLE_ID) {
      return NextResponse.json(
        { message: "Missing SMARTSUITE_COORDINATORS_TABLE_ID" },
        { status: 500 }
      );
    }

    const body = await request.json();

    const identifier = normalize(body.identifier);
    const pin = String(body.pin || "").trim();

    if (!identifier || !pin) {
      return NextResponse.json(
        { message: "يرجى إدخال كود المنسق أو رقم الجوال والرمز السري" },
        { status: 400 }
      );
    }

    const coordinators = await listRecords(COORDINATORS_TABLE_ID);

    const coordinator = coordinators.find((record: any) => {
      const code = normalize(record.s8ce65db9f || "");
      const mobile = normalize(record.saddef6510 || "");
      const recordPin = String(record.s416359191 || "").trim();

      return (code === identifier || mobile === identifier) && recordPin === pin;
    });

    if (!coordinator) {
      return NextResponse.json(
        { message: "بيانات الدخول غير صحيحة" },
        { status: 401 }
      );
    }

    const statusValue = coordinator.status?.value || coordinator.status;

    if (statusValue !== "complete") {
      return NextResponse.json(
        { message: "حساب المنسق غير نشط، يرجى التواصل مع الإدارة" },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      coordinator: {
        recordId: coordinator.id || coordinator.record_id || "",
        name: coordinator.s197781adb || "",
        code: coordinator.s8ce65db9f || "",
        mobile: coordinator.saddef6510 || "",
        status: "Active",
      },
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "حدث خطأ أثناء تسجيل الدخول",
      },
      { status: 500 }
    );
  }
}