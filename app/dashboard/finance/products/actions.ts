"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";

const LIST = "/dashboard/finance/products";
function field(formData: FormData, key: string) { return String(formData.get(key) ?? "").trim(); }

export async function updateProductFulfilment(formData: FormData) {
  const id = field(formData, "id");
  const status = field(formData, "status");
  const orderNumber = field(formData, "order_number").slice(0, 160);
  const carrierName = field(formData, "carrier_name").slice(0, 160);
  const trackingNumber = field(formData, "tracking_number").slice(0, 160);
  const proofPath = field(formData, "proof_path").slice(0, 1000);
  const notes = field(formData, "notes").slice(0, 2500);
  const allowed = ["pending","preparing","shipped","delivered","received","returned","cancelled"];
  if (!id || !allowed.includes(status)) redirect(`${LIST}?error=invalid_input`);
  const { user } = await requireRole(["admin", "finance"]);
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const patch: Record<string, string | null> = {
    status,
    order_number: orderNumber || null,
    carrier_name: carrierName || null,
    tracking_number: trackingNumber || null,
    proof_path: proofPath || null,
    notes: notes || null,
    updated_by: user.id,
    updated_at: now,
  };
  if (status === "preparing") patch.prepared_at = now;
  if (status === "shipped") patch.shipped_at = now;
  if (status === "delivered") patch.delivered_at = now;
  if (status === "received") patch.received_at = now;
  const { error } = await admin.from("product_fulfilments").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(LIST);
  redirect(`${LIST}?success=updated`);
}
