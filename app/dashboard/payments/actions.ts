"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission, requireRole } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";

function paymentPath(paymentId: string) {
  return `/dashboard/payments/${paymentId}`;
}

function cleanId(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function redirectWith(paymentId: string, key: "success" | "error", value: string): never {
  redirect(`${paymentPath(paymentId)}?${key}=${encodeURIComponent(value)}`);
}

function mapRpcError(message: string) {
  const code = message.toUpperCase();
  if (code.includes("PUBLISH_LINK_REQUIRED")) return "publish_link_required";
  if (code.includes("CONTRACT_REQUIRED")) return "contract_required";
  if (code.includes("INFLUENCER_ACCOUNT_REQUIRED")) return "influencer_account_required";
  if (code.includes("BANK_PROFILE_REQUIRED")) return "bank_profile_required";
  if (code.includes("PAYMENT_NOT_AWAITING_APPROVAL")) return "not_awaiting_approval";
  if (code.includes("PAYMENT_NOT_READY")) return "not_ready";
  if (code.includes("AMOUNT_EXCEEDS_REMAINING")) return "amount_exceeds_remaining";
  if (code.includes("TRANSFER_REFERENCE_REQUIRED")) return "transfer_reference_required";
  if (code.includes("REASON_REQUIRED")) return "reason_required";
  if (code.includes("DUPLICATE") || code.includes("23505")) return "duplicate_reference";
  return "operation_failed";
}

export async function submitPaymentForApproval(formData: FormData) {
  const paymentId = cleanId(formData.get("payment_id"));
  if (!paymentId) redirect("/dashboard/payments?error=missing_payment");

  const { supabase } = await requireRole(["admin", "coordinator", "finance"]);
  const { error } = await supabase.rpc("submit_payment_for_approval", {
    p_payment_id: paymentId,
  });

  if (error) redirectWith(paymentId, "error", mapRpcError(error.message));

  revalidatePath("/dashboard/payments");
  revalidatePath(paymentPath(paymentId));
  redirectWith(paymentId, "success", "submitted");
}

const reviewSchema = z.object({
  paymentId: z.string().uuid(),
  decision: z.enum(["approve", "return", "reject"]),
  reason: z.string().trim().max(2000).optional().default(""),
});

export async function reviewPayment(formData: FormData) {
  const parsed = reviewSchema.safeParse({
    paymentId: cleanId(formData.get("payment_id")),
    decision: cleanId(formData.get("decision")),
    reason: cleanId(formData.get("reason")),
  });

  if (!parsed.success) redirect("/dashboard/payments?error=invalid_review");
  const { paymentId, decision, reason } = parsed.data;
  const { supabase } = await requirePermission("payments", "approve");

  const { error } = await supabase.rpc("review_payment_request", {
    p_payment_id: paymentId,
    p_decision: decision,
    p_reason: reason || null,
  });

  if (error) redirectWith(paymentId, "error", mapRpcError(error.message));

  revalidatePath("/dashboard/payments");
  revalidatePath(paymentPath(paymentId));
  redirectWith(paymentId, "success", decision);
}

const transferSchema = z.object({
  paymentId: z.string().uuid(),
  amount: z.coerce.number().positive().max(999999999),
  transferredAt: z.string().trim().min(1),
  reference: z.string().trim().min(2).max(180),
  batch: z.string().trim().max(180).optional().default(""),
  sourceBank: z.string().trim().max(180).optional().default(""),
  notes: z.string().trim().max(3000).optional().default(""),
});

function toSaudiIso(value: string) {
  if (/Z$|[+-]\d{2}:\d{2}$/.test(value)) return value;
  return `${value.length === 16 ? `${value}:00` : value}+03:00`;
}

function safeFilename(name: string) {
  const parts = name.split(".");
  const extension = parts.length > 1 ? parts.pop()?.toLowerCase() : "";
  const safeExtension = extension && /^[a-z0-9]{1,8}$/.test(extension) ? `.${extension}` : "";
  return `${randomUUID()}${safeExtension}`;
}

export async function recordBankTransfer(formData: FormData) {
  const parsed = transferSchema.safeParse({
    paymentId: cleanId(formData.get("payment_id")),
    amount: cleanId(formData.get("amount")),
    transferredAt: cleanId(formData.get("transferred_at")),
    reference: cleanId(formData.get("transfer_reference")),
    batch: cleanId(formData.get("batch_number")),
    sourceBank: cleanId(formData.get("source_bank")),
    notes: cleanId(formData.get("notes")),
  });

  if (!parsed.success) {
    const paymentId = cleanId(formData.get("payment_id"));
    if (paymentId) redirectWith(paymentId, "error", "invalid_transfer");
    redirect("/dashboard/payments?error=invalid_transfer");
  }

  const value = parsed.data;
  const { supabase } = await requirePermission("payments", "pay");
  const admin = createAdminClient();
  const file = formData.get("proof");
  let proofPath: string | null = null;

  if (file instanceof File && file.size > 0) {
    const allowed = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp"]);
    if (!allowed.has(file.type) || file.size > 10 * 1024 * 1024) {
      redirectWith(value.paymentId, "error", "invalid_proof");
    }

    proofPath = `${value.paymentId}/${safeFilename(file.name)}`;
    const { error: uploadError } = await admin.storage
      .from("payment-proofs")
      .upload(proofPath, await file.arrayBuffer(), {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) redirectWith(value.paymentId, "error", "proof_upload_failed");
  }

  const { error } = await supabase.rpc("record_bank_payment", {
    p_payment_id: value.paymentId,
    p_amount: value.amount,
    p_transferred_at: toSaudiIso(value.transferredAt),
    p_transfer_reference: value.reference,
    p_batch_number: value.batch || null,
    p_source_bank: value.sourceBank || null,
    p_proof_path: proofPath,
    p_notes: value.notes || null,
  });

  if (error) {
    if (proofPath) await admin.storage.from("payment-proofs").remove([proofPath]);
    redirectWith(value.paymentId, "error", mapRpcError(error.message));
  }

  revalidatePath("/dashboard/payments");
  revalidatePath(paymentPath(value.paymentId));
  redirectWith(value.paymentId, "success", "transfer_recorded");
}

const fulfillmentSchema = z.object({
  paymentId: z.string().uuid(),
  status: z.string().trim().min(1).max(40),
  code: z.string().trim().max(300).optional().default(""),
  notes: z.string().trim().max(3000).optional().default(""),
});

export async function updatePaymentFulfillment(formData: FormData) {
  const parsed = fulfillmentSchema.safeParse({
    paymentId: cleanId(formData.get("payment_id")),
    status: cleanId(formData.get("status")),
    code: cleanId(formData.get("code")),
    notes: cleanId(formData.get("notes")),
  });

  if (!parsed.success) redirect("/dashboard/payments?error=invalid_fulfillment");
  const value = parsed.data;
  const { supabase } = await requirePermission("payments", "pay");

  const { error } = await supabase.rpc("update_payment_fulfillment", {
    p_payment_id: value.paymentId,
    p_status: value.status,
    p_code: value.code || null,
    p_notes: value.notes || null,
  });

  if (error) redirectWith(value.paymentId, "error", mapRpcError(error.message));

  revalidatePath("/dashboard/payments");
  revalidatePath(paymentPath(value.paymentId));
  redirectWith(value.paymentId, "success", "fulfillment_updated");
}
