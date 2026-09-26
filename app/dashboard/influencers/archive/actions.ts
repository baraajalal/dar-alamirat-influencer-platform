"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as XLSX from "xlsx";
import { requirePermission } from "@/lib/auth/require-user";

const SHEET_NAMES = ["Campaign_Influencers_04", "04_Campaign_Influencers", "Campaign Influencers", "Collaborations"];

function clean(value: unknown) {
  return String(value ?? "").replace(/\u00A0/g, " ").replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\s+/g, " ").trim();
}
function normalizeHeader(value: string) { return clean(value).toLowerCase().replace(/[^a-z0-9]/g, ""); }
function get(row: Record<string, unknown>, aliases: string[]) {
  for (const alias of aliases) {
    if (row[alias] !== undefined && clean(row[alias])) return row[alias];
  }
  for (const [key, value] of Object.entries(row)) {
    if (aliases.some((alias) => normalizeHeader(alias) === normalizeHeader(key)) && clean(value)) return value;
  }
  return "";
}
function normalizeDate(value: unknown) {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
  }
  const text = clean(value);
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}
function numeric(value: unknown) {
  const text = clean(value).replace(/,/g, "").replace(/%/g, "");
  if (!text) return "";
  const number = Number(text);
  return Number.isFinite(number) && number >= 0 ? String(number) : "";
}
function collaborationType(value: unknown) {
  const text = clean(value).toLowerCase();
  if (text.includes("bank") || text.includes("paid") || text.includes("تحويل") || text.includes("مدفوع")) return "paid";
  if (text.includes("pr")) return "pr";
  if (text.includes("product") || text.includes("منتج")) return "product";
  if (text.includes("voucher") || text.includes("قسيم")) return "voucher";
  if (text.includes("commission") || text.includes("عمول")) return "commission";
  if (text.includes("+") || text.includes("hybrid") || text.includes("mixed")) return "hybrid";
  return "other";
}
function collaborationStatus(value: unknown) {
  const text = clean(value).toLowerCase();
  if (text.includes("publish") || text.includes("نشر")) return "published";
  if (text.includes("cancel") || text.includes("reject") || text.includes("ملغ") || text.includes("رفض")) return "cancelled";
  if (text.includes("closed") || text.includes("complete") || text.includes("مغلق") || text.includes("مكتمل") || !text) return "completed";
  return "other";
}

export async function importWorkHistory(formData: FormData) {
  await requirePermission("influencers", "update");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) redirect("/dashboard/influencers/archive?error=file_required");
  if (file.size > 12 * 1024 * 1024) redirect("/dashboard/influencers/archive?error=file_too_large");

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: "buffer", cellDates: true });
  } catch {
    redirect("/dashboard/influencers/archive?error=import_failed");
  }
  const sheetName = SHEET_NAMES.find((name) => workbook.SheetNames.includes(name)) ?? workbook.SheetNames[0];
  const sheet = sheetName ? workbook.Sheets[sheetName] : null;
  if (!sheet) redirect("/dashboard/influencers/archive?error=import_failed");

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: true });
  const rows = rawRows.map((row, index) => ({
    row_number: index + 2,
    mobile: clean(get(row, ["Influencer Mobile", "Mobile", "Phone", "INF_Phone"])),
    influencer_name: clean(get(row, ["Influencer Name", "Creator Name", "Name", "Full Name"])),
    influencer_email: clean(get(row, ["Influencer Email", "Creator Email", "Email"])),
    city: clean(get(row, ["City", "Influencer City", "Creator City"])),
    bio: clean(get(row, ["Bio", "Account Bio", "Influencer Bio", "Creator Bio"])),
    category: clean(get(row, ["Category", "Account Category", "Influencer Category", "Creator Category"])),
    social_username: clean(get(row, ["Username", "Social Username", "Account Username", "Handle"])).replace(/^@/, ""),
    social_profile_url: clean(get(row, ["Profile URL", "Social Profile URL", "Account URL"])),
    followers_count: numeric(get(row, ["Followers", "Followers Count", "Follower Count"])),
    campaign_name: clean(get(row, ["Campaign Name", "Campaign"])),
    brand_name: clean(get(row, ["Brand", "Brand Name"])),
    collaboration_type: collaborationType(get(row, ["Collaboration Type", "Payment Type", "Type"])),
    collaboration_status: collaborationStatus(get(row, ["Collaboration Status", "Status"])),
    collaboration_date: normalizeDate(get(row, ["Publishing Date", "Post Date", "Collaboration Date", "Date"])),
    archive_year: numeric(get(row, ["Archive Year", "Source Year", "Year"])),
    archive_month: numeric(get(row, ["Archive Month", "Source Month", "Month"])),
    platform: clean(get(row, ["Platform"])).toLowerCase(),
    content_type: clean(get(row, ["Content Type", "Deliverable Type"])),
    content_url: clean(get(row, ["Published Link", "Post Link", "Content URL", "URL"])),
    compensation_amount: numeric(get(row, ["Agreed Amount", "Amount", "Compensation Amount", "Voucher Value"])),
    compensation_currency: clean(get(row, ["Currency"])) || "SAR",
    views: numeric(get(row, ["Views", "View Count"])),
    likes: numeric(get(row, ["Likes", "Like Count"])),
    comments: numeric(get(row, ["Comments", "Comment Count"])),
    shares: numeric(get(row, ["Shares", "Share Count"])),
    engagement_rate: numeric(get(row, ["Engagement Rate", "Engagement"])),
    outcome: "unknown",
    performance_note: clean(get(row, ["Performance Note", "Performance Notes"])),
    internal_notes: clean(get(row, ["Notes", "Internal Notes"])),
    source_record_id: clean(get(row, ["Source Record ID", "Record ID", "Legacy ID"])),
  }));

  const { supabase } = await requirePermission("influencers", "update");
  const { data: batchId, error } = await supabase.rpc("import_influencer_work_history", { p_file_name: file.name, p_rows: rows });
  if (error || !batchId) redirect("/dashboard/influencers/archive?error=import_failed");
  revalidatePath("/dashboard/influencers/archive");
  revalidatePath("/dashboard/influencers");
  redirect(`/dashboard/influencers/archive?batch=${batchId}&imported=1`);
}
