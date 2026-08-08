"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";

const LIST = "/dashboard/finance/transfers";

function field(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function numberValue(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function firstPositiveAmount(...values: Array<number | string | null | undefined>) {
  for (const value of values) {
    const parsed = numberValue(value);
    if (parsed > 0) return parsed;
  }
  return 0;
}

function digits(value: string | null | undefined) {
  const arabic = "٠١٢٣٤٥٦٧٨٩";
  const persian = "۰۱۲۳۴۵۶۷۸۹";
  return String(value ?? "")
    .replace(/[٠-٩]/g, (d) => String(arabic.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String(persian.indexOf(d)))
    .replace(/\D/g, "");
}

const createSchema = z.object({
  name: z.string().min(3).max(160),
  batchCode: z.string().min(3).max(80).regex(/^[A-Za-z0-9_-]+$/),
  monthLabel: z.string().min(3).max(80),
  scheduledFor: z.string().optional().default(""),
  paymentIds: z.array(z.string().uuid()).min(1),
});

export async function createPaymentBatch(formData: FormData) {
  const parsed = createSchema.safeParse({
    name: field(formData, "name"),
    batchCode: field(formData, "batch_code"),
    monthLabel: field(formData, "month_label"),
    scheduledFor: field(formData, "scheduled_for"),
    paymentIds: formData.getAll("payment_ids").map(String),
  });
  if (!parsed.success) redirect(`${LIST}?error=invalid_batch`);

  const { user } = await requireRole(["admin", "finance"]);
  const admin = createAdminClient();
  const input = parsed.data;

  const { data: payments, error: paymentError } = await admin
    .from("finance_transfer_candidates")
    .select("id,assignment_id,compensation_id,type,expected_amount,amount,paid_amount,effective_amount,remaining_amount,finance_review_status,status,transfer_method,manual_transfer_reason,contract_review_status")
    .in("id", input.paymentIds)
    .eq("type", "bank_transfer")
    .eq("finance_review_status", "approved")
    .eq("status", "ready_for_finance");
  if (paymentError) throw new Error(paymentError.message);
  if (!payments || payments.length !== input.paymentIds.length) redirect(`${LIST}?error=payments_not_ready`);

  const assignmentIds = [...new Set(payments.map((row) => row.assignment_id))];
  const { data: assignments } = await admin
    .from("campaign_assignments")
    .select("id,influencer_id,campaign_id,payment_timing,has_contract")
    .in("id", assignmentIds);
  const assignmentMap = new Map((assignments ?? []).map((row) => [row.id, row]));
  const influencerIds = [...new Set((assignments ?? []).map((row) => row.influencer_id))];
  const campaignIds = [...new Set((assignments ?? []).map((row) => row.campaign_id))];

  const [{ data: influencers }, { data: campaigns }, { data: profiles }, { data: platforms }] = await Promise.all([
    admin.from("influencers").select("id,full_name,mobile_e164").in("id", influencerIds),
    admin.from("campaigns").select("id,name,brand").in("id", campaignIds),
    admin.from("influencer_financial_profiles").select("influencer_id,bank_profile_status,bank_name,account_holder_name,iban,national_id,identity_type,identity_number").in("influencer_id", influencerIds),
    admin.from("assignment_platforms").select("id,assignment_id").in("assignment_id", assignmentIds),
  ]);

  const influencerMap = new Map((influencers ?? []).map((row) => [row.id, row]));
  const campaignMap = new Map((campaigns ?? []).map((row) => [row.id, row]));
  const profileMap = new Map((profiles ?? []).map((row) => [row.influencer_id, row]));
  const platformAssignment = new Map((platforms ?? []).map((row) => [row.id, row.assignment_id]));
  const platformIds = (platforms ?? []).map((row) => row.id);
  const { data: contentItems } = platformIds.length
    ? await admin.from("content_items").select("assignment_platform_id,post_url,publication_verified_at").in("assignment_platform_id", platformIds).not("post_url", "is", null)
    : { data: [] };
  const publicationMap = new Map<string, string>();
  for (const item of contentItems ?? []) {
    const assignmentId = platformAssignment.get(item.assignment_platform_id);
    if (assignmentId && item.post_url && item.publication_verified_at && !publicationMap.has(assignmentId)) publicationMap.set(assignmentId, item.post_url);
  }

  const invalidPayment = payments.find((payment) => {
    const due = numberValue(payment.remaining_amount) > 0
      ? numberValue(payment.remaining_amount)
      : Math.max(0, firstPositiveAmount(payment.effective_amount, payment.expected_amount, payment.amount) - numberValue(payment.paid_amount));
    return due <= 0;
  });
  if (invalidPayment) redirect(`${LIST}?error=payment_has_no_remaining_amount`);

  const { data: batch, error: batchError } = await admin.from("payment_batches").insert({
    name: input.name,
    batch_code: input.batchCode.toUpperCase(),
    month_label: input.monthLabel,
    scheduled_for: input.scheduledFor || null,
    status: "draft",
    created_by: user.id,
  }).select("id").single();
  if (batchError) {
    if (batchError.code === "23505") redirect(`${LIST}?error=batch_code_exists`);
    throw new Error(batchError.message);
  }

  const items = payments.map((payment) => {
    const assignment = assignmentMap.get(payment.assignment_id);
    if (!assignment) throw new Error("ASSIGNMENT_NOT_FOUND");
    const influencer = influencerMap.get(assignment.influencer_id);
    const campaign = campaignMap.get(assignment.campaign_id);
    const profile = profileMap.get(assignment.influencer_id);
    if (!influencer || !campaign || !profile || profile.bank_profile_status !== "approved") throw new Error("PAYMENT_PROFILE_NOT_READY");

    const identity = digits(profile.identity_number || profile.national_id);
    const validIdentity = /^[127]\d{9}$/.test(identity);
    const transferMethod = validIdentity ? "bank_file" : "manual";
    const manualReason = validIdentity ? null : "رقم الهوية أو الإقامة أو السجل التجاري غير متوفر أو غير صالح";
    const due = numberValue(payment.remaining_amount) > 0
      ? numberValue(payment.remaining_amount)
      : Math.max(0, firstPositiveAmount(payment.effective_amount, payment.expected_amount, payment.amount) - numberValue(payment.paid_amount));
    return {
      batch_id: batch.id,
      payment_id: payment.id,
      assignment_id: payment.assignment_id,
      influencer_id: assignment.influencer_id,
      influencer_name: influencer.full_name,
      mobile: influencer.mobile_e164,
      campaign_name: campaign.name,
      brand_name: campaign.brand,
      bank_name: profile.bank_name,
      account_holder_name: profile.account_holder_name,
      iban: profile.iban,
      identity_type: profile.identity_type || (identity.startsWith("7") ? "commercial_registration" : identity.startsWith("2") ? "residency" : identity.startsWith("1") ? "national_id" : null),
      identity_number: identity || null,
      amount: due,
      contract_status: assignment.payment_timing === "before_publish" ? (assignment.has_contract ? "approved" : "pending") : "not_required",
      publication_url: publicationMap.get(payment.assignment_id) ?? null,
      transfer_method: transferMethod,
      manual_reason: manualReason,
      item_status: "pending",
    };
  });

  const { error: itemError } = await admin.from("payment_batch_items").insert(items);
  if (itemError) {
    await admin.from("payment_batches").delete().eq("id", batch.id);
    if (itemError.code === "23505") redirect(`${LIST}?error=payment_already_grouped`);
    throw new Error(itemError.message);
  }

  await admin.from("activity_logs").insert({
    actor_id: user.id,
    entity_type: "payment_batch",
    entity_id: batch.id,
    action: "payment_batch_created",
    metadata: { code: input.batchCode, item_count: items.length },
  });

  revalidatePath(LIST);
  redirect(`${LIST}/${batch.id}?success=created`);
}

export async function submitBatchForReview(formData: FormData) {
  const batchId = field(formData, "batch_id");
  const { user } = await requireRole(["admin", "finance"]);
  const admin = createAdminClient();
  const { error } = await admin.from("payment_batches").update({ status: "under_review", submitted_by: user.id, submitted_at: new Date().toISOString(), review_notes: null }).eq("id", batchId).in("status", ["draft", "returned"]);
  if (error) throw new Error(error.message);
  revalidatePath(`${LIST}/${batchId}`);
  redirect(`${LIST}/${batchId}?success=submitted`);
}

export async function reviewPaymentBatch(formData: FormData) {
  const batchId = field(formData, "batch_id");
  const decision = field(formData, "decision");
  const notes = field(formData, "notes").slice(0, 2500);
  if (!batchId || !["approve", "return", "reject"].includes(decision)) redirect(`${LIST}?error=invalid_review`);
  if (decision !== "approve" && !notes) redirect(`${LIST}/${batchId}?error=notes_required`);

  const session = await requireRole(["admin", "finance"]);
  const admin = createAdminClient();
  const { data: batch } = await admin.from("payment_batches").select("created_by,status").eq("id", batchId).maybeSingle();
  if (!batch) redirect(`${LIST}?error=batch_not_found`);
  if (batch.status !== "under_review") redirect(`${LIST}/${batchId}?error=batch_not_under_review`);
  if (session.profile.role !== "admin" && batch.created_by === session.user.id) redirect(`${LIST}/${batchId}?error=separation_of_duties`);

  const status = decision === "approve" ? "approved" : decision === "return" ? "returned" : "rejected";
  const { error } = await admin.from("payment_batches").update({
    status,
    reviewed_by: session.user.id,
    reviewed_at: new Date().toISOString(),
    review_notes: decision === "approve" ? null : notes,
  }).eq("id", batchId);
  if (error) throw new Error(error.message);

  if (decision === "reject") {
    await admin.from("payment_batch_items").update({ item_status: "cancelled", notes }).eq("batch_id", batchId);
  }

  revalidatePath(LIST);
  revalidatePath(`${LIST}/${batchId}`);
  redirect(`${LIST}/${batchId}?success=${decision}`);
}

export async function updateBatchExecutionStatus(formData: FormData) {
  const batchId = field(formData, "batch_id");
  const action = field(formData, "action");
  const { user } = await requireRole(["admin", "finance"]);
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const patch: Record<string, string> = {};
  if (action === "mark_exported") {
    patch.status = "exported";
    patch.exported_at = now;
  } else if (action === "submit_to_bank") {
    patch.status = "submitted_to_bank";
    patch.submitted_to_bank_at = now;
  } else if (action === "mark_processing") {
    patch.status = "processing";
  } else if (action === "complete") {
    patch.status = "completed";
    patch.completed_at = now;
  } else {
    redirect(`${LIST}/${batchId}?error=invalid_action`);
  }

  const { error } = await admin.from("payment_batches").update(patch).eq("id", batchId);
  if (error) throw new Error(error.message);

  if (action === "complete") {
    const { data: items } = await admin.from("payment_batch_items").select("payment_id,amount").eq("batch_id", batchId).neq("item_status", "cancelled");
    for (const item of items ?? []) {
      await admin.from("payments").update({ status: "paid", paid_amount: item.amount, paid_at: now, finance_batch_number: batchId, updated_at: now }).eq("id", item.payment_id);
    }
    await admin.from("payment_batch_items").update({ item_status: "paid", transferred_at: now }).eq("batch_id", batchId).neq("item_status", "cancelled");
  }

  await admin.from("activity_logs").insert({ actor_id: user.id, entity_type: "payment_batch", entity_id: batchId, action: `payment_batch_${action}`, metadata: {} });
  revalidatePath(`${LIST}/${batchId}`);
  revalidatePath(LIST);
  redirect(`${LIST}/${batchId}?success=${action}`);
}

export async function markTransferItemFailed(formData: FormData) {
  const itemId = field(formData, "item_id");
  const category = field(formData, "failure_category");
  const reason = field(formData, "failure_reason").slice(0, 2500);
  const bankReference = field(formData, "bank_response_reference").slice(0, 250);
  const batchId = field(formData, "batch_id");
  if (!itemId || !batchId || !category || !reason) redirect(`${LIST}/${batchId}?error=failure_details_required`);

  const { user } = await requireRole(["admin", "finance"]);
  const admin = createAdminClient();
  const { error } = await admin.rpc("mark_payment_batch_item_failed", {
    p_item_id: itemId,
    p_actor_id: user.id,
    p_failure_category: category,
    p_failure_reason: reason,
    p_bank_response_reference: bankReference || null,
  });
  if (error) redirect(`${LIST}/${batchId}?error=mark_failed_failed`);
  revalidatePath(`${LIST}/${batchId}`);
  revalidatePath(`${LIST}/returned`);
  redirect(`${LIST}/${batchId}?success=item_failed`);
}

export async function saveTransferProof(formData: FormData) {
  const itemId = field(formData, "item_id");
  const batchId = field(formData, "batch_id");
  const proofPath = field(formData, "proof_path").slice(0, 1000);
  const transferReference = field(formData, "transfer_reference").slice(0, 250);
  if (!itemId || !batchId || !proofPath) redirect(`${LIST}/${batchId}?error=proof_required`);

  const { user } = await requireRole(["admin", "finance"]);
  const admin = createAdminClient();
  const { error } = await admin.from("payment_batch_items").update({
    proof_path: proofPath,
    proof_uploaded_at: new Date().toISOString(),
    proof_uploaded_by: user.id,
    transfer_reference: transferReference || null,
  }).eq("id", itemId);
  if (error) throw new Error(error.message);
  revalidatePath(`${LIST}/${batchId}`);
  redirect(`${LIST}/${batchId}?success=proof_saved`);
}

export async function retryFailedTransfer(formData: FormData) {
  const failedItemId = field(formData, "failed_item_id");
  if (!failedItemId) redirect(`${LIST}/returned?error=invalid_item`);
  const { user } = await requireRole(["admin", "finance"]);
  const admin = createAdminClient();

  const { data: failed } = await admin.from("failed_transfer_items").select("*").eq("batch_item_id", failedItemId).maybeSingle();
  if (!failed || !failed.can_retry) redirect(`${LIST}/returned?error=not_retryable`);
  if (failed.failure_category === "bank_data" && failed.bank_profile_status !== "approved") {
    redirect(`${LIST}/returned?error=bank_profile_not_approved`);
  }

  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 12);
  const batchCode = `RETRY_${stamp}`;
  const { data: batch, error: batchError } = await admin.from("payment_batches").insert({
    name: `إعادة تحويل - ${failed.influencer_name}`,
    batch_code: batchCode,
    month_label: new Intl.DateTimeFormat("ar-SA", { month: "long", year: "numeric", timeZone: "Asia/Riyadh" }).format(new Date()),
    status: "draft",
    created_by: user.id,
    total_amount: failed.amount,
    item_count: 1,
    bank_file_count: 1,
    manual_count: 0,
  }).select("id").single();
  if (batchError || !batch) throw new Error(batchError?.message ?? "RETRY_BATCH_FAILED");

  const { data: source } = await admin.from("payment_batch_items").select("*").eq("id", failedItemId).single();
  if (!source) redirect(`${LIST}/returned?error=item_not_found`);
  const { data: newItem, error: itemError } = await admin.from("payment_batch_items").insert({
    batch_id: batch.id,
    payment_id: source.payment_id,
    assignment_id: source.assignment_id,
    influencer_id: source.influencer_id,
    influencer_name: source.influencer_name,
    mobile: source.mobile,
    campaign_name: source.campaign_name,
    brand_name: source.brand_name,
    bank_name: failed.bank_name,
    account_holder_name: failed.account_holder_name,
    iban: failed.iban,
    identity_type: source.identity_type,
    identity_number: source.identity_number,
    amount: source.amount,
    contract_status: source.contract_status,
    publication_url: source.publication_url,
    transfer_method: source.transfer_method,
    manual_reason: source.manual_reason,
    item_status: "pending",
    retry_of_item_id: failedItemId,
  }).select("id").single();
  if (itemError || !newItem) {
    await admin.from("payment_batches").delete().eq("id", batch.id);
    throw new Error(itemError?.message ?? "RETRY_ITEM_FAILED");
  }

  await admin.rpc("register_payment_batch_item_retry", {
    p_failed_item_id: failedItemId,
    p_new_batch_item_id: newItem.id,
    p_new_batch_id: batch.id,
    p_actor_id: user.id,
  });
  revalidatePath(`${LIST}/returned`);
  revalidatePath(LIST);
  redirect(`${LIST}/${batch.id}?success=retry_created`);
}
