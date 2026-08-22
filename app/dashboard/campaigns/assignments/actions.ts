"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/require-user";

const LIST = "/dashboard/campaigns/assignments";

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function normalizeMobile(input: string) {
  const digits = input.replace(/\D/g, "");
  if (digits.startsWith("966")) return digits;
  if (digits.startsWith("0")) return `966${digits.slice(1)}`;
  return digits;
}

export async function sendAssignmentInvitation(formData: FormData) {
  const assignmentId = value(formData, "assignment_id");
  if (!assignmentId) redirect(`${LIST}?error=assignment_required`);

  const { supabase, user } = await requirePermission("campaigns", "update");
  const { data: assignment, error } = await supabase
    .from("campaign_assignments")
    .select("id,campaign_id,influencer_id,execution_type,other_execution_details,status")
    .eq("id", assignmentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!assignment) redirect(`${LIST}?error=assignment_not_found`);

  const [{ data: campaign }, { data: influencer }, { data: platforms }] = await Promise.all([
    supabase.from("campaigns").select("name,brand,brief_public_url,brief_file_path,brief_version").eq("id", assignment.campaign_id).maybeSingle(),
    supabase.from("influencers").select("full_name,mobile_e164").eq("id", assignment.influencer_id).maybeSingle(),
    supabase.from("assignment_platforms").select("required_deliverables,social_account_id").eq("assignment_id", assignment.id),
  ]);
  if (!campaign || !influencer) redirect(`${LIST}?error=invitation_data_missing`);

  const mobile = normalizeMobile(influencer.mobile_e164);
  if (!mobile) redirect(`${LIST}?error=mobile_missing`);

  const deliverables = (platforms ?? [])
    .flatMap((row) => Array.isArray(row.required_deliverables) ? row.required_deliverables : [])
    .map((item) => {
      const deliverable = item as { quantity?: number; contentType?: string; content_type?: string };
      return `${deliverable.quantity ?? 1} × ${deliverable.contentType ?? deliverable.content_type ?? "محتوى"}`;
    })
    .join("، ") || "حسب البريف";
  const execution = assignment.execution_type === "home"
    ? "منزلي"
    : assignment.execution_type === "in_branch"
      ? "حضوري"
      : assignment.other_execution_details === "MULTIPLE_HOME_IN_BRANCH"
        ? "منزلي + حضوري"
        : "تعاون آخر";
  const briefUrl = campaign.brief_public_url || campaign.brief_file_path || "سيتم إرسال البريف من المنسق";
  const message = `مرحبًا ${influencer.full_name} 🌸\n\nيسعدنا دعوتك للتعاون معنا في حملة:\n${campaign.name}\n\nالعلامة التجارية:\n${campaign.brand || "دار الأميرات"}\n\nنوع التعاون:\n${execution}\n\nالمطلوب:\n${deliverables}\n\nتفاصيل الحملة والبريف:\n${briefUrl}\n\nيسعدنا تأكيد مشاركتك بالتواصل مع المنسق.\n\nشركة دار الأميرات`;

  const now = new Date().toISOString();
  const { error: inviteError } = await supabase.from("assignment_invitations").insert({
    assignment_id: assignment.id,
    channel: "whatsapp",
    recipient_mobile: mobile,
    message_snapshot: message,
    brief_version: campaign.brief_version ?? null,
    brief_url: briefUrl,
    sent_by: user.id,
    sent_at: now,
  });
  if (inviteError) throw new Error(inviteError.message);

  const { error: updateError } = await supabase.from("campaign_assignments").update({
    invitation_status: "sent",
    invitation_sent_at: now,
    invitation_sent_by: user.id,
    invitation_channel: "whatsapp",
    brief_version_sent: campaign.brief_version ?? null,
    brief_sent_at: now,
    last_follow_up_at: now,
  }).eq("id", assignment.id);
  if (updateError) throw new Error(updateError.message);

  await supabase.rpc("refresh_assignment_progress", { p_assignment_id: assignment.id });
  revalidatePath(LIST);
  redirect(`https://wa.me/${mobile}?text=${encodeURIComponent(message)}`);
}
