"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";

const PAGE = "/dashboard/finance/ad-approvals";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function normalizeDigits(value: string | null | undefined) {
  const arabic = "٠١٢٣٤٥٦٧٨٩";
  const persian = "۰۱۲۳۴۵۶۷۸۹";
  return String(value ?? "")
    .replace(/[٠-٩]/g, (digit) => String(arabic.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String(persian.indexOf(digit)))
    .replace(/\D/g, "");
}

function normalizedIban(value: string | null | undefined) {
  return String(value ?? "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

const schema = z.object({
  paymentId: z.string().uuid(),
  decision: z.enum(["approve", "return", "reject"]),
  notes: z.string().max(2500).default(""),
  contractApproved: z.boolean(),
  reviewConfirmed: z.boolean(),
});

export async function reviewAdvertisementPayment(formData: FormData) {
  const parsed = schema.safeParse({
    paymentId: text(formData, "payment_id"),
    decision: text(formData, "decision"),
    notes: text(formData, "notes"),
    contractApproved: formData.get("contract_approved") === "on",
    reviewConfirmed: formData.get("review_confirmed") === "on",
  });

  if (!parsed.success) redirect(`${PAGE}?error=invalid_review`);
  const input = parsed.data;
  if (input.decision !== "approve" && !input.notes) {
    redirect(`${PAGE}?error=notes_required`);
  }

  const { user } = await requireRole(["admin", "finance"]);
  const admin = createAdminClient();

  const { data: payment, error: paymentError } = await admin
    .from("payments")
    .select("id,assignment_id,status,type")
    .eq("id", input.paymentId)
    .maybeSingle();
  if (paymentError || !payment) redirect(`${PAGE}?error=payment_not_found`);

  const { data: assignment, error: assignmentError } = await admin
    .from("campaign_assignments")
    .select("id,influencer_id,payment_timing,has_contract,requires_content")
    .eq("id", payment.assignment_id)
    .maybeSingle();
  if (assignmentError || !assignment) redirect(`${PAGE}?error=assignment_not_found`);

  const now = new Date().toISOString();

  if (input.decision === "approve") {
    if (!input.reviewConfirmed) redirect(`${PAGE}?error=review_confirmation_required`);
    const { data: bankProfile } = await admin
      .from("influencer_financial_profiles")
      .select("bank_profile_status,bank_name,account_holder_name,iban,national_id,identity_number")
      .eq("influencer_id", assignment.influencer_id)
      .maybeSingle();

    if (
      !bankProfile ||
      bankProfile.bank_profile_status !== "approved" ||
      !bankProfile.bank_name ||
      !bankProfile.account_holder_name ||
      !/^SA\d{22}$/.test(normalizedIban(bankProfile.iban))
    ) {
      redirect(`${PAGE}?error=bank_profile_required`);
    }

    const prepaid = assignment.payment_timing === "before_publish";
    if (prepaid) {
      if (!assignment.has_contract || !input.contractApproved) {
        redirect(`${PAGE}?error=contract_required`);
      }
    } else if (assignment.requires_content !== false) {
      const { data: platforms } = await admin
        .from("assignment_platforms")
        .select("id")
        .eq("assignment_id", assignment.id);
      const platformIds = (platforms ?? []).map((row) => row.id);
      const { data: items } = platformIds.length
        ? await admin
            .from("content_items")
            .select("id,status,post_url,publication_verified_at")
            .in("assignment_platform_id", platformIds)
        : { data: [] };
      const contentItems = items ?? [];
      const allPublished = contentItems.length > 0 && contentItems.every(
        (item) => item.status === "published" && Boolean(item.post_url) && Boolean(item.publication_verified_at),
      );
      if (!allPublished) redirect(`${PAGE}?error=publication_required`);
    }

    const identity = normalizeDigits(bankProfile.identity_number || bankProfile.national_id);
    const automatic = /^[127]\d{9}$/.test(identity);
    const transferMethod = automatic ? "bank_file" : "manual";
    const manualReason = automatic ? null : "رقم الهوية أو الإقامة أو السجل التجاري غير متوفر أو غير صالح";

    const { error: updateError } = await admin
      .from("payments")
      .update({
        finance_review_status: "approved",
        finance_reviewed_by: user.id,
        finance_reviewed_at: now,
        finance_review_notes: null,
        contract_review_status: prepaid ? "approved" : "not_required",
        transfer_method: transferMethod,
        manual_transfer_reason: manualReason,
        ready_for_batch_at: now,
        status: "ready_for_finance",
        approved_by: user.id,
        approved_at: now,
        updated_at: now,
      })
      .eq("id", input.paymentId);
    if (updateError) throw new Error(updateError.message);
  } else {
    const reviewStatus = input.decision === "return" ? "returned" : "rejected";
    const paymentStatus = input.decision === "return" ? "draft" : "cancelled";
    const { error: updateError } = await admin
      .from("payments")
      .update({
        finance_review_status: reviewStatus,
        finance_reviewed_by: user.id,
        finance_reviewed_at: now,
        finance_review_notes: input.notes,
        contract_review_status: assignment.payment_timing === "before_publish" ? "rejected" : "not_required",
        ready_for_batch_at: null,
        status: paymentStatus,
        updated_at: now,
      })
      .eq("id", input.paymentId);
    if (updateError) throw new Error(updateError.message);

    await admin.from("influencer_notifications").insert({
      influencer_id: assignment.influencer_id,
      type: input.decision === "return" ? "payment_update_required" : "payment_rejected",
      title: input.decision === "return" ? "مطلوب تحديث بيانات المستحق" : "تعذر اعتماد المستحق",
      body: input.notes,
      action_url: "/portal/payments",
      metadata: { payment_id: input.paymentId },
    });
  }

  await admin.from("activity_logs").insert({
    actor_id: user.id,
    entity_type: "payment",
    entity_id: input.paymentId,
    action: `finance_payment_${input.decision}`,
    metadata: { notes: input.notes || null },
  });

  revalidatePath(PAGE);
  revalidatePath("/dashboard/finance/transfers");
  revalidatePath("/portal/payments");
  redirect(`${PAGE}?success=${input.decision}`);
}
