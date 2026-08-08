import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CERTIFICATE_SIZE = 10 * 1024 * 1024;
const ALLOWED_CERTIFICATE_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

type FinancialProfileRow = {
  influencer_id: string;
  national_id: string | null;
  identity_type: string | null;
  identity_number: string | null;
  bank_name: string | null;
  iban: string | null;
  iban_last4: string | null;
  account_holder_name: string | null;
  bank_profile_status: string;
  influencer_confirmed_at: string | null;
  finance_reviewed_at: string | null;
  finance_review_notes: string | null;
  iban_certificate_path: string | null;
};

type BankRequestRow = {
  id: string;
  bank_name: string;
  iban_last4: string;
  account_holder_name: string;
  national_id: string | null;
  identity_type: string | null;
  identity_number: string | null;
  status: string;
  submitted_at: string;
  review_notes: string | null;
};

function normalizeIban(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

function maskIban(value: string | null, fallbackLast4?: string | null) {
  const normalized = normalizeIban(value ?? "");
  const last4 = normalized.slice(-4) || fallbackLast4 || "••••";
  return `SA•• •••• •••• •••• ••${last4}`;
}

function normalizeDigits(value: string | null | undefined) {
  const arabic = "٠١٢٣٤٥٦٧٨٩";
  const persian = "۰۱۲۳۴۵۶۷۸۹";
  return String(value ?? "")
    .replace(/[٠-٩]/g, (digit) => String(arabic.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String(persian.indexOf(digit)))
    .replace(/\D/g, "");
}

function maskIdentity(value: string | null) {
  const digits = normalizeDigits(value);
  if (!digits) return "غير مضاف";
  return `${"•".repeat(Math.max(6, digits.length - 4))}${digits.slice(-4)}`;
}

function maskName(value: string | null) {
  const text = value?.trim() ?? "";
  if (!text) return "غير مضاف";
  return text
    .split(/\s+/)
    .map((part) => (part.length <= 2 ? `${part[0] ?? ""}•` : `${part[0]}${"•".repeat(Math.min(5, part.length - 1))}`))
    .join(" ");
}

function sanitizeFilename(value: string) {
  const cleaned = value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
  return cleaned.slice(0, 120) || "bank-certificate";
}

async function getAuthenticatedInfluencer(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return null;

  const admin = createAdminClient();
  const { data: influencer, error: influencerError } = await admin
    .from("influencers")
    .select("id,full_name,mobile_e164,user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (influencerError) throw new Error(influencerError.message);
  if (!influencer) return null;

  const assignmentId = request.nextUrl.searchParams.get("assignment")?.trim() ?? "";
  if (assignmentId) {
    const { data: assignment, error: assignmentError } = await admin
      .from("campaign_assignments")
      .select("id")
      .eq("id", assignmentId)
      .eq("influencer_id", influencer.id)
      .maybeSingle();

    if (assignmentError) throw new Error(assignmentError.message);
    if (!assignment) throw new Error("ASSIGNMENT_ACCESS_DENIED");
  }

  return { admin, user, influencer, assignmentId };
}

export async function GET(request: NextRequest) {
  try {
    const session = await getAuthenticatedInfluencer(request);
    if (!session) {
      return NextResponse.json({ message: "يجب تسجيل الدخول بحساب المؤثر." }, { status: 401 });
    }

    const { admin, influencer, assignmentId } = session;
    const [{ data: financial, error: financialError }, { data: pending, error: pendingError }] = await Promise.all([
      admin
        .from("influencer_financial_profiles")
        .select("influencer_id,national_id,identity_type,identity_number,bank_name,iban,iban_last4,account_holder_name,bank_profile_status,influencer_confirmed_at,finance_reviewed_at,finance_review_notes,iban_certificate_path")
        .eq("influencer_id", influencer.id)
        .maybeSingle(),
      admin
        .from("influencer_bank_update_requests")
        .select("id,bank_name,iban_last4,account_holder_name,national_id,identity_type,identity_number,status,submitted_at,review_notes")
        .eq("influencer_id", influencer.id)
        .eq("status", "pending")
        .order("submitted_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (financialError) throw new Error(financialError.message);
    if (pendingError) throw new Error(pendingError.message);

    const profile = financial as FinancialProfileRow | null;
    const pendingRequest = pending as BankRequestRow | null;
    const hasDetails = Boolean(
      profile?.bank_name && profile?.account_holder_name && normalizeIban(profile?.iban ?? "").match(/^SA\d{22}$/),
    );

    return NextResponse.json({
      success: true,
      influencer: {
        id: influencer.id,
        fullName: influencer.full_name,
      },
      assignmentId,
      profile: {
        status: profile?.bank_profile_status ?? "incomplete",
        hasDetails,
        bankName: profile?.bank_name ?? "غير مضاف",
        accountHolderMasked: maskName(profile?.account_holder_name ?? null),
        ibanMasked: maskIban(profile?.iban ?? null, profile?.iban_last4 ?? null),
        identityType: profile?.identity_type ?? null,
        identityMasked: maskIdentity(profile?.identity_number ?? profile?.national_id ?? null),
        certificateUploaded: Boolean(profile?.iban_certificate_path),
        confirmedAt: profile?.influencer_confirmed_at ?? null,
        reviewedAt: profile?.finance_reviewed_at ?? null,
        reviewNotes: profile?.finance_review_notes ?? null,
      },
      pendingRequest: pendingRequest
        ? {
            id: pendingRequest.id,
            bankName: pendingRequest.bank_name,
            accountHolderMasked: maskName(pendingRequest.account_holder_name),
            ibanMasked: maskIban(null, pendingRequest.iban_last4),
            identityType: pendingRequest.identity_type ?? null,
            identityMasked: maskIdentity(pendingRequest.identity_number ?? pendingRequest.national_id),
            status: pendingRequest.status,
            submittedAt: pendingRequest.submitted_at,
            reviewNotes: pendingRequest.review_notes,
          }
        : null,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "ASSIGNMENT_ACCESS_DENIED") {
      return NextResponse.json({ message: "هذا التكليف غير مربوط بحسابك." }, { status: 403 });
    }
    console.error("Influencer payment profile load failed:", error);
    return NextResponse.json({ message: "تعذر تحميل بيانات الدفع حاليًا." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthenticatedInfluencer(request);
    if (!session) {
      return NextResponse.json({ message: "يجب تسجيل الدخول بحساب المؤثر." }, { status: 401 });
    }

    const { admin, user, influencer } = session;
    const formData = await request.formData();
    const action = String(formData.get("action") ?? "").trim();

    if (action === "confirm") {
      const { data: financial, error: financialError } = await admin
        .from("influencer_financial_profiles")
        .select("bank_name,iban,account_holder_name,bank_profile_status")
        .eq("influencer_id", influencer.id)
        .maybeSingle();

      if (financialError) throw new Error(financialError.message);

      const iban = normalizeIban(financial?.iban ?? "");
      const complete = Boolean(
        financial?.bank_name && financial?.account_holder_name && /^SA\d{22}$/.test(iban),
      );

      if (!complete) {
        return NextResponse.json(
          { message: "بيانات البنك غير مكتملة. استخدمي خيار تحديث بيانات البنك." },
          { status: 409 },
        );
      }

      const nextStatus = financial?.bank_profile_status === "approved" ? "approved" : "pending_review";
      const now = new Date().toISOString();
      const { error: updateError } = await admin
        .from("influencer_financial_profiles")
        .update({
          iban_last4: iban.slice(-4),
          influencer_confirmed_at: now,
          bank_profile_status: nextStatus,
          finance_review_notes: null,
          updated_at: now,
        })
        .eq("influencer_id", influencer.id);

      if (updateError) throw new Error(updateError.message);

      await admin.from("activity_logs").insert({
        actor_id: user.id,
        entity_type: "influencer",
        entity_id: influencer.id,
        action: "bank_profile_confirmed_by_influencer",
        metadata: { status: nextStatus },
      });

      return NextResponse.json({
        success: true,
        message:
          nextStatus === "approved"
            ? "تم تأكيد بيانات البنك بنجاح."
            : "تم تأكيد البيانات وإرسالها لمراجعة المالية.",
      });
    }

    if (action !== "update") {
      return NextResponse.json({ message: "الإجراء غير صحيح." }, { status: 400 });
    }

    const bankName = String(formData.get("bankName") ?? "").trim().slice(0, 160);
    const accountHolderName = String(formData.get("accountHolderName") ?? "").trim().slice(0, 200);
    const iban = normalizeIban(String(formData.get("iban") ?? ""));
    const ibanConfirmation = normalizeIban(String(formData.get("ibanConfirmation") ?? ""));
    const identityNumber = normalizeDigits(String(formData.get("identityNumber") ?? formData.get("nationalId") ?? "")).slice(0, 20);
    const requestedIdentityType = String(formData.get("identityType") ?? "").trim();
    const inferredIdentityType = /^1\d{9}$/.test(identityNumber)
      ? "national_id"
      : /^2\d{9}$/.test(identityNumber)
        ? "residency"
        : /^7\d{9}$/.test(identityNumber)
          ? "commercial_registration"
          : null;
    const certificateValue = formData.get("certificate");
    const certificate = certificateValue instanceof File && certificateValue.size > 0 ? certificateValue : null;

    if (!bankName || !accountHolderName || !iban) {
      return NextResponse.json({ message: "أكملي اسم البنك وصاحب الحساب ورقم الآيبان." }, { status: 400 });
    }
    if (!/^SA\d{22}$/.test(iban)) {
      return NextResponse.json({ message: "رقم الآيبان السعودي يجب أن يبدأ بـ SA ويتكون من 24 خانة." }, { status: 400 });
    }
    if (iban !== ibanConfirmation) {
      return NextResponse.json({ message: "رقما الآيبان غير متطابقين." }, { status: 400 });
    }
    if (identityNumber && !inferredIdentityType) {
      return NextResponse.json({ message: "رقم الهوية أو الإقامة أو السجل يجب أن يكون 10 أرقام ويبدأ بـ 1 أو 2 أو 7." }, { status: 400 });
    }
    if (requestedIdentityType && inferredIdentityType && requestedIdentityType !== inferredIdentityType) {
      return NextResponse.json({ message: "نوع الوثيقة لا يطابق بداية الرقم المدخل." }, { status: 400 });
    }
    if (certificate && certificate.size > MAX_CERTIFICATE_SIZE) {
      return NextResponse.json({ message: "حجم شهادة الآيبان أكبر من 10MB." }, { status: 413 });
    }
    if (certificate && !ALLOWED_CERTIFICATE_TYPES.has(certificate.type)) {
      return NextResponse.json({ message: "شهادة الآيبان يجب أن تكون صورة أو PDF." }, { status: 415 });
    }

    let certificatePath: string | null = null;
    if (certificate) {
      const filename = sanitizeFilename(certificate.name);
      certificatePath = `${influencer.id}/${randomUUID()}-${filename}`;
      const bytes = new Uint8Array(await certificate.arrayBuffer());
      const { error: uploadError } = await admin.storage
        .from("bank-certificates")
        .upload(certificatePath, bytes, {
          contentType: certificate.type,
          cacheControl: "3600",
          upsert: false,
        });
      if (uploadError) throw new Error(uploadError.message);
    }

    const { data: currentProfile, error: currentProfileError } = await admin
      .from("influencer_financial_profiles")
      .select("bank_profile_status")
      .eq("influencer_id", influencer.id)
      .maybeSingle();

    if (currentProfileError) throw new Error(currentProfileError.message);

    await admin
      .from("influencer_bank_update_requests")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("influencer_id", influencer.id)
      .eq("status", "pending");

    const { error: requestError } = await admin
      .from("influencer_bank_update_requests")
      .insert({
        influencer_id: influencer.id,
        bank_name: bankName,
        iban,
        iban_last4: iban.slice(-4),
        account_holder_name: accountHolderName,
        national_id: identityNumber || null,
        identity_type: inferredIdentityType,
        identity_number: identityNumber || null,
        certificate_path: certificatePath,
        previous_profile_status: currentProfile?.bank_profile_status ?? "incomplete",
        status: "pending",
      });

    if (requestError) throw new Error(requestError.message);

    const now = new Date().toISOString();
    const { error: profileError } = await admin
      .from("influencer_financial_profiles")
      .upsert(
        {
          influencer_id: influencer.id,
          bank_profile_status: "update_pending",
          national_id: identityNumber || null,
          identity_type: inferredIdentityType,
          identity_number: identityNumber || null,
          identity_number_normalized: identityNumber || null,
          bank_update_requested_at: now,
          influencer_confirmed_at: now,
          finance_review_notes: null,
          updated_at: now,
        },
        { onConflict: "influencer_id" },
      );

    if (profileError) throw new Error(profileError.message);

    await admin.from("activity_logs").insert({
      actor_id: user.id,
      entity_type: "influencer",
      entity_id: influencer.id,
      action: "bank_profile_update_requested",
      metadata: { certificate_uploaded: Boolean(certificatePath) },
    });

    return NextResponse.json({
      success: true,
      message: "تم إرسال بيانات البنك الجديدة لمراجعة المالية.",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "ASSIGNMENT_ACCESS_DENIED") {
      return NextResponse.json({ message: "هذا التكليف غير مربوط بحسابك." }, { status: 403 });
    }
    console.error("Influencer payment profile update failed:", error);
    return NextResponse.json({ message: "تعذر حفظ بيانات البنك حاليًا." }, { status: 500 });
  }
}
