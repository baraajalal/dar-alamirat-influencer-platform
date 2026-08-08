import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  normalizeExternalUrl,
  requireGuestSession,
  sanitizeFilename,
} from "@/lib/guest-portal/security";

export const runtime = "nodejs";

const MAX_PROOF_SIZE = 10 * 1024 * 1024;
const ALLOWED_PROOF_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
]);

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const token = String(formData.get("token") ?? "").trim();
    const contentItemId = String(formData.get("contentItemId") ?? "").trim();
    const platform = String(formData.get("platform") ?? "").trim().slice(0, 50);
    const postUrlInput = String(formData.get("postUrl") ?? "").trim();
    const postUrl = normalizeExternalUrl(postUrlInput);
    const publishedAtInput = String(formData.get("publishedAt") ?? "").trim();
    const notes = String(formData.get("notes") ?? "").trim().slice(0, 4000);
    const proofValue = formData.get("proof");
    const proof = proofValue instanceof File && proofValue.size > 0 ? proofValue : null;

    const session = await requireGuestSession(token);
    if (!session) {
      return NextResponse.json({ message: "انتهت جلسة الرابط. تحققي من رقم الجوال مرة أخرى." }, { status: 401 });
    }

    if (!contentItemId || !platform || !postUrl) {
      return NextResponse.json({ message: "حددي المنصة وأضيفي رابط النشر الصحيح." }, { status: 400 });
    }
    if (proof && proof.size > MAX_PROOF_SIZE) {
      return NextResponse.json({ message: "حجم إثبات النشر أكبر من 10MB." }, { status: 413 });
    }
    if (proof && !ALLOWED_PROOF_TYPES.has(proof.type)) {
      return NextResponse.json({ message: "إثبات النشر يجب أن يكون صورة أو PDF." }, { status: 415 });
    }

    const publishedAt = publishedAtInput ? new Date(publishedAtInput) : null;
    if (publishedAt && Number.isNaN(publishedAt.getTime())) {
      return NextResponse.json({ message: "تاريخ النشر غير صحيح." }, { status: 400 });
    }

    const { admin, assignmentId, link } = session;
    const { data: contentItem, error: itemError } = await admin
      .from("content_items")
      .select("id,status,assignment_platforms!inner(assignment_id)")
      .eq("id", contentItemId)
      .eq("assignment_platforms.assignment_id", assignmentId)
      .maybeSingle();

    if (itemError) throw new Error(itemError.message);
    if (!contentItem) {
      return NextResponse.json({ message: "عنصر المحتوى لا يتبع هذا التكليف." }, { status: 403 });
    }
    if (!["approved", "published"].includes(contentItem.status)) {
      return NextResponse.json({ message: "يجب اعتماد المحتوى أولًا قبل إرسال رابط النشر." }, { status: 409 });
    }

    let screenshotPath: string | null = null;
    if (proof) {
      const filename = sanitizeFilename(proof.name);
      screenshotPath = `${assignmentId}/${contentItemId}/${randomUUID()}-${filename}`;
      const bytes = new Uint8Array(await proof.arrayBuffer());
      const { error: uploadError } = await admin.storage
        .from("publication-proofs")
        .upload(screenshotPath, bytes, {
          contentType: proof.type,
          upsert: false,
          cacheControl: "3600",
        });
      if (uploadError) throw new Error(uploadError.message);
    }

    const { data: publication, error: publicationError } = await admin
      .from("publication_submissions")
      .insert({
        content_item_id: contentItemId,
        platform,
        post_url: postUrl,
        published_at: publishedAt?.toISOString() ?? null,
        screenshot_path: screenshotPath,
        submitter_notes: notes || null,
        status: "submitted",
      })
      .select("id")
      .single();

    if (publicationError) throw new Error(publicationError.message);

    const { data: assignment, error: assignmentError } = await admin
      .from("campaign_assignments")
      .select("id,influencer_id,influencers(id,user_id)")
      .eq("id", assignmentId)
      .maybeSingle();

    if (assignmentError) throw new Error(assignmentError.message);

    const { data: compensations, error: compensationsError } = await admin
      .from("assignment_compensations")
      .select("type")
      .eq("assignment_id", assignmentId);

    if (compensationsError) throw new Error(compensationsError.message);

    const hasBankTransfer = (compensations ?? []).some(
      (item: { type: string }) => item.type === "bank_transfer",
    );
    const influencerRelation = assignment?.influencers as unknown as {
      id: string;
      user_id: string | null;
    } | null;
    const hasAccount = Boolean(influencerRelation?.user_id);

    let bankProfileStatus = "incomplete";
    let bankConfirmed = false;

    if (hasBankTransfer && assignment?.influencer_id) {
      const { data: financialProfile, error: financialError } = await admin
        .from("influencer_financial_profiles")
        .select("bank_profile_status,influencer_confirmed_at")
        .eq("influencer_id", assignment.influencer_id)
        .maybeSingle();

      if (financialError) throw new Error(financialError.message);
      bankProfileStatus = financialProfile?.bank_profile_status ?? "incomplete";
      bankConfirmed = Boolean(financialProfile?.influencer_confirmed_at);

      const accountRequired =
        !hasAccount || bankProfileStatus !== "approved" || !bankConfirmed;

      if (accountRequired) {
        await admin
          .from("influencers")
          .update({
            portal_access_required: true,
            updated_at: new Date().toISOString(),
          })
          .eq("id", assignment.influencer_id);
      }
    }

    const accountCompletion = {
      required: hasBankTransfer,
      hasAccount,
      bankProfileStatus,
      bankConfirmed,
      shouldPrompt:
        hasBankTransfer &&
        (!hasAccount || bankProfileStatus !== "approved" || !bankConfirmed),
      completionPath: hasAccount
        ? `/portal/complete-account?token=${encodeURIComponent(token)}`
        : `/portal/activate-account?token=${encodeURIComponent(token)}`,
    };

    await admin.from("activity_logs").insert({
      actor_id: null,
      entity_type: "content_item",
      entity_id: contentItemId,
      action: "guest_publication_link_submitted",
      metadata: {
        submission_link_id: link.id,
        publication_submission_id: publication.id,
        platform,
        account_completion_required: accountCompletion.shouldPrompt,
      },
    });

    return NextResponse.json({
      success: true,
      message: "تم إرسال رابط النشر للمراجعة.",
      publicationId: publication.id,
      accountCompletion,
    });
  } catch (error) {
    console.error("Guest publication submission failed:", error);
    return NextResponse.json({ message: "تعذر إرسال رابط النشر حاليًا." }, { status: 500 });
  }
}
