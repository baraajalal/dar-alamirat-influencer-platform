import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { enforceRegistrationRateLimit } from "@/lib/influencers/rate-limit";
import {
  formatZodError,
  normalizeMobile,
  normalizeProfileUrl,
  profileUrlFromPlatform,
  registrationSchema,
} from "@/lib/influencers/registration";
import { LEGAL_DOCUMENT_VERSIONS } from "@/lib/legal/versions";

export const dynamic = "force-dynamic";

const consentSchema = z.object({
  termsAccepted: z.literal(true, { error: "يجب الموافقة على الشروط والأحكام" }),
  privacyAccepted: z.literal(true, { error: "يجب الموافقة على سياسة الخصوصية" }),
  locale: z.enum(["ar", "en"]).default("ar"),
});

function preciseIssues(error: { issues: Array<{ path: PropertyKey[]; message: string }> }) {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.map(String).join(".");
    if (path && !fields[path]) fields[path] = issue.message;
  }
  return fields;
}

function numericText(value: string) {
  return value.replace(/[\s,]/g, "");
}

function usernameFromUrl(value: string) {
  try {
    const url = new URL(value);
    const parts = url.pathname.split("/").filter(Boolean);
    return (parts.at(-1) || url.hostname.split(".")[0] || "profile")
      .replace(/^@/, "")
      .slice(0, 120);
  } catch {
    return "profile";
  }
}

