import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

export const platformValues = [
  "Instagram",
  "TikTok",
  "Snapchat",
  "YouTube",
  "X",
  "Facebook",
  "Other",
] as const;

const optionalNumberString = z
  .union([z.string(), z.number()])
  .transform((value) =>
    String(value ?? "")
      .replace(/[\s,]/g, "")
      .trim(),
  )
  .refine((value) => value === "" || /^\d+(?:\.\d+)?$/.test(value), {
    message: "القيمة الرقمية غير صحيحة",
  });

const percentageString = optionalNumberString.refine((value) => {
  if (value === "") return true;
  const number = Number(value);
  return number >= 0 && number <= 100;
}, "النسبة يجب أن تكون بين 0 و100");

export const socialAccountSchema = z.object({
  recordId: z.string().optional(),
  platform: z.enum(platformValues),
  username: z.string().trim().max(120).optional().default(""),
  otherPlatformName: z.string().trim().max(120).optional().default(""),
  profileUrl: z.string().trim().max(500).optional().default(""),
  followersCount: optionalNumberString,
  averageLikes: optionalNumberString,
  averageViews: optionalNumberString,
  averageComments: optionalNumberString,
  engagementRate: percentageString,
  femaleAudience: percentageString,
  maleAudience: percentageString,
  audienceMainCity: z.string().trim().max(120).optional().default(""),
  audienceMainCountry: z.string().trim().max(120).optional().default(""),
});

const optionalEmail = z
  .union([
    z.literal(""),
    z.string().trim().toLowerCase().email("صيغة البريد الإلكتروني غير صحيحة"),
  ])
  .optional()
  .default("");

export const registrationSchema = z
  .object({
    influencer: z.object({
      fullName: z.string().trim().min(2, "الاسم مطلوب").max(200),
      mobile: z.string().trim().min(9).max(30),
      email: optionalEmail,
      city: z.string().trim().min(1, "المدينة مطلوبة").max(120),
      country: z.string().trim().min(1).max(120),
      gender: z.enum(["female", "male", "other"], {
        message: "يرجى تحديد الجنس",
      }),
      birthYear: z.union([z.string(), z.number()]).transform((value) => String(value ?? "").trim()).refine((value) => /^\d{4}$/.test(value) && Number(value) >= 1940 && Number(value) <= new Date().getFullYear() - 13, "سنة الميلاد غير صحيحة"),
      nationalId: z.string().trim().max(30).optional().default(""),
      hasMawthooq: z.enum(["yes", "no"], {
        message: "يرجى تحديد حالة موثوق",
      }),
      bankName: z.string().trim().max(150).optional().default(""),
      iban: z.string().trim().max(40).optional().default(""),
      accountHolderName: z.string().trim().max(200).optional().default(""),
      mawthooqNumber: z.string().trim().max(80).optional().default(""),
      mawthooqExpiryDate: z.string().trim().max(20).optional().default(""),
      preferredAdCategories: z.array(z.string().trim().min(1)).min(1),
      contentStylePreference: z.array(z.string().trim().min(1)).min(1),
      shootingStylePreferences: z.array(z.string().trim().min(1)).min(1),
    }),
    socialAccounts: z.array(socialAccountSchema).min(1).max(20),
    website: z.string().max(0).optional().default(""),
  })
  .superRefine((value, context) => {
    if (
      value.influencer.hasMawthooq === "yes" &&
      !value.influencer.mawthooqNumber.trim()
    ) {
      context.addIssue({
        code: "custom",
        path: ["influencer", "mawthooqNumber"],
        message: "رقم موثوق مطلوب عند اختيار نعم",
      });
    }

    const seen = new Set<string>();
    value.socialAccounts.forEach((account, index) => {
      const key = `${account.platform.toLowerCase()}:${account.username
        .trim()
        .replace(/^@/, "")
        .toLowerCase()}`;

      if (seen.has(key)) {
        context.addIssue({
          code: "custom",
          path: ["socialAccounts", index, "username"],
          message: "هذا الحساب مكرر في قائمة المنصات",
        });
      }
      seen.add(key);
    });
  });

export type RegistrationPayload = z.infer<typeof registrationSchema>;

export type RegistrationLookup = {
  success: true;
  exists: boolean;
  matchSource: "active" | "archive" | "multiple" | "none";
  requiresReview: boolean;
  hasAccount: boolean;
  profileCompletion: number;
  portalAccessRequested: boolean;
  influencer: {
    fullName: string;
    mobile: string;
    email: string;
    city: string;
    country: string;
    gender: "" | "female" | "male" | "other";
    birthYear: string;
    nationalId: string;
    hasMawthooq: string;
    bankName: string;
    iban: string;
    accountHolderName: string;
    mawthooqNumber: string;
    mawthooqExpiryDate: string;
    preferredAdCategories: string[];
    contentStylePreference: string[];
    shootingStylePreferences: string[];
  } | null;
  socialAccounts: Array<{
    recordId?: string;
    platform: string;
    otherPlatformName: string;
    username: string;
    profileUrl: string;
    followersCount: string;
    averageLikes: string;
    averageViews: string;
    averageComments: string;
    engagementRate: string;
    femaleAudience: string;
    maleAudience: string;
    audienceMainCity: string;
    audienceMainCountry: string;
  }>;
  internal: {
    existingInfluencerId: string | null;
    archiveInfluencerId: string | null;
  };
};

