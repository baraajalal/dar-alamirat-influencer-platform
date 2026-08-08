import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { assignmentId?: string };
    const assignmentId = String(body.assignmentId ?? "").trim();

    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { message: "انتهت جلسة التفعيل. سجلي الدخول مرة أخرى." },
        { status: 401 },
      );
    }

    const admin = createAdminClient();
    const { data: influencer, error: influencerError } = await admin
      .from("influencers")
      .select("id,user_id,must_change_password")
      .eq("user_id", user.id)
      .maybeSingle();

    if (influencerError) throw new Error(influencerError.message);
    if (!influencer) {
      return NextResponse.json(
        { message: "حساب الدخول غير مربوط بملف مؤثر." },
        { status: 404 },
      );
    }

    if (assignmentId) {
      const { data: assignment, error: assignmentError } = await admin
        .from("campaign_assignments")
        .select("id")
        .eq("id", assignmentId)
        .eq("influencer_id", influencer.id)
        .maybeSingle();

      if (assignmentError) throw new Error(assignmentError.message);
      if (!assignment) {
        return NextResponse.json(
          { message: "التكليف غير مرتبط بهذا الحساب." },
          { status: 403 },
        );
      }
    }

    const now = new Date().toISOString();
    const [{ error: influencerUpdateError }, { error: activationUpdateError }] =
      await Promise.all([
        admin
          .from("influencers")
          .update({
            must_change_password: false,
            activation_status: "active",
            account_status: "active",
            portal_access_required: false,
            last_login_at: now,
            updated_at: now,
          })
          .eq("id", influencer.id),
        admin
          .from("influencer_account_activations")
          .update({
            status: "completed",
            password_completed_at: now,
          })
          .eq("influencer_id", influencer.id)
          .in("status", ["email_verified", "password_setup_required"]),
      ]);

    if (influencerUpdateError) throw new Error(influencerUpdateError.message);
    if (activationUpdateError) throw new Error(activationUpdateError.message);

    await admin.from("activity_logs").insert({
      actor_id: user.id,
      entity_type: "influencer",
      entity_id: influencer.id,
      action: "influencer_password_created",
      metadata: assignmentId ? { assignment_id: assignmentId } : {},
    });

    const nextPath = assignmentId
      ? `/portal/profile/payment-details?assignment=${encodeURIComponent(assignmentId)}`
      : "/portal/dashboard";

    return NextResponse.json({
      success: true,
      nextPath,
      message: "تم إنشاء كلمة المرور وتفعيل الحساب.",
    });
  } catch (error) {
    console.error("Influencer password completion failed:", error);
    return NextResponse.json(
      { message: "تم حفظ كلمة المرور، لكن تعذر إكمال تفعيل الملف." },
      { status: 500 },
    );
  }
}
