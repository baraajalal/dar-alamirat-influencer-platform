import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(
    {
      code: "OTP_FLOW_RETIRED",
      message:
        "تم استبدال التفعيل عبر رمز البريد بالتسجيل المباشر من رابط التكليف.",
    },
    { status: 410 },
  );
}
