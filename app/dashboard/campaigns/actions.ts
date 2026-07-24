"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth/require-user";

export type CampaignActionState = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string[]>;
};

const campaignSchema = z
  .object({
    name: z.string().trim().min(3, "اسم الحملة يجب أن يكون 3 أحرف على الأقل").max(180),
    brand: z.string().trim().min(1, "اختاري أو اكتبي اسم البراند").max(120),
    product: z.string().trim().max(180).optional().default(""),
    campaignType: z.string().trim().max(120).optional().default(""),
    brief: z.string().trim().max(10000).optional().default(""),
    startDate: z.string().trim().optional().default(""),
    endDate: z.string().trim().optional().default(""),
    contentDueAtIso: z.string().trim().optional().default(""),
    publishingDate: z.string().trim().optional().default(""),
    budget: z.string().trim().optional().default(""),
    status: z.enum(["draft", "active", "paused", "completed", "archived"]),
    managerId: z.string().uuid("مدير الحملة غير صحيح").optional().or(z.literal("")),
    hashtags: z.string().trim().max(3000).optional().default(""),
    referenceLinks: z.string().trim().max(5000).optional().default(""),
    internalNotes: z.string().trim().max(10000).optional().default(""),
  })
  .superRefine((value, context) => {
    if (value.startDate && value.endDate && value.endDate < value.startDate) {
      context.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "تاريخ النهاية يجب أن يكون بعد تاريخ البداية",
      });
    }

    if (value.budget) {
      const amount = Number(value.budget.replace(/,/g, ""));
      if (!Number.isFinite(amount) || amount < 0) {
        context.addIssue({
          code: "custom",
          path: ["budget"],
          message: "الميزانية يجب أن تكون رقمًا موجبًا",
        });
      }
    }
  });

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
  const { profile, supabase } = await requireRole(["admin", "coordinator"]);

  const parsed = campaignSchema.safeParse({
    name: formData.get("name"),
    brand: formData.get("brand"),
    product: formData.get("product"),
    campaignType: formData.get("campaign_type"),
    brief: formData.get("brief"),
    startDate: formData.get("start_date"),
    endDate: formData.get("end_date"),
    contentDueAtIso: formData.get("content_due_at_iso"),
    publishingDate: formData.get("publishing_date"),
    budget: formData.get("budget"),
    status: formData.get("status"),
    managerId: formData.get("manager_id"),
    hashtags: formData.get("hashtags"),
    referenceLinks: formData.get("reference_links"),
    internalNotes: formData.get("internal_notes"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "راجعي الحقول المطلوبة ثم حاولي مرة أخرى.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const value = parsed.data;
  const managerId =
    profile.role === "admin" && value.managerId ? value.managerId : profile.id;
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
        tag.startsWith("#") ? tag : `#${tag.replace(/\s+/g, "_")}`,
      ),
      reference_links: splitList(value.referenceLinks),
      internal_notes: value.internalNotes || null,
      archived_at: value.status === "archived" ? new Date().toISOString() : null,
    })
    .select("id")
    .single();

  if (error) {
    const duplicate = error.code === "23505";
    return {
      ok: false,
      message: duplicate
        ? "توجد حملة أخرى بنفس الاسم وتاريخ البداية. غيّري أحدهما ثم أعيدي المحاولة."
        : `تعذر إنشاء الحملة: ${error.message}`,
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
  redirect(`/dashboard/campaigns/${campaign.id}?created=1`);
}