export function normalizeMobile(value: string) {
  let digits = String(value ?? "").replace(/\D/g, "");

  if (digits.startsWith("00966")) digits = digits.slice(2);
  if (digits.startsWith("05") && digits.length === 10) {
    digits = `966${digits.slice(1)}`;
  } else if (digits.startsWith("5") && digits.length === 9) {
    digits = `966${digits}`;
  }

  return digits;
}

export function isSaudiMobile(value: string) {
  return /^9665\d{8}$/.test(normalizeMobile(value));
}

export function normalizeProfileUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function profileUrlFromPlatform(platform: string, username: string) {
  const handle = username.trim().replace(/^@/, "");
  if (!handle) return "";

  switch (platform.toLowerCase()) {
    case "instagram":
      return `https://www.instagram.com/${handle}`;
    case "tiktok":
      return `https://www.tiktok.com/@${handle}`;
    case "snapchat":
      return `https://www.snapchat.com/add/${handle}`;
    case "youtube":
      return `https://www.youtube.com/@${handle}`;
    case "x":
      return `https://x.com/${handle}`;
    case "facebook":
      return `https://www.facebook.com/${handle}`;
    default:
      return "";
  }
}

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => text(item).trim())
    .filter((item) => item.length > 0);
}

function platformLabel(value: unknown) {
  const normalized = text(value).toLowerCase();
  if (normalized === "instagram") return "Instagram";
  if (normalized === "tiktok") return "TikTok";
  if (normalized === "snapchat") return "Snapchat";
  if (normalized === "youtube") return "YouTube";
  if (normalized === "x" || normalized === "twitter") return "X";
  if (normalized === "facebook") return "Facebook";
  return "Other";
}

function mawthooqLabel(value: unknown) {
  const normalized = text(value).trim().toLowerCase();
  if (["yes", "true", "1", "نعم", "ايوه", "أيوه"].includes(normalized)) {
    return "yes";
  }
  if (["no", "false", "0", "لا"].includes(normalized)) return "no";
  return "";
}

function mapSocialAccount(record: Record<string, unknown>) {
  return {
    recordId: text(record.id),
    platform: platformLabel(record.platform),
    otherPlatformName: text(record.platform_label),
    username: text(record.username),
    profileUrl: text(record.profile_url ?? record.profileUrl),
    followersCount: text(record.followers_count ?? record.followersCount),
    averageLikes: text(record.average_likes ?? record.averageLikes),
    averageViews: text(record.average_views ?? record.averageViews),
    averageComments: text(record.average_comments ?? record.averageComments),
    engagementRate: text(record.engagement_rate ?? record.engagementRate),
    femaleAudience: text(record.female_audience ?? record.femaleAudience),
    maleAudience: text(record.male_audience ?? record.maleAudience),
    audienceMainCity: text(record.audience_main_city ?? record.audienceMainCity),
    audienceMainCountry: text(
      record.audience_main_country ?? record.audienceMainCountry,
    ),
  };
}

