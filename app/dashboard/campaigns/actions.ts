"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/require-user";
import type { CampaignLocale } from "./campaign-copy";

export type CampaignActionState = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string[]>;
};

function schema(locale: CampaignLocale) {
  const ar = locale === "ar";
  return z
    .object({
      name: z.string().trim().min(3, ar ? "اسم الحملة يجب أن يكون 3 أحرف على الأقل" : "Campaign name must be at least 3 characters").max(180),
      brand: z.string().trim().min(1, ar ? "اختاري أو اكتبي اسم البراند" : "Select or enter a brand").max(120),
      product: z.string().trim().max(180).optional().default(""),
      campaignType: z.string().trim().max(120).optional().default(""),
      brief: z.string().trim().max(10000).optional().default(""),
      startDate: z.string().trim().optional().default(""),
      endDate: z.string().trim().optional().default(""),
      contentDueAtIso: z.string().trim().optional().default(""),
      publishingDate: z.string().trim().optional().default(""),
      budget: z.string().trim().optional().default(""),
      status: z.enum(["draft", "active", "paused", "completed", "archived"]),
      managerId: z.string().uuid(ar ? "مدير الحملة غير صحيح" : "Invalid campaign manager").optional().or(z.literal("")),
      hashtags: z.string().trim().max(3000).optional().default(""),
      referenceLinks: z.string().trim().max(5000).optional().default(""),
      internalNotes: z.string().trim().max(10000).optional().default(""),
      ownerType: z.enum(["internal", "external_supplier", "joint"]),
      category: z.enum(["influencer_campaign", "product_launch", "brand_awareness", "sales_activation", "store_activation", "seasonal_campaign", "event_support", "mixed"]),
      externalOrganizationName: z.string().trim().max(180).optional().default(""),
      externalContactName: z.string().trim().max(180).optional().default(""),
      externalContactMobile: z.string().trim().max(40).optional().default(""),
      externalContactEmail: z.string().trim().email().optional().or(z.literal("")),
      autoCompleteEnabled: z.boolean(),
      completionMode: z
        .enum(["manual", "all_required_targets", "any_primary_target", "all_required_targets_and_assignments"])
        .default("manual"),
    })
    .superRefine((value, context) => {
      if (value.startDate && value.endDate && value.endDate < value.startDate) {
        context.addIssue({
          code: "custom",
          path: ["endDate"],
          message: ar ? "تاريخ النهاية يجب أن يكون بعد تاريخ البداية" : "End date must be after the start date",
        });
      }
      if (value.budget) {
        const amount = Number(value.budget.replace(/,/g, ""));
        if (!Number.isFinite(amount) || amount < 0) {
          context.addIssue({
            code: "custom",
            path: ["budget"],
            message: ar ? "الميزانية يجب أن تكون رقمًا موجبًا" : "Budget must be a positive number",
          });
        }
      }
    });
}

function splitList(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\n,،]+/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

export async function createCampaign(
  _previousState: CampaignActionState,
  formData: FormData,
): Promise<CampaignActionState> {
  const locale: CampaignLocale =
    formData.get("locale") === "en" ? "en" : "ar";

  const ar = locale === "ar";

  const { profile, supabase } = await requirePermission(
    "campaigns",
    "create",
  );

  function field(key: string) {
    return String(formData.get(key) ?? "").trim();
  }

  const autoCompleteEnabled =
    formData.get("auto_complete_enabled") === "on";

  const parsed = schema(locale).safeParse({
    name: field("name"),
    brand: field("brand"),
    product: field("product"),
    campaignType: field("campaign_type"),
    brief: field("brief"),

    startDate: field("start_date"),
    endDate: field("end_date"),
    contentDueAtIso: field("content_due_at_iso"),
    publishingDate: field("publishing_date"),

    budget: field("budget"),
    status: field("status"),
    managerId: field("manager_id"),

    hashtags: field("hashtags"),
    referenceLinks: field("reference_links"),
    internalNotes: field("internal_notes"),

    ownerType: field("campaign_owner_type"),
    category: field("campaign_category"),

    externalOrganizationName: field(
      "external_organization_name",
    ),
    externalContactName: field("external_contact_name"),
    externalContactMobile: field("external_contact_mobile"),
    externalContactEmail: field("external_contact_email"),

    autoCompleteEnabled,

    completionMode: autoCompleteEnabled
      ? field("completion_mode")
      : "manual",
  });

  if (!parsed.success) {
    console.error(
      "CREATE_CAMPAIGN_VALIDATION_ERROR",
      parsed.error.flatten(),
    );

    return {
      ok: false,
      message: ar
        ? "راجعي الحقول المطلوبة ثم حاولي مرة أخرى."
        : "Review the required fields and try again.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const value = parsed.data;

  const managerId =
    profile.role === "admin" && value.managerId
      ? value.managerId
      : profile.id;

  const normalizedBudget = value.budget
    ? Number(value.budget.replace(/,/g, ""))
    : null;

  const { data: campaign, error } = await supabase
    .from("campaigns")
    .insert({
      name: value.name,
      brand: value.brand,

      product: value.product || null,
      campaign_type: value.campaignType || null,
      brief: value.brief || null,

      start_date: value.startDate || null,
      end_date: value.endDate || null,
      content_due_at: value.contentDueAtIso || null,
      publishing_date: value.publishingDate || null,

      budget: normalizedBudget,
      status: value.status,

      manager_id: managerId,
      created_by: profile.id,

      hashtags: splitList(value.hashtags).map((tag) =>
        tag.startsWith("#")
          ? tag
          : `#${tag.replace(/\s+/g, "_")}`,
      ),

      reference_links: splitList(value.referenceLinks),
      internal_notes: value.internalNotes || null,

      archived_at:
        value.status === "archived"
          ? new Date().toISOString()
          : null,

      campaign_owner_type: value.ownerType,
      campaign_category: value.category,

      external_organization_name:
        value.ownerType === "internal"
          ? null
          : value.externalOrganizationName || null,

      external_contact_name:
        value.ownerType === "internal"
          ? null
          : value.externalContactName || null,

      external_contact_mobile:
        value.ownerType === "internal"
          ? null
          : value.externalContactMobile || null,

      external_contact_email:
        value.ownerType === "internal"
          ? null
          : value.externalContactEmail || null,

      auto_complete_enabled: value.autoCompleteEnabled,

      completion_mode: value.autoCompleteEnabled
        ? value.completionMode
        : "manual",
    })
    .select("id")
    .single();

  if (error) {
    console.error("CREATE_CAMPAIGN_DATABASE_ERROR", error);

    const duplicate = error.code === "23505";

    return {
      ok: false,
      message: duplicate
        ? ar
          ? "توجد حملة أخرى بنفس الاسم وتاريخ البداية. غيّري أحدهما ثم أعيدي المحاولة."
          : "Another campaign has the same name and start date. Change one and try again."
        : ar
          ? `تعذر إنشاء الحملة: ${error.message}`
          : `Could not create campaign: ${error.message}`,
    };
  }

  await supabase.from("activity_logs").insert({
    actor_id: profile.id,
    entity_type: "campaign",
    entity_id: campaign.id,
    action: "campaign_created",
    metadata: {
      name: value.name,
      brand: value.brand,
      status: value.status,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/campaigns");

  redirect(
    `/dashboard/campaigns/${campaign.id}?created=1`,
  );
}
