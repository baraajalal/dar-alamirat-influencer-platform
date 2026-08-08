"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";

const PAGE = "/dashboard/finance/bank-profiles";

function field(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function digits(value: string | null | undefined) {
  const arabic = "٠١٢٣٤٥٦٧٨٩";
  const persian = "۰۱۲۳۴۵۶۷۸۹";
  return String(value ?? "")
    .replace(/[٠-٩]/g, (d) => String(arabic.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String(persian.indexOf(d)))
    .replace(/\D/g, "");
}

function identityType(value: string) {
  if (/^1\d{9}$/.test(value)) return "national_id";
  if (/^2\d{9}$/.test(value)) return "residency";
  if (/^7\d{9}$/.test(value)) return "commercial_registration";
  return null;
}

export async function reviewCurrentBankProfile(formData: FormData) {
  const { user } = await requireRole(["admin", "finance"]);
  const influencerId = field(formData, "influencer_id");
  const decision = field(formData, "decision");
  const notes = field(formData, "notes").slice(0, 2500);
  if (!influencerId || !["approve", "return", "reject"].includes(decision)) redirect(`${PAGE}?error=invalid_review`);
  if (decision !== "approve" && !notes) redirect(`${PAGE}?error=notes_required`);

  const admin = createAdminClient();
  const { data: profile, error } = await admin
    .from("influencer_financial_profiles")
    .select("bank_name,iban,account_holder_name,national_id,identity_number,influencer_confirmed_at")
    .eq("influencer_id", influencerId)
    .maybeSingle();
  if (error || !profile) redirect(`${PAGE}?error=profile_not_found`);

  const iban = String(profile.iban ?? "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const identity = digits(profile.identity_number || profile.national_id);
  const type = identityType(identity);

  if (decision === "approve") {
    if (!profile.bank_name || !profile.account_holder_name || !/^SA\d{22}$/.test(iban)) {
      redirect(`${PAGE}?error=bank_incomplete`);
    }
    if (!profile.influencer_confirmed_at) redirect(`${PAGE}?error=influencer_confirmation_required`);
  }

  const now = new Date().toISOString();
  const status = decision === "approve" ? "approved" : decision === "return" ? "pending_review" : "rejected";
  const { error: updateError } = await admin
    .from("influencer_financial_profiles")
    .update({
      bank_profile_status: status,
      iban_last4: iban ? iban.slice(-4) : null,
      identity_number: identity || null,
      identity_number_normalized: identity || null,
      identity_type: type,
      finance_reviewed_by: user.id,
      finance_reviewed_at: now,
      finance_review_notes: decision === "approve" ? null : notes,
      updated_at: now,
    })
    .eq("influencer_id", influencerId);
  if (updateError) throw new Error(updateError.message);

  if (decision !== "approve") {
    await admin.from("influencer_notifications").insert({
      influencer_id: influencerId,
      type: "bank_profile_update_required",
      title: decision === "return" ? "مطلوب تحديث بيانات البنك" : "لم يتم اعتماد بيانات البنك",
      body: notes,
      action_url: "/portal/profile/payment-details",
      metadata: { decision },
    });
  }

  await admin.from("activity_logs").insert({
    actor_id: user.id,
    entity_type: "influencer",
    entity_id: influencerId,
    action: `bank_profile_${decision}`,
    metadata: { notes: notes || null },
  });

  revalidatePath(PAGE);
  revalidatePath("/dashboard/finance/ad-approvals");
  redirect(`${PAGE}?success=${decision}`);
}

export async function reviewBankUpdateRequest(formData: FormData) {
  const { user } = await requireRole(["admin", "finance"]);
  const requestId = field(formData, "request_id");
  const decision = field(formData, "decision");
  const notes = field(formData, "notes").slice(0, 2500);
  if (!requestId || !["approve", "reject"].includes(decision)) redirect(`${PAGE}?error=invalid_review`);
  if (decision === "reject" && !notes) redirect(`${PAGE}?error=notes_required`);

  const admin = createAdminClient();
  const { data: request, error } = await admin
    .from("influencer_bank_update_requests")
    .select("id,influencer_id,bank_name,iban,iban_last4,account_holder_name,national_id,certificate_path,previous_profile_status,submitted_at,status")
    .eq("id", requestId)
    .eq("status", "pending")
    .maybeSingle();
  if (error || !request) redirect(`${PAGE}?error=request_not_found`);

  const identity = digits(request.national_id);
  const type = identityType(identity);
  const now = new Date().toISOString();

  if (decision === "approve") {
    const { error: profileError } = await admin.from("influencer_financial_profiles").upsert({
      influencer_id: request.influencer_id,
      bank_name: request.bank_name,
      iban: request.iban,
      iban_last4: request.iban_last4,
      account_holder_name: request.account_holder_name,
      national_id: request.national_id,
      identity_number: identity || null,
      identity_number_normalized: identity || null,
      identity_type: type,
      iban_certificate_path: request.certificate_path,
      bank_profile_status: "approved",
      influencer_confirmed_at: request.submitted_at,
      finance_reviewed_by: user.id,
      finance_reviewed_at: now,
      finance_review_notes: null,
      bank_update_requested_at: null,
      updated_at: now,
    }, { onConflict: "influencer_id" });
    if (profileError) throw new Error(profileError.message);
  } else {
    const restored = request.previous_profile_status === "approved" ? "approved" : "rejected";
    const { error: profileError } = await admin.from("influencer_financial_profiles").update({
      bank_profile_status: restored,
      finance_reviewed_by: user.id,
      finance_reviewed_at: now,
      finance_review_notes: notes,
      bank_update_requested_at: null,
      updated_at: now,
    }).eq("influencer_id", request.influencer_id);
    if (profileError) throw new Error(profileError.message);

    await admin.from("influencer_notifications").insert({
      influencer_id: request.influencer_id,
      type: "bank_profile_update_required",
      title: "مطلوب تعديل بيانات البنك",
      body: notes,
      action_url: "/portal/profile/payment-details",
      metadata: { request_id: requestId },
    });
  }

  const { error: requestError } = await admin.from("influencer_bank_update_requests").update({
    status: decision === "approve" ? "approved" : "rejected",
    reviewed_by: user.id,
    reviewed_at: now,
    review_notes: decision === "approve" ? null : notes,
    updated_at: now,
  }).eq("id", requestId);
  if (requestError) throw new Error(requestError.message);

  revalidatePath(PAGE);
  redirect(`${PAGE}?success=${decision}`);
}