export async function lookupInfluencerRegistration(
  rawMobile: string,
): Promise<RegistrationLookup> {
  const normalizedMobile = normalizeMobile(rawMobile);

  if (!/^9665\d{8}$/.test(normalizedMobile)) {
    throw new Error("INVALID_MOBILE");
  }

  const supabase = createAdminClient();

  const { data: activeRecords, error: activeError } = await supabase
    .from("influencers")
    .select(
      "id,user_id,full_name,mobile_e164,email,city,country,gender,mawthooq_status,preferred_ad_categories,content_style_preferences,shooting_style_preferences,birth_year,profile_completion,portal_access_requested_at",
    )
    .eq("normalized_mobile", normalizedMobile)
    .limit(2);

  if (activeError) throw activeError;

  if ((activeRecords?.length ?? 0) > 1) {
    return emptyLookup("multiple", true, false);
  }

  if (activeRecords?.length === 1) {
    const active = activeRecords[0];

    if (active.user_id) {
      return {
        ...emptyLookup("active", false, true),
        exists: true,
        profileCompletion: Number(active.profile_completion ?? 0),
        portalAccessRequested: Boolean(active.portal_access_requested_at),
        internal: {
          existingInfluencerId: active.id,
          archiveInfluencerId: null,
        },
      };
    }

    const [{ data: accounts, error: accountsError }, { data: finance }] =
      await Promise.all([
        supabase
          .from("social_accounts")
          .select("*")
          .eq("influencer_id", active.id)
          .order("created_at", { ascending: true }),
        supabase
          .from("influencer_financial_profiles")
          .select("mawthooq_number,mawthooq_expiry_date")
          .eq("influencer_id", active.id)
          .maybeSingle(),
      ]);

    if (accountsError) throw accountsError;

    return {
      success: true,
      exists: true,
      matchSource: "active",
      requiresReview: true,
      hasAccount: false,
      profileCompletion: Number(active.profile_completion ?? 0),
      portalAccessRequested: Boolean(active.portal_access_requested_at),
      influencer: {
        fullName: text(active.full_name),
        mobile: text(active.mobile_e164 || rawMobile),
        email: text(active.email),
        city: text(active.city),
        country: text(active.country || "Saudi Arabia"),
        gender:
          ["female", "male", "other"].includes(String(active.gender))
            ? (active.gender as "female" | "male" | "other")
            : "",
        birthYear: text(active.birth_year),
        nationalId: "",
        hasMawthooq:
          active.mawthooq_status === true
            ? "yes"
            : active.mawthooq_status === false
              ? "no"
              : "",
        bankName: "",
        iban: "",
        accountHolderName: "",
        mawthooqNumber: text(finance?.mawthooq_number),
        mawthooqExpiryDate: text(finance?.mawthooq_expiry_date),
        preferredAdCategories: stringArray(active.preferred_ad_categories),
        contentStylePreference: stringArray(active.content_style_preferences),
        shootingStylePreferences: stringArray(active.shooting_style_preferences),
      },
      socialAccounts: (accounts ?? []).map((account) =>
        mapSocialAccount(account as Record<string, unknown>),
      ),
      internal: {
        existingInfluencerId: active.id,
        archiveInfluencerId: null,
      },
    };
  }

  const { data: archiveRecords, error: archiveError } = await supabase
    .from("archive_influencers")
    .select(
      "id,influencer_name,influencer_mobile,city,country,has_mawthooq,mawthooq_number",
    )
    .eq("normalized_mobile", normalizedMobile)
    .limit(2);

  if (archiveError) throw archiveError;

  if ((archiveRecords?.length ?? 0) > 1) {
    return emptyLookup("multiple", true, false);
  }

  if (archiveRecords?.length === 1) {
    const archive = archiveRecords[0];

    const { data: archiveAccounts, error: archiveAccountsError } =
      await supabase
        .from("archive_social_accounts")
        .select("*")
        .eq("archive_influencer_id", archive.id);

    if (archiveAccountsError) {
      console.warn(
        "Archive social accounts could not be loaded:",
        archiveAccountsError.message,
      );
    }

    return {
      success: true,
      exists: true,
      matchSource: "archive",
      requiresReview: true,
      hasAccount: false,
      profileCompletion: 0,
      portalAccessRequested: false,
      influencer: {
        fullName: text(archive.influencer_name),
        mobile: text(archive.influencer_mobile || rawMobile),
        email: "",
        city: text(archive.city),
        country: text(archive.country || "Saudi Arabia"),
        gender: "",
        birthYear: "",
        nationalId: "",
        hasMawthooq: mawthooqLabel(archive.has_mawthooq),
        bankName: "",
        iban: "",
        accountHolderName: "",
        mawthooqNumber: text(archive.mawthooq_number),
        mawthooqExpiryDate: "",
        preferredAdCategories: [],
        contentStylePreference: [],
        shootingStylePreferences: [],
      },
      socialAccounts: (archiveAccounts ?? []).map((account) =>
        mapSocialAccount(account as Record<string, unknown>),
      ),
      internal: {
        existingInfluencerId: null,
        archiveInfluencerId: archive.id,
      },
    };
  }

  return emptyLookup("none", false, false);
}

function emptyLookup(
  matchSource: RegistrationLookup["matchSource"],
  requiresReview: boolean,
  hasAccount: boolean,
): RegistrationLookup {
  return {
    success: true,
    exists: matchSource !== "none",
    matchSource,
    requiresReview,
    hasAccount,
    profileCompletion: 0,
    portalAccessRequested: false,
    influencer: null,
    socialAccounts: [],
    internal: {
      existingInfluencerId: null,
      archiveInfluencerId: null,
    },
  };
}

export function publicLookupResult(result: RegistrationLookup) {
  const { internal: _internal, ...publicResult } = result;
  void _internal;

  return {
    ...publicResult,
    influencer: publicResult.influencer
      ? {
          ...publicResult.influencer,
          email: "",
          nationalId: "",
          bankName: "",
          iban: "",
          accountHolderName: "",
        }
      : null,
  };
}

export function formatZodError(error: z.ZodError) {
  return error.issues[0]?.message ?? "بيانات التسجيل غير صحيحة";
}
