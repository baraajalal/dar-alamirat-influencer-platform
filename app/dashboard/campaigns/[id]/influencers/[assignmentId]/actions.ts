"use server";

import { createHash, randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";

function hashToken(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function rawToken() {
  return randomBytes(32).toString("base64url");
}

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function detailsPath(campaignId: string, assignmentId: string, query?: string) {
  return `/dashboard/campaigns/${campaignId}/influencers/${assignmentId}${query ? `?${query}` : ""}`;
}

async function verifyAssignment(
  supabase: Awaited<ReturnType<typeof requirePermission>>["supabase"],
  campaignId: string,
  assignmentId: string,
) {
  const { data, error } = await supabase
    .from("campaign_assignments")
    .select("id,campaign_id")
    .eq("id", assignmentId)
    .eq("campaign_id", campaignId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("ASSIGNMENT_NOT_FOUND");
}

export async function createGuestLink(formData: FormData) {
  const { profile, supabase } = await requirePermission("campaigns", "update");
  const campaignId = text(formData, "campaign_id");
  const assignmentId = text(formData, "assignment_id");
  const requestedDays = Number(text(formData, "expires_days") || "14");
  const expiresDays = Math.min(60, Math.max(1, Number.isFinite(requestedDays) ? requestedDays : 14));

  await verifyAssignment(supabase, campaignId, assignmentId);

  const now = new Date().toISOString();
  const { error: revokeError } = await supabase
    .from("submission_links")
    .update({ is_active: false, revoked_at: now, revoked_by: profile.id })
    .eq("assignment_id", assignmentId)
    .eq("is_active", true);
  if (revokeError) throw new Error(revokeError.message);

  const token = rawToken();
  const expiresAt = new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000).toISOString();
  const { data: link, error } = await supabase
    .from("submission_links")
    .insert({
      assignment_id: assignmentId,
      token_hash: hashToken(token),
      expires_at: expiresAt,
      is_active: true,
      created_by: profile.id,
      failed_attempts: 0,
      locked_at: null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await supabase.from("activity_logs").insert({
    actor_id: profile.id,
    entity_type: "campaign_assignment",
    entity_id: assignmentId,
    action: "guest_submission_link_created",
    metadata: { submission_link_id: link.id, expires_at: expiresAt },
  });

  revalidatePath(detailsPath(campaignId, assignmentId));
  redirect(detailsPath(campaignId, assignmentId, `new_token=${encodeURIComponent(token)}&link_created=1`));
}

export async function revokeGuestLinks(formData: FormData) {
  const { profile, supabase } = await requirePermission("campaigns", "update");
  const campaignId = text(formData, "campaign_id");
  const assignmentId = text(formData, "assignment_id");
  await verifyAssignment(supabase, campaignId, assignmentId);

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("submission_links")
    .update({ is_active: false, revoked_at: now, revoked_by: profile.id })
    .eq("assignment_id", assignmentId)
    .eq("is_active", true);
  if (error) throw new Error(error.message);

  await supabase.from("activity_logs").insert({
    actor_id: profile.id,
    entity_type: "campaign_assignment",
    entity_id: assignmentId,
    action: "guest_submission_links_revoked",
    metadata: {},
  });

  revalidatePath(detailsPath(campaignId, assignmentId));
  redirect(detailsPath(campaignId, assignmentId, "link_revoked=1"));
}

export async function reviewContentItem(formData: FormData) {
  const { profile } = await requirePermission("content", "approve");
  const supabase = createAdminClient();
  const campaignId = text(formData, "campaign_id");
  const assignmentId = text(formData, "assignment_id");
  const contentItemId = text(formData, "content_item_id");
  const decision = text(formData, "decision");
  const notes = text(formData, "notes");
  const suitableForAds = text(formData, "suitable_for_ads") === "yes";

  if (!["approve", "needs_changes", "reject"].includes(decision)) throw new Error("INVALID_DECISION");
  if (decision !== "approve" && !notes) {
    redirect(detailsPath(campaignId, assignmentId, "content_review_error=notes_required"));
  }

  await verifyAssignment(supabase, campaignId, assignmentId);

  const { data: item, error: itemError } = await supabase
    .from("content_items")
    .select("id,latest_version_id,assignment_platforms!inner(assignment_id)")
    .eq("id", contentItemId)
    .eq("assignment_platforms.assignment_id", assignmentId)
    .maybeSingle();
  if (itemError) throw new Error(itemError.message);
  if (!item) throw new Error("CONTENT_ITEM_NOT_FOUND");

  const { error: reviewError } = await supabase.from("content_reviews").insert({
    content_item_id: contentItemId,
    reviewer_id: profile.id,
    decision,
    suitable_for_ads: decision === "approve" ? suitableForAds : false,
    notes: notes || null,
  });
  if (reviewError) throw new Error(reviewError.message);

  const status = decision === "approve" ? "approved" : decision === "needs_changes" ? "needs_changes" : "rejected";
  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("content_items")
    .update({
      status,
      approved_at: decision === "approve" ? now : null,
      can_reuse_in_ads: decision === "approve" ? suitableForAds : null,
    })
    .eq("id", contentItemId);
  if (updateError) throw new Error(updateError.message);

  if (item.latest_version_id) {
    const { error: versionError } = await supabase
      .from("content_versions")
      .update({ review_status: decision === "approve" ? "approved" : decision === "needs_changes" ? "needs_changes" : "rejected" })
      .eq("id", item.latest_version_id);
    if (versionError) throw new Error(versionError.message);
  }

  if (decision === "approve") {
    const { data: assignmentItems, error: allError } = await supabase
      .from("content_items")
      .select("id,status,assignment_platforms!inner(assignment_id)")
      .eq("assignment_platforms.assignment_id", assignmentId);
    if (allError) throw new Error(allError.message);
    const statusRows = (assignmentItems ?? []) as Array<{ status: string }>;
    const allApproved = statusRows.every((row) => ["approved", "published"].includes(row.status));
    await supabase
      .from("campaign_assignments")
      .update({ status: allApproved ? "approved" : "under_review" })
      .eq("id", assignmentId);
  } else {
    await supabase.from("campaign_assignments").update({ status: "needs_changes" }).eq("id", assignmentId);
  }

  await supabase.from("activity_logs").insert({
    actor_id: profile.id,
    entity_type: "content_item",
    entity_id: contentItemId,
    action: "content_reviewed",
    metadata: { decision, notes },
  });

  revalidatePath(detailsPath(campaignId, assignmentId));
  revalidatePath(`/dashboard/campaigns/${campaignId}`);
  redirect(detailsPath(campaignId, assignmentId, `content_reviewed=${decision}`));
}

export async function reviewPublication(formData: FormData) {
  const { profile } = await requirePermission("content", "approve");
  const supabase = createAdminClient();
  const campaignId = text(formData, "campaign_id");
  const assignmentId = text(formData, "assignment_id");
  const publicationId = text(formData, "publication_id");
  const decision = text(formData, "decision");
  const notes = text(formData, "notes");

  if (!["approve", "needs_changes", "reject"].includes(decision)) throw new Error("INVALID_DECISION");
  if (decision !== "approve" && !notes) {
    redirect(detailsPath(campaignId, assignmentId, "publication_review_error=notes_required"));
  }

  await verifyAssignment(supabase, campaignId, assignmentId);

  const { data: publication, error: publicationError } = await supabase
    .from("publication_submissions")
    .select("id,content_item_id,post_url,published_at")
    .eq("id", publicationId)
    .maybeSingle();
  if (publicationError) throw new Error(publicationError.message);
  if (!publication) throw new Error("PUBLICATION_NOT_FOUND");

  const { data: publicationItem, error: publicationItemError } = await supabase
    .from("content_items")
    .select("id,assignment_platforms!inner(assignment_id)")
    .eq("id", publication.content_item_id)
    .eq("assignment_platforms.assignment_id", assignmentId)
    .maybeSingle();
  if (publicationItemError) throw new Error(publicationItemError.message);
  if (!publicationItem) throw new Error("PUBLICATION_NOT_FOUND");

  const status = decision === "approve" ? "approved" : decision === "needs_changes" ? "needs_changes" : "rejected";
  const now = new Date().toISOString();
  const { error: updatePublicationError } = await supabase
    .from("publication_submissions")
    .update({
      status,
      reviewer_id: profile.id,
      reviewed_at: now,
      review_notes: notes || null,
    })
    .eq("id", publicationId);
  if (updatePublicationError) throw new Error(updatePublicationError.message);

  if (decision === "approve") {
    const { error: itemUpdateError } = await supabase
      .from("content_items")
      .update({
        post_url: publication.post_url,
        status: "published",
        publication_verified_at: now,
        publication_verified_by: profile.id,
      })
      .eq("id", publication.content_item_id);
    if (itemUpdateError) throw new Error(itemUpdateError.message);

    const { data: assignmentItems, error: allError } = await supabase
      .from("content_items")
      .select("id,status,assignment_platforms!inner(assignment_id)")
      .eq("assignment_platforms.assignment_id", assignmentId);
    if (allError) throw new Error(allError.message);
    const statusRows = (assignmentItems ?? []) as Array<{ status: string }>;
    const allPublished = statusRows.every((row) => row.status === "published");
    await supabase
      .from("campaign_assignments")
      .update({ status: allPublished ? "payment_pending" : "approved" })
      .eq("id", assignmentId);
  } else {
    await supabase.from("campaign_assignments").update({ status: "approved" }).eq("id", assignmentId);
  }

  await supabase.from("activity_logs").insert({
    actor_id: profile.id,
    entity_type: "content_item",
    entity_id: publication.content_item_id,
    action: "publication_link_reviewed",
    metadata: { publication_submission_id: publicationId, decision, notes },
  });

  revalidatePath(detailsPath(campaignId, assignmentId));
  revalidatePath(`/dashboard/campaigns/${campaignId}`);
  revalidatePath("/dashboard/payments");
  redirect(detailsPath(campaignId, assignmentId, `publication_reviewed=${decision}`));
}

export async function liftAssignmentExclusivity(formData: FormData) {
  const { supabase } = await requirePermission("campaigns", "manage");
  const campaignId = text(formData, "campaign_id");
  const assignmentId = text(formData, "assignment_id");
  const reason = text(formData, "reason");

  if (!campaignId || !assignmentId) throw new Error("ASSIGNMENT_NOT_FOUND");
  if (reason.length < 5) {
    redirect(detailsPath(campaignId, assignmentId, "exclusivity_error=reason_required"));
  }

  await verifyAssignment(supabase, campaignId, assignmentId);

  const { error } = await supabase.rpc("lift_assignment_exclusivity", {
    p_assignment_id: assignmentId,
    p_reason: reason,
  });

  if (error) {
    const code = String(error.message || "").includes("ADMIN_ONLY")
      ? "admin_only"
      : String(error.message || "").includes("REASON_REQUIRED")
        ? "reason_required"
        : "lift_failed";
    redirect(detailsPath(campaignId, assignmentId, `exclusivity_error=${code}`));
  }

  revalidatePath(detailsPath(campaignId, assignmentId));
  revalidatePath(`/dashboard/campaigns/${campaignId}`);
  revalidatePath("/dashboard/campaigns");
  revalidatePath("/portal/campaigns");
  redirect(detailsPath(campaignId, assignmentId, "exclusivity_lifted=1"));
}

export async function updateAssignmentExecutionWorkflow(formData: FormData) {
  const { supabase } = await requirePermission("campaigns", "update");
  const campaignId = text(formData, "campaign_id");
  const assignmentId = text(formData, "assignment_id");
  const workflowAction = text(formData, "workflow_action");
  const briefOverride = text(formData, "brief_override");
  const notes = text(formData, "notes");
  const contentDueRaw = text(formData, "content_due_at");
  const publishingDate = text(formData, "publishing_date");
  const productRequiredRaw = text(formData, "product_required");

  if (!campaignId || !assignmentId || !workflowAction) throw new Error("INVALID_WORKFLOW_REQUEST");
  await verifyAssignment(supabase, campaignId, assignmentId);

  const contentDueAt = contentDueRaw
    ? new Date(`${contentDueRaw}:00+03:00`).toISOString()
    : null;
  const productRequired = productRequiredRaw === "true"
    ? true
    : productRequiredRaw === "false"
      ? false
      : null;

  const { error } = await supabase.rpc("update_assignment_execution_workflow", {
    p_assignment_id: assignmentId,
    p_action: workflowAction,
    p_brief_override: briefOverride || null,
    p_notes: notes || null,
    p_content_due_at: contentDueAt,
    p_publishing_date: publishingDate || null,
    p_product_required: productRequired,
  });

  if (error) {
    const message = String(error.message || "");
    const code = message.includes("ACCEPTANCE_REQUIRED")
      ? "acceptance_required"
      : message.includes("BRIEF_REQUIRED")
        ? "brief_required"
        : message.includes("PRODUCT_RECEIPT_REQUIRED")
          ? "product_required"
          : message.includes("INVALID_WORKFLOW_TRANSITION")
            ? "invalid_transition"
            : "update_failed";
    redirect(detailsPath(campaignId, assignmentId, `workflow_error=${code}`));
  }

  revalidatePath(detailsPath(campaignId, assignmentId));
  revalidatePath(`/dashboard/campaigns/${campaignId}`);
  revalidatePath("/dashboard/campaigns/assignments");
  revalidatePath("/portal/campaigns");
  redirect(detailsPath(campaignId, assignmentId, `workflow_updated=${encodeURIComponent(workflowAction)}`));
}

export async function setAssignmentAttention(formData: FormData) {
  const { supabase } = await requirePermission("campaigns", "update");
  const campaignId = text(formData, "campaign_id");
  const assignmentId = text(formData, "assignment_id");
  const attention = text(formData, "attention") === "true";
  const reason = text(formData, "reason");

  if (!campaignId || !assignmentId) throw new Error("INVALID_ATTENTION_REQUEST");
  if (attention && !reason) {
    redirect(detailsPath(campaignId, assignmentId, "attention_error=reason_required"));
  }

  await verifyAssignment(supabase, campaignId, assignmentId);
  const { error } = await supabase.rpc("set_assignment_attention", {
    p_assignment_id: assignmentId,
    p_attention: attention,
    p_reason: attention ? reason : null,
  });
  if (error) throw new Error(error.message);

  revalidatePath(detailsPath(campaignId, assignmentId));
  revalidatePath("/dashboard");
  redirect(detailsPath(campaignId, assignmentId, "attention_updated=1"));
}
