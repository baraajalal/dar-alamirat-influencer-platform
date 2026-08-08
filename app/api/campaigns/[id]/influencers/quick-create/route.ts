import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/require-user";
import { normalizeMobile } from "@/lib/influencers/registration";

export const dynamic = "force-dynamic";

const schema = z.object({
  fullName: z.string().trim().min(2).max(180),
  mobile: z.string().trim().min(8).max(30),
  gender: z.enum(["female", "male"]),
  city: z.string().trim().max(120).optional().default(""),
  platform: z.enum(["instagram", "tiktok", "snapchat", "youtube", "x", "facebook", "other"]),
  username: z.string().trim().min(2).max(180),
  profileUrl: z.string().trim().url().optional().or(z.literal("")),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id: campaignId } = await context.params;
    const { profile, supabase } = await requireRole(["admin", "coordinator"]);
    const parsed = schema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { message: "راجعي بيانات المؤثر الأساسية وحساب التواصل." },
        { status: 400 },
      );
    }

    const value = parsed.data;
    const mobile = normalizeMobile(value.mobile);
    if (!/^9665\d{8}$/.test(mobile)) {
      return NextResponse.json(
        { message: "رقم الجوال يجب أن يكون رقمًا سعوديًا صحيحًا." },
        { status: 400 },
      );
    }

    const { data: existing, error: existingError } = await supabase
      .from("influencers")
      .select("id,full_name,mobile_e164")
      .eq("mobile_e164", mobile)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existing) {
      return NextResponse.json(
        {
          code: "DUPLICATE_MOBILE",
          message: `المؤثر ${existing.full_name} مسجل مسبقًا. ابحثي عنه برقم ${existing.mobile_e164}.`,
          existingInfluencerId: existing.id,
          mobile: existing.mobile_e164,
        },
        { status: 409 },
      );
    }

    const { data: influencer, error: influencerError } = await supabase
      .from("influencers")
      .insert({
        full_name: value.fullName,
        mobile_e164: mobile,
        normalized_mobile: mobile,
        gender: value.gender,
        city: value.city || null,
        country: "Saudi Arabia",
        source: "campaign_quick_add",
        registration_source: "campaign_assignment",
        account_status: "unclaimed",
        activation_status: "guest",
        archive_match_status: "not_checked",
        created_by: profile.id,
      })
      .select("id,full_name,mobile_e164,city,country,profile_completion")
      .single();

    if (influencerError) {
      if (influencerError.code === "23505") {
        return NextResponse.json(
          { code: "DUPLICATE_MOBILE", message: "رقم الجوال مسجل لمؤثر آخر." },
          { status: 409 },
        );
      }
      throw influencerError;
    }

    const username = value.username.replace(/^@+/, "").trim();
    const { data: socialAccount, error: socialError } = await supabase
      .from("social_accounts")
      .insert({
        influencer_id: influencer.id,
        platform: value.platform,
        username,
        profile_url: value.profileUrl || null,
      })
      .select("id,platform,username,profile_url,followers_count")
      .single();

    if (socialError) {
      await supabase.from("influencers").delete().eq("id", influencer.id);
      throw socialError;
    }

    await supabase.from("activity_logs").insert({
      actor_id: profile.id,
      entity_type: "influencer",
      entity_id: influencer.id,
      action: "influencer_quick_created_from_campaign",
      metadata: {
        campaign_id: campaignId,
        platform: value.platform,
        profile_status: "initial",
      },
    });

    return NextResponse.json({
      influencer: {
        influencer_id: influencer.id,
        full_name: influencer.full_name,
        mobile_e164: influencer.mobile_e164,
        city: influencer.city,
        country: influencer.country,
        profile_completion: Number(influencer.profile_completion ?? 0),
        social_accounts: [
          {
            id: socialAccount.id,
            platform: socialAccount.platform,
            username: socialAccount.username,
            profileUrl: socialAccount.profile_url,
            followersCount: socialAccount.followers_count,
          },
        ],
        available: true,
        availability_reason: null,
        blocking_campaign_id: null,
        blocking_campaign_name: null,
        blocked_until: null,
        days_remaining: null,
      },
    });
  } catch (error) {
    console.error("Quick campaign influencer creation failed:", error);
    return NextResponse.json(
      { message: "تعذر إنشاء الملف الأولي للمؤثر حاليًا." },
      { status: 500 },
    );
  }
}
