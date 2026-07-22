import { NextResponse } from "next/server";
import { enforceRegistrationRateLimit } from "@/lib/influencers/rate-limit";
import {
  isSaudiMobile,
  lookupInfluencerRegistration,
  publicLookupResult,
} from "@/lib/influencers/registration";

export const dynamic = "force-dynamic";

function mobileFromBody(body: unknown) {
  if (!body || typeof body !== "object") return "";
  const value = body as Record<string, unknown>;
  return String(value.mobile ?? value.phone ?? "").trim();
}

async function respond(request: Request, mobile: string) {
  if (!mobile || !isSaudiMobile(mobile)) {
    return NextResponse.json(
      { success: false, message: "رقم الجوال السعودي غير صحيح" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    await enforceRegistrationRateLimit({
      request,
      action: "lookup",
      mobile,
      limit: 20,
    });

    const result = await lookupInfluencerRegistration(mobile);

    return NextResponse.json(publicLookupResult(result), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "RATE_LIMITED") {
      return NextResponse.json(
        {
          success: false,
          message: "تم تجاوز عدد محاولات البحث. حاولي مرة أخرى بعد ساعة.",
        },
        { status: 429, headers: { "Cache-Control": "no-store" } },
      );
    }

    console.error("Influencer lookup failed:", error);

    return NextResponse.json(
      {
        success: false,
        message: "تعذر البحث عن البيانات حاليًا. يرجى المحاولة مرة أخرى.",
      },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    return respond(request, mobileFromBody(body));
  } catch {
    return NextResponse.json(
      { success: false, message: "صيغة الطلب غير صحيحة" },
      { status: 400 },
    );
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  return respond(request, url.searchParams.get("mobile")?.trim() ?? "");
}
