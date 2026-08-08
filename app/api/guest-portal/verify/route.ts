import { NextRequest, NextResponse } from "next/server";
import {
  GUEST_SESSION_COOKIE,
  GUEST_SESSION_DAYS,
  createOpaqueToken,
  findGuestLink,
  guestLinkIsUsable,
  guestSessionCookieOptions,
  hashOpaqueValue,
  hashUserAgent,
  lastFourDigits,
  secureEqual,
} from "@/lib/guest-portal/security";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { token?: string; lastFour?: string };
    const rawToken = String(body.token ?? "").trim();
    const suppliedLastFour = lastFourDigits(String(body.lastFour ?? ""));

    if (suppliedLastFour.length !== 4) {
      return NextResponse.json({ message: "أدخلي آخر 4 أرقام من رقم الجوال." }, { status: 400 });
    }

    const found = await findGuestLink(rawToken);
    if (!found?.link || !guestLinkIsUsable(found.link)) {
      return NextResponse.json(
        { message: "الرابط غير صالح أو انتهت صلاحيته. تواصلي مع منسقة الحملة." },
        { status: 403 },
      );
    }

    const mobile = found.link.campaign_assignments?.influencers?.mobile_e164 ?? "";
    const expectedLastFour = lastFourDigits(mobile);

    if (expectedLastFour.length !== 4 || !secureEqual(suppliedLastFour, expectedLastFour)) {
      const failedAttempts = Number(found.link.failed_attempts ?? 0) + 1;
      const locked = failedAttempts >= Number(found.link.max_attempts ?? 8);
      await found.admin
        .from("submission_links")
        .update({
          failed_attempts: failedAttempts,
          locked_at: locked ? new Date().toISOString() : null,
        })
        .eq("id", found.link.id);

      return NextResponse.json(
        {
          message: locked
            ? "تم إيقاف الرابط بعد محاولات متعددة. تواصلي مع منسقة الحملة لإصدار رابط جديد."
            : "الأرقام المدخلة لا تطابق رقم الجوال المسجل.",
        },
        { status: 403 },
      );
    }

    const rawSession = createOpaqueToken();
    const sessionExpiry = new Date(
      Math.min(
        new Date(found.link.expires_at).getTime(),
        Date.now() + GUEST_SESSION_DAYS * 24 * 60 * 60 * 1000,
      ),
    );

    const { error: sessionError } = await found.admin.from("guest_portal_sessions").insert({
      submission_link_id: found.link.id,
      session_hash: hashOpaqueValue(rawSession),
      expires_at: sessionExpiry.toISOString(),
      user_agent_hash: hashUserAgent(request.headers.get("user-agent")),
    });

    if (sessionError) throw new Error(sessionError.message);

    await found.admin
      .from("submission_links")
      .update({
        failed_attempts: 0,
        locked_at: null,
        used_at: new Date().toISOString(),
        last_opened_at: new Date().toISOString(),
      })
      .eq("id", found.link.id);

    const response = NextResponse.json({
      success: true,
      message: "تم التحقق بنجاح.",
      influencerName: found.link.campaign_assignments?.influencers?.full_name ?? "",
    });
    response.cookies.set(
      GUEST_SESSION_COOKIE,
      rawSession,
      guestSessionCookieOptions(sessionExpiry),
    );
    return response;
  } catch (error) {
    console.error("Guest portal verification failed:", error);
    return NextResponse.json({ message: "تعذر التحقق من الرابط حاليًا." }, { status: 500 });
  }
}
