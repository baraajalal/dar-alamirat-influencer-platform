import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enforceRegistrationRateLimit } from "@/lib/influencers/rate-limit";
import {
  formatZodError,
  lookupInfluencerRegistration,
  normalizeMobile,
  normalizeProfileUrl,
  profileUrlFromPlatform,
  registrationSchema,
} from "@/lib/influencers/registration";

export const dynamic = "force-dynamic";

function numericText(value: string) {
  return value.replace(/[\s,]/g, "");
}

export async function POST(request: Request) {
  try {
    const rawBody: unknown = await request.json();
    const parsed = registrationSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: formatZodError(parsed.error),
          issues: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { influencer, socialAccounts, website } = parsed.data;

    if (website) {
      return NextResponse.json({ success: true });
    }

    const normalizedMobile = normalizeMobile(influencer.mobile);

    await enforceRegistrationRateLimit({
      request,
      action: "save-profile",
      mobile: normalizedMobile,
      limit: 8,
    });

    const lookup = await lookupInfluencerRegistration(normalizedMobile);

    if (lookup.hasAccount) {
      return NextResponse.json(
        {
          success: false,
          code: "ACCOUNT_EXISTS",
          message:
            "هذا الرقم مرتبط بحساب دخول. يجب تحديث البيانات من خلال بوابة المؤثر.",
        },
        { status: 409 },
      );
    }

    if (lookup.matchSource === "multiple") {
      return NextResponse.json(
        {
          success: false,
          code: "MULTIPLE_MATCHES",
          message:
            "وجدنا أكثر من ملف مرتبط بهذا الرقم. يرجى التواصل مع الإدارة لمراجعة البيانات.",
        },
        { status: 409 },
      );
    }

    const admin = createAdminClient();

    const normalizedSocialAccounts = socialAccounts.map((social) => {
      const generatedUrl = profileUrlFromPlatform(
        social.platform,
        social.username,
      );

      return {
        ...social,
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
      ...influencer,
      email: influencer.email?.trim().toLowerCase() ?? "",
      mobile: normalizedMobile,
      iban: influencer.iban.replace(/[\s-]/g, "").toUpperCase(),
      socialAccounts: normalizedSocialAccounts,
    };

    const { data: influencerId, error: saveError } = await admin.rpc(
      "save_influencer_profile",
      {
        p_payload: payload,
        p_match_source: lookup.matchSource,
        p_archive_influencer_id: lookup.internal.archiveInfluencerId,
        p_existing_influencer_id: lookup.internal.existingInfluencerId,
      },
    );

    if (saveError) {
      console.error("Influencer save failed:", saveError);

      const duplicate =
        saveError.code === "23505" ||
        saveError.message.toLowerCase().includes("duplicate");

      const claimed = saveError.message.includes(
        "PROFILE_ALREADY_CLAIMED",
      );

      return NextResponse.json(
        {
          success: false,
          code: duplicate
            ? "MOBILE_EXISTS"
            : claimed
              ? "PROFILE_CLAIMED"
              : "SAVE_FAILED",
          message: duplicate
            ? "يوجد ملف آخر بنفس رقم الجوال."
            : claimed
              ? "هذا الملف مرتبط بحساب دخول ولا يمكن تحديثه من النموذج العام."
              : "تعذر حفظ البيانات حاليًا. يرجى المحاولة مرة أخرى.",
        },
        { status: duplicate || claimed ? 409 : 500 },
      );
    }

    const { data: savedProfile } = await admin
      .from("influencers")
      .select("profile_completion")
      .eq("id", influencerId)
      .maybeSingle();

    return NextResponse.json(
      {
        success: true,
        influencerId,
        accountCreated: false,
        accountStatus: "unclaimed",
        matchSource: lookup.matchSource,
        profileCompletion: Number(savedProfile?.profile_completion ?? 0),
        message: lookup.exists
          ? "تم تحديث بياناتك بنجاح."
          : "تم إنشاء ملفك وحفظ البيانات بنجاح.",
      },
      { status: 200 },
    );
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

    console.error("Influencer profile save failed:", error);

    return NextResponse.json(
      {
        success: false,
        message: "حدث خطأ غير متوقع أثناء حفظ البيانات.",
      },
      { status: 500 },
    );
  }
}
