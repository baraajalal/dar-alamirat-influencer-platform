import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { enforceRegistrationRateLimit } from "@/lib/influencers/rate-limit";
import {
  isSaudiMobile,
  lookupInfluencerRegistration,
  normalizeMobile,
} from "@/lib/influencers/registration";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  mobile: z.string().trim().min(9).max(30),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("صيغة البريد الإلكتروني غير صحيحة"),
  website: z.string().max(0).optional().default(""),
});

export async function POST(request: Request) {
  try {
    const parsed = requestSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message:
            parsed.error.issues[0]?.message ?? "بيانات طلب التفعيل غير صحيحة",
        },
        { status: 400 },
      );
    }

    const { mobile, email, website } = parsed.data;

    if (website) {
      return NextResponse.json({ success: true });
    }

    if (!isSaudiMobile(mobile)) {
      return NextResponse.json(
        { success: false, message: "رقم الجوال السعودي غير صحيح" },
        { status: 400 },
      );
    }

    const normalizedMobile = normalizeMobile(mobile);

    await enforceRegistrationRateLimit({
      request,
      action: "portal-access-request",
      mobile: normalizedMobile,
      limit: 5,
    });

    const lookup = await lookupInfluencerRegistration(normalizedMobile);

    if (lookup.matchSource === "multiple") {
      return NextResponse.json(
        {
          success: false,
          code: "MULTIPLE_MATCHES",
          message:
            "وجدنا أكثر من ملف مرتبط بهذا الرقم. يرجى التواصل مع الإدارة قبل طلب التفعيل.",
        },
        { status: 409 },
      );
    }

    if (!lookup.exists || !lookup.internal.existingInfluencerId) {
      return NextResponse.json(
        {
          success: false,
          code: "PROFILE_REQUIRED",
          message:
            "يجب حفظ ملف المؤثر أولًا قبل طلب تفعيل بوابة المستخدم.",
        },
        { status: 404 },
      );
    }

    if (lookup.hasAccount) {
      return NextResponse.json(
        {
          success: false,
          code: "ACCOUNT_EXISTS",
          message: "لديك حساب مفعل بالفعل. استخدمي صفحة تسجيل الدخول.",
          redirectTo: "/login",
        },
        { status: 409 },
      );
    }

    const influencerId = lookup.internal.existingInfluencerId;
    const admin = createAdminClient();

    const { data: assignments, error: assignmentsError } = await admin
      .from("campaign_assignments")
      .select("id,status")
      .eq("influencer_id", influencerId);

    if (assignmentsError) throw assignmentsError;

    const assignmentIds = (assignments ?? []).map((item) => item.id);
    let hasFinancialRequirement = (assignments ?? []).some((item) =>
      ["payment_pending", "paid"].includes(item.status),
    );

    if (assignmentIds.length > 0) {
      const { data: payments, error: paymentsError } = await admin
        .from("payments")
        .select("id,status")
        .in("assignment_id", assignmentIds)
        .not("status", "in", "(draft,cancelled)")
        .limit(1);

      if (paymentsError) throw paymentsError;
      hasFinancialRequirement =
        hasFinancialRequirement || (payments?.length ?? 0) > 0;
    }

    const { data: existingRequest, error: existingRequestError } = await admin
      .from("portal_access_requests")
      .select("id,status")
      .eq("influencer_id", influencerId)
      .in("status", ["pending", "approved", "needs_changes"])
      .maybeSingle();

    if (existingRequestError) throw existingRequestError;

    const now = new Date().toISOString();
    const reason = hasFinancialRequirement
      ? "payment_required"
      : "self_service";
    const priority = hasFinancialRequirement ? "high" : "normal";

    if (existingRequest) {
      const { error: updateError } = await admin
        .from("portal_access_requests")
        .update({
          requested_email: email,
          normalized_mobile: normalizedMobile,
          request_reason: reason,
          priority,
          status: "pending",
          submitted_at: now,
          updated_at: now,
        })
        .eq("id", existingRequest.id);

      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await admin
        .from("portal_access_requests")
        .insert({
          influencer_id: influencerId,
          requested_email: email,
          normalized_mobile: normalizedMobile,
          request_reason: reason,
          priority,
          submitted_at: now,
        });

      if (insertError) throw insertError;
    }

    const { error: influencerUpdateError } = await admin
      .from("influencers")
      .update({
        portal_access_requested_at: now,
        portal_access_required: hasFinancialRequirement,
        updated_at: now,
      })
      .eq("id", influencerId)
      .is("user_id", null);

    if (influencerUpdateError) throw influencerUpdateError;

    await admin.from("activity_logs").insert({
      actor_id: null,
      entity_type: "influencer",
      entity_id: influencerId,
      action: "portal_access_requested",
      metadata: {
        reason,
        priority,
        financial_access_required: hasFinancialRequirement,
      },
    });

    return NextResponse.json({
      success: true,
      message:
        "تم تسجيل طلب تفعيل بوابة المؤثر. ستراجع الإدارة الطلب، وبعد الموافقة سيشارك الموظف معك رابط التفعيل مباشرة دون بريد إلكتروني.",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "RATE_LIMITED") {
      return NextResponse.json(
        {
          success: false,
          message: "تم تجاوز عدد المحاولات. حاولي مرة أخرى لاحقًا.",
        },
        { status: 429 },
      );
    }

    console.error("Portal access request failed:", error);

    return NextResponse.json(
      {
        success: false,
        message: "تعذر إرسال طلب التفعيل حاليًا. يرجى المحاولة مرة أخرى.",
      },
      { status: 500 },
    );
  }
}
