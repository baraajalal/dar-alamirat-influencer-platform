"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require-user";

function normalizeMobile(value: string) {
  const digits = value.replace(/\D/g, "");

  if (digits.startsWith("00966")) {
    return digits.slice(2);
  }

  if (digits.startsWith("966")) {
    return digits;
  }

  if (digits.startsWith("05") && digits.length === 10) {
    return `966${digits.slice(1)}`;
  }

  if (digits.startsWith("5") && digits.length === 9) {
    return `966${digits}`;
  }

  return digits;
}

export async function createInfluencer(formData: FormData) {
  // نتحقق من الصلاحية داخل العملية نفسها، وليس الصفحة فقط.
  const { supabase } = await requireRole(["admin", "coordinator"]);

  const fullName = String(formData.get("full_name") ?? "").trim();
  const mobile = normalizeMobile(
    String(formData.get("mobile") ?? "").trim()
  );
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const city = String(formData.get("city") ?? "").trim();
  const country =
    String(formData.get("country") ?? "").trim() || "Saudi Arabia";

  const mawthooqValue = String(
    formData.get("mawthooq_status") ?? ""
  );

  if (!fullName || fullName.length < 2) {
    redirect(
      "/dashboard/influencers/new?error=invalid_name"
    );
  }

  if (!/^9665\d{8}$/.test(mobile)) {
    redirect(
      "/dashboard/influencers/new?error=invalid_mobile"
    );
  }

  if (
    email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    redirect(
      "/dashboard/influencers/new?error=invalid_email"
    );
  }

  const mawthooqStatus =
    mawthooqValue === "yes"
      ? true
      : mawthooqValue === "no"
        ? false
        : null;

  const { error } = await supabase
    .from("influencers")
    .insert({
      full_name: fullName,
      mobile_e164: mobile,
      email: email || null,
      city: city || null,
      country,
      mawthooq_status: mawthooqStatus,
      source: "admin_portal",
    });

  if (error) {
    if (error.code === "23505") {
      redirect(
        "/dashboard/influencers/new?error=duplicate_mobile"
      );
    }

    console.error("Create influencer error:", error);

    redirect(
      "/dashboard/influencers/new?error=save_failed"
    );
  }

  revalidatePath("/dashboard/influencers");

  redirect(
    "/dashboard/influencers?success=influencer_created"
  );
}