"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";

const LIST = "/dashboard/finance/settlements";

export async function refreshSettlement(formData: FormData) {
  const assignmentId = String(formData.get("assignment_id") ?? "").trim();
  if (!assignmentId) redirect(`${LIST}?error=invalid_assignment`);

  const { user } = await requireRole(["admin", "finance"]);
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("refresh_assignment_financial_settlement", {
    p_assignment_id: assignmentId,
    p_actor_id: user.id,
  });
  if (error) redirect(`${LIST}?error=refresh_failed`);

  revalidatePath(LIST);
  redirect(`${LIST}?success=${data ? "settled" : "refreshed"}`);
}
