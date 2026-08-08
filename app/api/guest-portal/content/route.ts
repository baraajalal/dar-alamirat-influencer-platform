import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import {
  normalizeExternalUrl,
  requireGuestSession,
  sanitizeFilename,
} from "@/lib/guest-portal/security";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "application/pdf",
]);

export async function POST(request: NextRequest) {
  let uploadedPath: string | null = null;

  try {
    const formData = await request.formData();
    const token = String(formData.get("token") ?? "").trim();
    const contentItemId = String(formData.get("contentItemId") ?? "").trim();
    const notes = String(formData.get("notes") ?? "").trim().slice(0, 4000);
    const externalInput = String(formData.get("externalUrl") ?? "").trim();
    const externalUrl = externalInput ? normalizeExternalUrl(externalInput) : null;
    const fileValue = formData.get("file");
    const file = fileValue instanceof File && fileValue.size > 0 ? fileValue : null;

    const session = await requireGuestSession(token);
    if (!session) {
      return NextResponse.json({ message: "انتهت جلسة الرابط. تحققي من رقم الجوال مرة أخرى." }, { status: 401 });
    }

    if (!contentItemId) {
      return NextResponse.json({ message: "عنصر المحتوى غير محدد." }, { status: 400 });
    }
    if (externalInput && !externalUrl) {
      return NextResponse.json({ message: "رابط الملف الخارجي غير صحيح." }, { status: 400 });
    }
    if (!file && !externalUrl) {
      return NextResponse.json({ message: "ارفعي ملفًا أو أضيفي رابطًا خارجيًا للمحتوى." }, { status: 400 });
    }
    if (file && file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ message: "حجم الملف أكبر من 50MB. استخدمي رابط Google Drive أو رابطًا خارجيًا." }, { status: 413 });
    }
    if (file && !ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ message: "نوع الملف غير مدعوم. المسموح صور، فيديو MP4/MOV/WebM أو PDF." }, { status: 415 });
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
    if (["approved", "published"].includes(contentItem.status)) {
      return NextResponse.json({ message: "هذا المحتوى معتمد ولا يمكن استبداله إلا بعد إعادة فتحه من الإدارة." }, { status: 409 });
    }

    const { data: latestVersion, error: latestError } = await admin
      .from("content_versions")
      .select("version_no")
      .eq("content_item_id", contentItemId)
      .order("version_no", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestError) throw new Error(latestError.message);
    const versionNo = Number(latestVersion?.version_no ?? 0) + 1;

    let originalFilename: string | null = null;
    let mimeType: string | null = null;
    let fileSizeBytes: number | null = null;

    if (file) {
      originalFilename = sanitizeFilename(file.name);
      mimeType = file.type;
      fileSizeBytes = file.size;
      uploadedPath = `${assignmentId}/${contentItemId}/v${versionNo}-${randomUUID()}-${originalFilename}`;
      const bytes = new Uint8Array(await file.arrayBuffer());
      const { error: uploadError } = await admin.storage
        .from("campaign-content")
        .upload(uploadedPath, bytes, {
          contentType: file.type,
          upsert: false,
          cacheControl: "3600",
        });
      if (uploadError) throw new Error(uploadError.message);
    }

    const { data: version, error: versionError } = await admin
      .from("content_versions")
      .insert({
        content_item_id: contentItemId,
        version_no: versionNo,
        file_path: uploadedPath,
        external_url: externalUrl,
        original_filename: originalFilename,
        mime_type: mimeType,
        file_size_bytes: fileSizeBytes,
        notes: notes || null,
        review_status: "submitted",
        submitted_via: "guest_link",
      })
      .select("id")
      .single();

    if (versionError) throw new Error(versionError.message);

    const now = new Date().toISOString();
    const [{ error: contentUpdateError }, { error: assignmentUpdateError }] = await Promise.all([
      admin
        .from("content_items")
        .update({
          latest_version_id: version.id,
          status: "submitted",
          submitted_at: now,
          approved_at: null,
        })
        .eq("id", contentItemId),
      admin
        .from("campaign_assignments")
        .update({ status: "under_review" })
        .eq("id", assignmentId)
        .not("status", "in", "(rejected,cancelled,closed)"),
    ]);

    if (contentUpdateError) throw new Error(contentUpdateError.message);
    if (assignmentUpdateError) throw new Error(assignmentUpdateError.message);

    await admin.from("activity_logs").insert({
      actor_id: null,
      entity_type: "content_item",
      entity_id: contentItemId,
      action: "guest_content_version_submitted",
      metadata: {
        submission_link_id: link.id,
        version_no: versionNo,
        has_file: Boolean(uploadedPath),
        has_external_url: Boolean(externalUrl),
      },
    });

    return NextResponse.json({
      success: true,
      message: `تم إرسال النسخة رقم ${versionNo} للمراجعة.`,
      versionId: version.id,
      versionNo,
    });
  } catch (error) {
    console.error("Guest content submission failed:", error);
    return NextResponse.json({ message: "تعذر رفع المحتوى حاليًا. حاولي مرة أخرى." }, { status: 500 });
  }
}
