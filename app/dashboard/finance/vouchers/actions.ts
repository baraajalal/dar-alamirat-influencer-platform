"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";

const PAGE = "/dashboard/finance/vouchers";

function field(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function addDaysIso(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString();
}

const transferSchema = z.object({
  issueIds: z.array(z.string().uuid()).min(1),
});

export async function transferWebsiteVouchers(formData: FormData) {
  const parsed = transferSchema.safeParse({
    issueIds: formData.getAll("issue_ids").map(String),
  });
  if (!parsed.success) redirect(`${PAGE}?stage=approval&error=select_vouchers`);

  const { user } = await requireRole(["admin", "finance"]);
  const admin = createAdminClient();
  const ids = parsed.data.issueIds;
  const now = new Date().toISOString();

  const { data: eligible, error: eligibleError } = await admin
    .from("voucher_issues")
    .select("id")
    .in("id", ids)
    .eq("source_type", "website")
    .eq("status", "pending");

  if (eligibleError) throw new Error(eligibleError.message);
  if (!eligible || eligible.length !== ids.length) {
    redirect(`${PAGE}?stage=approval&error=website_only`);
  }

  const { error } = await admin
    .from("voucher_issues")
    .update({ status: "preparing", transferred_to_preparation_at: now })
    .in("id", ids)
    .eq("source_type", "website")
    .eq("status", "pending");
  if (error) throw new Error(error.message);

  await admin.from("activity_logs").insert(
    ids.map((id) => ({
      actor_id: user.id,
      entity_type: "voucher_issue",
      entity_id: id,
      action: "voucher_transferred_to_preparation",
      metadata: { source_type: "website" },
    })),
  );

  revalidatePath(PAGE);
  redirect(`${PAGE}?stage=preparation&success=transferred`);
}

const preparationSchema = z.object({
  issueId: z.string().uuid(),
  status: z.enum(["preparing", "ready", "sent", "redeemed", "cancelled"]),
  code: z.string().max(200).default(""),
  notes: z.string().max(2500).default(""),
});

export async function updateVoucherPreparation(formData: FormData) {
  const parsed = preparationSchema.safeParse({
    issueId: field(formData, "issue_id"),
    status: field(formData, "status"),
    code: field(formData, "voucher_code"),
    notes: field(formData, "notes"),
  });
  if (!parsed.success) redirect(`${PAGE}?stage=preparation&error=invalid_voucher`);

  const { user } = await requireRole(["admin", "finance"]);
  const admin = createAdminClient();
  const input = parsed.data;
  const nowDate = new Date();
  const now = nowDate.toISOString();

  const { data: issue, error: issueError } = await admin
    .from("voucher_issues")
    .select("payment_id,influencer_id,source_type,status,voucher_code,code_prepared_at,expires_at")
    .eq("id", input.issueId)
    .maybeSingle();
  if (issueError || !issue) redirect(`${PAGE}?stage=preparation&error=voucher_not_found`);
  if (issue.source_type !== "website") redirect(`${PAGE}?stage=preparation&error=website_only`);

  const code = input.code || issue.voucher_code || "";
  if (["ready", "sent", "redeemed"].includes(input.status) && !code) {
    redirect(`${PAGE}?stage=preparation&error=code_required`);
  }

  const firstCodePreparation = Boolean(code && !issue.code_prepared_at);
  const expiresAt = firstCodePreparation ? addDaysIso(nowDate, 30) : issue.expires_at;
  if (input.status === "sent" && expiresAt && new Date(expiresAt).getTime() <= nowDate.getTime()) {
    redirect(`${PAGE}?stage=preparation&error=voucher_expired`);
  }

  const patch: Record<string, string | null> = {
    status: input.status,
    voucher_code: code || null,
    notes: input.notes || null,
  };
  if (firstCodePreparation) {
    patch.code_prepared_at = now;
    patch.expires_at = expiresAt;
  }
  if (input.status === "sent") patch.sent_at = now;
  if (input.status === "redeemed") patch.redeemed_at = now;

  const { error } = await admin.from("voucher_issues").update(patch).eq("id", input.issueId);
  if (error) throw new Error(error.message);

  const paymentPatch: Record<string, string | null> = {
    voucher_status: input.status,
    voucher_code: code || null,
    finance_notes: input.notes || null,
    updated_at: now,
  };
  if (input.status === "sent") paymentPatch.voucher_delivered_at = now;
  if (input.status === "redeemed") {
    paymentPatch.status = "paid";
    paymentPatch.paid_at = now;
  }
  await admin.from("payments").update(paymentPatch).eq("id", issue.payment_id);

  if (input.status === "sent") {
    await admin.from("influencer_notifications").insert({
      influencer_id: issue.influencer_id,
      type: "voucher_status",
      title: "تم إرسال القسيمة الإلكترونية",
      body: `كود القسيمة: ${code}`,
      action_url: "/portal/payments",
      metadata: { voucher_issue_id: input.issueId, status: input.status },
    });
  }

  await admin.from("activity_logs").insert({
    actor_id: user.id,
    entity_type: "voucher_issue",
    entity_id: input.issueId,
    action: `voucher_${input.status}`,
    metadata: { voucher_code: code || null, expires_at: expiresAt },
  });

  revalidatePath(PAGE);
  redirect(`${PAGE}?stage=preparation&success=updated`);
}
