"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/require-user";

function values(formData: FormData, key: string) {
  return formData.getAll(key).map((value) => String(value)).filter(Boolean);
}

function field(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

const schema = z.object({
  brandId: z.string().uuid().optional().or(z.literal("")),
  locale: z.enum(["ar", "en"]),
  nameAr: z.string().trim().min(2).max(160),
  nameEn: z.string().trim().min(2).max(160),
  slug: z.string().trim().min(2).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  logoUrl: z.string().trim().url().optional().or(z.literal("")),
  primaryColor: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/).optional().or(z.literal("")),
  secondaryColor: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/).optional().or(z.literal("")),
  whatsapp: z.string().trim().max(40).optional().default(""),
  email: z.string().trim().email().optional().or(z.literal("")),
  primaryContactId: z.string().uuid().optional().or(z.literal("")),
  scope: z.enum(["none", "brands", "all"]),
  days: z.coerce.number().int().min(0).max(365),
  startBasis: z.enum(["publishing_date", "accepted_at"]),
  isActive: z.boolean(),
});

function errorCode(message: string) {
  if (message.includes("brands_slug_key") || message.includes("duplicate key value")) return "duplicate_slug";
  return "save_failed";
}

export async function saveBrand(formData: FormData) {
  const rawLocale = field(formData, "locale");
  const locale = rawLocale === "en" ? "en" : "ar";
  const brandId = field(formData, "brand_id");
  await requirePermission("brands", brandId ? "update" : "create");

  const parsed = schema.safeParse({
    brandId,
    locale,
    nameAr: field(formData, "name_ar"),
    nameEn: field(formData, "name_en"),
    slug: field(formData, "slug").toLowerCase(),
    logoUrl: field(formData, "logo_url"),
    primaryColor: field(formData, "primary_color"),
    secondaryColor: field(formData, "secondary_color"),
    whatsapp: field(formData, "whatsapp_number"),
    email: field(formData, "contact_email"),
    primaryContactId: field(formData, "primary_contact_id"),
    scope: field(formData, "default_exclusivity_scope"),
    days: field(formData, "default_exclusivity_days") || "0",
    startBasis: field(formData, "default_exclusivity_start_basis"),
    isActive: formData.get("is_active") === "on",
  });

  if (!parsed.success) {
    const path = brandId ? `/dashboard/brands/${brandId}` : "/dashboard/brands/new";
    redirect(`${path}?error=validation`);
  }

  const { supabase } = await requirePermission("brands", brandId ? "update" : "create");
  const data = parsed.data;
  const blockedBrandIds = values(formData, "blocked_brand_ids").filter((id) => id && id !== data.brandId);
  if (data.scope === "brands" && blockedBrandIds.length === 0) {
    const path = brandId ? `/dashboard/brands/${brandId}` : "/dashboard/brands/new";
    redirect(`${path}?error=validation`);
  }
  const { data: savedId, error } = await supabase.rpc("save_brand_configuration", {
    p_brand_id: data.brandId || null,
    p_name_ar: data.nameAr,
    p_name_en: data.nameEn,
    p_slug: data.slug,
    p_logo_url: data.logoUrl || null,
    p_primary_color: data.primaryColor || null,
    p_secondary_color: data.secondaryColor || null,
    p_whatsapp_number: data.whatsapp || null,
    p_contact_email: data.email || null,
    p_primary_contact_id: data.primaryContactId || null,
    p_default_exclusivity_scope: data.scope,
    p_default_exclusivity_days: data.scope === "none" ? 0 : data.days,
    p_default_exclusivity_start_basis: data.startBasis,
    p_is_active: data.isActive,
    p_team_member_ids: values(formData, "team_member_ids"),
    p_blocked_brand_ids: data.scope === "brands" ? blockedBrandIds : [],
  });

  if (error) {
    const path = brandId ? `/dashboard/brands/${brandId}` : "/dashboard/brands/new";
    redirect(`${path}?error=${errorCode(error.message)}`);
  }

  revalidatePath("/dashboard/brands");
  revalidatePath("/dashboard/campaigns");
  redirect(`/dashboard/brands/${savedId}?saved=1`);
}
