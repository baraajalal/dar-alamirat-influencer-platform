import { NextRequest, NextResponse } from "next/server";
import { requireGuestSession } from "@/lib/guest-portal/security";
import { normalizeSaudiMobile } from "@/lib/influencers/mobile";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIN_PASSWORD_LENGTH = 8;

function normalizeEmail(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

function validPassword(value: string) {
  return (
    value.length >= MIN_PASSWORD_LENGTH &&
    /[A-Za-z]/.test(value) &&
    /[0-9]/.test(value)
  );
}

function accountExistsResponse(token: string, maskedEmail?: string | null) {
  return NextResponse.json(
    {
      code: "ACCOUNT_EXISTS",
      accountExists: true,
      maskedEmail: maskedEmail ?? null,
      loginPath: `/portal/complete-account?token=${encodeURIComponent(token)}`,
      message: "يوجد حساب مرتبط بهذا المؤثر. سجلي الدخول بالحساب الحالي.",
    },
    { status: 409 },
  );
}

function maskEmail(value: string | null | undefined) {
  const email = normalizeEmail(value);
  const [name, domain] = email.split("@");
  if (!name || !domain) return null;
  const shown = name.slice(0, Math.min(2, name.length));
  return `${shown}${"•".repeat(Math.max(3, name.length - shown.length))}@${domain}`;
}

type AssignmentInfluencer = {
  id: string;
  influencer_id: string;
  influencers: {
    id: string;
    user_id: string | null;
    full_name: string;
    mobile_e164: string;
    email: string | null;
  } | null;
};

export async function POST(request: NextRequest) {
  let cleanupCreatedUser: (() => Promise<unknown>) | null = null;

  try {
    const body = (await request.json()) as {
      token?: string;
      mobile?: string;
      email?: string;
      password?: string;
      passwordConfirmation?: string;
    };

    const token = String(body.token ?? "").trim();
    const mobileInput = String(body.mobile ?? "").trim();
    const normalizedMobile = normalizeSaudiMobile(mobileInput);
    const email = normalizeEmail(body.email);
    const password = String(body.password ?? "");
    const passwordConfirmation = String(body.passwordConfirmation ?? "");

    if (!normalizedMobile) {
      return NextResponse.json(
        {
          code: "INVALID_MOBILE",
          message:
            "أدخلي رقم جوال سعودي صحيحًا، مع المفتاح أو بدونه وبالأرقام العربية أو الإنجليزية.",
        },
        { status: 400 },
      );
    }

    if (!validEmail(email)) {
      return NextResponse.json(
        { code: "INVALID_EMAIL", message: "أدخلي بريدًا إلكترونيًا صحيحًا." },
        { status: 400 },
      );
    }

    if (password !== passwordConfirmation) {
      return NextResponse.json(
        {
          code: "PASSWORD_MISMATCH",
          message: "كلمة المرور وتأكيد كلمة المرور غير متطابقين.",
        },
        { status: 400 },
      );
    }

    if (!validPassword(password)) {
      return NextResponse.json(
        {
          code: "WEAK_PASSWORD",
          message: "كلمة المرور يجب أن تكون 8 أحرف على الأقل وتحتوي على حرف ورقم.",
        },
        { status: 400 },
      );
    }

    const session = await requireGuestSession(token);
    if (!session) {
      return NextResponse.json(
        {
          code: "GUEST_SESSION_EXPIRED",
          message: "انتهت جلسة رابط التكليف. افتحي الرابط وتحققي من الجوال مرة أخرى.",
        },
        { status: 401 },
      );
    }

    const { admin, assignmentId, link } = session;
    const { data: assignmentData, error: assignmentError } = await admin
      .from("campaign_assignments")
      .select(
        "id,influencer_id,influencers(id,user_id,full_name,mobile_e164,email)",
      )
      .eq("id", assignmentId)
      .maybeSingle();

    if (assignmentError) throw new Error(assignmentError.message);

    const assignment = assignmentData as unknown as AssignmentInfluencer | null;
    const influencer = assignment?.influencers ?? null;

    if (!assignment || !influencer) {
      return NextResponse.json(
        { code: "INFLUENCER_NOT_FOUND", message: "تعذر العثور على المؤثر المرتبط بالتكليف." },
        { status: 404 },
      );
    }

    const expectedMobile = normalizeSaudiMobile(influencer.mobile_e164);
    if (!expectedMobile || expectedMobile !== normalizedMobile) {
      const failedAttempts = Number(link.failed_attempts ?? 0) + 1;
      const maxAttempts = Number(link.max_attempts ?? 8);
      const locked = failedAttempts >= maxAttempts;

      await admin
        .from("submission_links")
        .update({
          failed_attempts: failedAttempts,
          locked_at: locked ? new Date().toISOString() : null,
        })
        .eq("id", link.id);

      return NextResponse.json(
        {
          code: "MOBILE_MISMATCH",
          message: locked
            ? "تم إيقاف الرابط بعد محاولات متعددة. تواصلي مع منسقة الحملة لإصدار رابط جديد."
            : "رقم الجوال لا يطابق الرقم المرتبط بهذا التكليف. أدخلي نفس الرقم الذي سجله منسق الحملة.",
        },
        { status: 403 },
      );
    }

    if (influencer.user_id) {
      const { data: existingAuth } = await admin.auth.admin.getUserById(
        influencer.user_id,
      );
      return accountExistsResponse(
        token,
        maskEmail(existingAuth.user?.email ?? influencer.email),
      );
    }

    // Registration is available after at least one publication link has been submitted.
    const { data: platformRows, error: platformError } = await admin
      .from("assignment_platforms")
      .select("id")
      .eq("assignment_id", assignmentId);

    if (platformError) throw new Error(platformError.message);

    const platformIds = (platformRows ?? []).map((row: { id: string }) => row.id);
    let publicationCount = 0;

    if (platformIds.length > 0) {
      const { data: contentRows, error: contentError } = await admin
        .from("content_items")
        .select("id")
        .in("assignment_platform_id", platformIds);

      if (contentError) throw new Error(contentError.message);
      const contentIds = (contentRows ?? []).map((row: { id: string }) => row.id);

      if (contentIds.length > 0) {
        const { count, error: publicationError } = await admin
          .from("publication_submissions")
          .select("id", { count: "exact", head: true })
          .in("content_item_id", contentIds);

        if (publicationError) throw new Error(publicationError.message);
        publicationCount = count ?? 0;
      }
    }

    if (publicationCount === 0) {
      return NextResponse.json(
        {
          code: "PUBLICATION_REQUIRED",
          message: "يجب رفع رابط النشر أولًا قبل إنشاء حساب استكمال الدفع.",
        },
        { status: 409 },
      );
    }

    const { data: mobileProfile, error: mobileProfileError } = await admin
      .from("profiles")
      .select("id,role")
      .eq("mobile_e164", expectedMobile)
      .maybeSingle();

    if (mobileProfileError) throw new Error(mobileProfileError.message);
    if (mobileProfile) {
      return NextResponse.json(
        {
          code: "MOBILE_ALREADY_USED",
          message: "رقم الجوال مرتبط بحساب مستخدم آخر. تواصلي مع الدعم.",
        },
        { status: 409 },
      );
    }

    const { data: created, error: createError } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          role: "influencer",
          influencer_id: influencer.id,
          assignment_id: assignmentId,
          full_name: influencer.full_name,
          mobile_e164: expectedMobile,
          registration_source: "verified_guest_assignment",
        },
        app_metadata: {
          role: "influencer",
        },
      });

    if (createError || !created.user) {
      const message = createError?.message.toLowerCase() ?? "";
      if (
        message.includes("already") ||
        message.includes("registered") ||
        message.includes("exists")
      ) {
        return NextResponse.json(
          {
            code: "EMAIL_ALREADY_USED",
            message: "البريد الإلكتروني مستخدم في حساب آخر. استخدمي بريدًا مختلفًا أو سجلي الدخول.",
          },
          { status: 409 },
        );
      }

      console.error("Influencer direct auth creation failed:", createError);
      return NextResponse.json(
        { code: "AUTH_CREATE_FAILED", message: "تعذر إنشاء الحساب حاليًا." },
        { status: 503 },
      );
    }

    const authUser = created.user;
    cleanupCreatedUser = () => admin.auth.admin.deleteUser(authUser.id);

    const { error: claimError } = await admin.rpc(
      "claim_influencer_account_direct",
      {
        p_influencer_id: influencer.id,
        p_assignment_id: assignmentId,
        p_submission_link_id: link.id,
        p_user_id: authUser.id,
        p_email: email,
        p_mobile_input: mobileInput,
      },
    );

    if (claimError) {
      await admin.auth.admin.deleteUser(authUser.id);
      cleanupCreatedUser = null;

      const code = claimError.message.match(/[A-Z][A-Z0-9_]+/)?.[0] ?? "CLAIM_FAILED";
      const messages: Record<string, string> = {
        MOBILE_MISMATCH: "رقم الجوال لا يطابق الرقم المرتبط بهذا التكليف.",
        ACCOUNT_ALREADY_LINKED: "تم ربط هذا المؤثر بحساب آخر بالفعل.",
        EMAIL_MISMATCH: "تعذر مطابقة البريد مع حساب الدخول.",
        MOBILE_ALREADY_USED: "رقم الجوال مرتبط بحساب مستخدم آخر.",
        STAFF_ACCOUNT_CONFLICT: "لا يمكن استخدام حساب موظف كحساب مؤثر.",
        ASSIGNMENT_LINK_MISMATCH: "رابط التسجيل لا يطابق هذا التكليف.",
      };

      return NextResponse.json(
        { code, message: messages[code] ?? "تعذر ربط الحساب بملف المؤثر." },
        { status: 409 },
      );
    }

    cleanupCreatedUser = null;

    await admin
      .from("submission_links")
      .update({ failed_attempts: 0, locked_at: null })
      .eq("id", link.id);

    const supabase = await createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      console.error("Influencer post-registration sign in failed:", signInError);
      return NextResponse.json({
        success: true,
        requiresLogin: true,
        nextPath: "/login?registered=1",
        message: "تم إنشاء الحساب. سجلي الدخول لاستكمال بيانات البنك.",
      });
    }

    return NextResponse.json({
      success: true,
      nextPath: `/portal/profile/payment-details?registered=1&assignment=${encodeURIComponent(assignmentId)}`,
      message: "تم إنشاء حسابك وربطه بالتكليف بنجاح.",
    });
  } catch (error) {
    if (cleanupCreatedUser) {
      try {
        await cleanupCreatedUser();
      } catch {
        // Best-effort cleanup only. The primary error is logged below.
      }
    }

    console.error("Influencer direct registration failed:", error);
    return NextResponse.json(
      { code: "REGISTRATION_FAILED", message: "تعذر إنشاء حساب المؤثر حاليًا." },
      { status: 500 },
    );
  }
}
