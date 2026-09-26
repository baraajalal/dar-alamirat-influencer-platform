import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { enforceRegistrationRateLimit } from "@/lib/influencers/rate-limit";
import { LEGAL_DOCUMENT_VERSIONS } from "@/lib/legal/versions";
import { PORTAL_ACCESS_OPEN_STATUSES, PORTAL_ACCESS_STATUS } from "@/lib/domain/portal-access";
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
            parsed.error.issues[0]?.message ?? "بيانات طلب الانضمام غير صحيحة",
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
            "وجدنا أكثر من ملف مرتبط بهذا الرقم. يرجى التواصل مع الإدارة قبل إعادة إرسال طلب الانضمام.",
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
            "يجب حفظ ملف المؤثر أولًا قبل إرسال طلب الانضمام.",
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

    const { data: consents, error: consentsError } = await admin
      .from("influencer_legal_consents")
      .select("document_type,document_version")
      .eq("influencer_id", influencerId)
      .in("document_type", ["terms", "privacy"]);

    if (consentsError) throw consentsError;

    const hasCurrentTerms = (consents ?? []).some(
      (item) => item.document_type === "terms" && item.document_version === LEGAL_DOCUMENT_VERSIONS.terms,
    );
    const hasCurrentPrivacy = (consents ?? []).some(
      (item) => item.document_type === "privacy" && item.document_version === LEGAL_DOCUMENT_VERSIONS.privacy,
    );

    if (!hasCurrentTerms || !hasCurrentPrivacy) {
      return NextResponse.json(
        {
          success: false,
          code: "CONSENT_REQUIRED",
          message: "يجب الموافقة على الإصدار الحالي من الشروط والأحكام وسياسة الخصوصية قبل إرسال طلب الانضمام.",
        },
        { status: 409 },
      );
    }

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
      .in("status", PORTAL_ACCESS_OPEN_STATUSES)
      .maybeSingle();

    if (existingRequestError) throw existingRequestError;

    const now = new Date().toISOString();
    const reason = hasFinancialRequirement
      ? "payment_required"
      : "self_service";
    const priority = hasFinancialRequirement ? "high" : "normal";

    let createdNewRequest = false;

    if (existingRequest) {
      if (existingRequest.status === PORTAL_ACCESS_STATUS.submitted) {
        const { error: updateError } = await admin
          .from("portal_access_requests")
          .update({
            requested_email: email,
            normalized_mobile: normalizedMobile,
            request_reason: reason,
            priority,
            updated_at: now,
          })
          .eq("id", existingRequest.id)
          .eq("status", PORTAL_ACCESS_STATUS.submitted);

        if (updateError) throw updateError;
      } else {
        const existingMessages: Record<string, string> = {
          [PORTAL_ACCESS_STATUS.underReview]: "طلب انضمامك تحت المراجعة بالفعل. لا تحتاج إلى إرسال طلب جديد.",
          [PORTAL_ACCESS_STATUS.needsChanges]: "طلبك بانتظار التعديلات المطلوبة. استخدم رابط التعديل الآمن الذي أرسله لك الفريق.",
          [PORTAL_ACCESS_STATUS.approved]: "تمت الموافقة على طلب انضمامك. استخدم رابط التفعيل الذي شاركه معك الفريق لإكمال إنشاء الحساب.",
        };

        return NextResponse.json({
          success: true,
          code: "REQUEST_ALREADY_OPEN",
          status: existingRequest.status,
          message: existingMessages[existingRequest.status] ?? "لديك طلب انضمام مفتوح بالفعل.",
        });
      }
    } else {
      const { error: insertError } = await admin
        .from("portal_access_requests")
        .insert({
          influencer_id: influencerId,
          requested_email: email,
          normalized_mobile: normalizedMobile,
          request_reason: reason,
          priority,
          status: PORTAL_ACCESS_STATUS.submitted,
          submitted_at: now,
        });

      if (insertError) throw insertError;
      createdNewRequest = true;
    }

    const { error: influencerUpdateError } = await admin
      .from("influencers")
      .update({
        portal_access_requested_at: now,
        portal_access_required: hasFinancialRequirement,
        account_status: "pending_review",
        updated_at: now,
      })
      .eq("id", influencerId)
      .is("user_id", null);

    if (influencerUpdateError) throw influencerUpdateError;

    await admin.from("activity_logs").insert({
      actor_id: null,
      entity_type: "influencer",
      entity_id: influencerId,
      action: createdNewRequest ? "portal_access_submitted" : "portal_access_submission_refreshed",
      metadata: {
        reason,
        priority,
        financial_access_required: hasFinancialRequirement,
      },
    });

    return NextResponse.json({
      success: true,
      message:
        "تم تسجيل طلب انضمامك للمجتمع. سيراجع الفريق الطلب، وبعد الموافقة سيشارك معك الموظف رابط تفعيل الحساب مباشرة.",
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
        message: "تعذر إرسال طلب الانضمام حاليًا. يرجى المحاولة مرة أخرى.",
      },
      { status: 500 },
    );
  }
}