export async function POST(request: Request) {
  try {
    const rawBody: unknown = await request.json();
    const parsed = registrationSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: formatZodError(parsed.error), issues: preciseIssues(parsed.error) },
        { status: 400 },
      );
    }

    const consentResult = consentSchema.safeParse(
      typeof rawBody === "object" && rawBody !== null && "consent" in rawBody
        ? (rawBody as { consent?: unknown }).consent
        : undefined,
    );
    if (!consentResult.success) {
      return NextResponse.json(
        {
          success: false,
          code: "CONSENT_REQUIRED",
          message: "يجب الموافقة على الشروط والأحكام وسياسة الخصوصية قبل إرسال الطلب.",
          issues: preciseIssues(consentResult.error),
        },
        { status: 400 },
      );
    }

    const { influencer, socialAccounts, website } = parsed.data;
    if (website) return NextResponse.json({ success: true });

    const normalizedMobile = normalizeMobile(influencer.mobile);
    await enforceRegistrationRateLimit({
      request,
      action: "save-profile",
      mobile: normalizedMobile,
      limit: 8,
    });

    const normalizedSocialAccounts = socialAccounts.map((social, index) => {
      const generatedUrl = profileUrlFromPlatform(social.platform, social.username);
      return {
        ...social,
        username:
          social.username.trim() ||
          usernameFromUrl(social.profileUrl) ||
          `profile-${index + 1}`,
        profileUrl: normalizeProfileUrl(social.profileUrl || generatedUrl),
        followersCount: numericText(social.followersCount),
        averageLikes: numericText(social.averageLikes),
        averageViews: numericText(social.averageViews),
        averageComments: numericText(social.averageComments),
        engagementRate: numericText(social.engagementRate),
        femaleAudience: numericText(social.femaleAudience),
        maleAudience: numericText(social.maleAudience),
      };
    });

    const payload = {
      influencer: {
        ...influencer,
        email: influencer.email?.trim().toLowerCase() ?? "",
        mobile: normalizedMobile,
        iban: influencer.iban.replace(/[\s-]/g, "").toUpperCase(),
      },
      socialAccounts: normalizedSocialAccounts,
    };

    const admin = createAdminClient();

    // Avoid repeated submissions while the same identity is already waiting for a human decision.
    const { data: existingSubmission } = await admin
      .from("influencer_registration_submissions")
      .select("id,status")
      .eq("normalized_mobile", normalizedMobile)
      .in("status", ["awaiting_match", "awaiting_admin_review", "identity_correction_required"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingSubmission) {
      return NextResponse.json({
        success: true,
        code: "REGISTRATION_ALREADY_PENDING",
        matchingRequired: true,
        submissionId: existingSubmission.id,
        message: "طلب التسجيل موجود بالفعل وينتظر مراجعة المطابقة من الإدارة.",
      });
    }

    // If the old activation review is already open, do not create another registration identity.
    const { data: openAccessRequest } = await admin
      .from("portal_access_requests")
      .select("id,status")
      .eq("normalized_mobile", normalizedMobile)
      .in("status", ["submitted", "under_review", "needs_changes", "approved"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (openAccessRequest) {
      return NextResponse.json({
        success: true,
        code: "ACTIVATION_REVIEW_ALREADY_OPEN",
        matchingRequired: false,
        message: "طلبك موجود بالفعل ضمن مراجعة التفعيل. لا تحتاج إلى إرسال طلب جديد.",
      });
    }

    const acceptedAt = new Date().toISOString();
    const { data: submission, error: submissionError } = await admin
      .from("influencer_registration_submissions")
      .insert({
        normalized_mobile: normalizedMobile,
        requested_email: payload.influencer.email,
        payload,
        consent_locale: consentResult.data.locale,
        terms_version: LEGAL_DOCUMENT_VERSIONS.terms,
        privacy_version: LEGAL_DOCUMENT_VERSIONS.privacy,
        consent_accepted_at: acceptedAt,
        status: "awaiting_match",
      })
      .select("id")
      .single();

    if (submissionError || !submission) throw submissionError ?? new Error("SUBMISSION_CREATE_FAILED");

    const { data: candidates, error: candidateError } = await admin.rpc(
      "find_influencer_match_candidates",
      {
        p_mobile: normalizedMobile,
        p_full_name: payload.influencer.fullName,
        p_social: normalizedSocialAccounts,
      },
    );
    if (candidateError) throw candidateError;

    const candidateRows = (candidates ?? []) as Array<{
      influencer_id: string;
      score: number;
      mobile_match: boolean;
      social_username_match: boolean;
      profile_url_match: boolean;
      name_support_match: boolean;
      reasons: unknown;
    }>;

    if (candidateRows.length > 0) {
      const { error: candidateInsertError } = await admin
        .from("influencer_match_candidates")
        .insert(
          candidateRows.map((candidate) => ({
            submission_id: submission.id,
            influencer_id: candidate.influencer_id,
            score: candidate.score,
            mobile_match: candidate.mobile_match,
            social_username_match: candidate.social_username_match,
            profile_url_match: candidate.profile_url_match,
            name_support_match: candidate.name_support_match,
            reasons: candidate.reasons,
          })),
        );
      if (candidateInsertError) throw candidateInsertError;

      await admin
        .from("influencer_registration_submissions")
        .update({
          status: "awaiting_admin_review",
          match_summary: {
            candidates: candidateRows.length,
            strongestScore: Math.max(...candidateRows.map((item) => item.score)),
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", submission.id);

      return NextResponse.json({
        success: true,
        code: "MATCH_REVIEW_REQUIRED",
        matchingRequired: true,
        submissionId: submission.id,
        message: "تم استلام التسجيل. توجد بيانات أرشيف محتملة وسيتم اعتماد المطابقة يدويًا من الإدارة قبل متابعة التفعيل.",
      });
    }

    // No archive/identity candidate: create a normal new profile and send it to the existing activation review workflow.
    const { data: influencerId, error: createError } = await admin.rpc(
      "apply_registration_submission",
      { p_submission_id: submission.id, p_existing_influencer_id: null },
    );
    if (createError || !influencerId) throw createError ?? new Error("NEW_PROFILE_CREATE_FAILED");

    return NextResponse.json({
      success: true,
      code: "NEW_REGISTRATION_SUBMITTED",
      matchingRequired: false,
      influencerId,
      submissionId: submission.id,
      message: "تم استلام طلب التسجيل وإرساله إلى مسار مراجعة التفعيل المعتاد.",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "RATE_LIMITED") {
      return NextResponse.json(
        { success: false, message: "تم تجاوز عدد المحاولات. حاول مرة أخرى لاحقًا." },
        { status: 429 },
      );
    }
    console.error("Influencer staged registration failed:", error);
    return NextResponse.json(
      { success: false, message: "تعذر إرسال التسجيل حاليًا. يرجى المحاولة مرة أخرى." },
      { status: 500 },
    );
  }
}
