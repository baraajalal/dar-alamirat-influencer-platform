import { NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function safeName(value: string) {
  return value.replace(/[^A-Za-z0-9\u0600-\u06FF_-]+/g, "-").replace(/-+/g, "-").slice(0, 100);
}

function money(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function csvCell(value: unknown) {
  const text = String(value ?? "").replace(/"/g, '""');
  return `"${text}"`;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role,is_active").eq("id", user.id).maybeSingle();
  if (!profile?.is_active || !["admin", "finance"].includes(profile.role)) return new Response("Forbidden", { status: 403 });

  const admin = createAdminClient();
  const [{ data: batch }, { data: items }] = await Promise.all([
    admin.from("payment_batches").select("id,name,batch_code,month_label,scheduled_for,status,total_amount,item_count,bank_file_count,manual_count,created_at").eq("id", id).maybeSingle(),
    admin.from("payment_batch_items").select("influencer_name,mobile,campaign_name,brand_name,bank_name,account_holder_name,iban,identity_type,identity_number,amount,contract_status,publication_url,transfer_method,manual_reason,item_status").eq("batch_id", id).neq("item_status", "cancelled").order("created_at", { ascending: true }),
  ]);
  if (!batch) return new Response("Not found", { status: 404 });
  if (!["approved", "exported", "submitted_to_bank", "processing", "completed"].includes(batch.status)) {
    return new Response("Batch is not approved for export", { status: 409 });
  }

  const type = request.nextUrl.searchParams.get("type") ?? "review";
  const filenameBase = `${safeName(batch.batch_code)}-${safeName(batch.month_label)}`;

  if (type === "bank") {
    const rows = (items ?? []).filter((item) => item.transfer_method === "bank_file");
    const headers = ["BeneficiaryName", "BeneficiaryIBAN", "BankName", "IdentityNumber", "AmountSAR", "Mobile", "Reference", "Campaign", "Brand"];
    const lines = [headers.map(csvCell).join(",")];
    for (const item of rows) {
      lines.push([
        item.account_holder_name || item.influencer_name,
        item.iban,
        item.bank_name,
        item.identity_number,
        money(item.amount).toFixed(2),
        item.mobile,
        batch.batch_code,
        item.campaign_name,
        item.brand_name,
      ].map(csvCell).join(","));
    }
    const body = `\uFEFF${lines.join("\r\n")}`;
    return new Response(body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filenameBase}-bank.csv"`,
      },
    });
  }

  const selectedItems = type === "manual"
    ? (items ?? []).filter((item) => item.transfer_method === "manual")
    : (items ?? []);

  const workbook = XLSX.utils.book_new();
  const summary = [
    ["اسم المجموعة", batch.name],
    ["رقم المجموعة", batch.batch_code],
    ["الشهر", batch.month_label],
    ["تاريخ التحويل المتوقع", batch.scheduled_for ?? ""],
    ["إجمالي المبلغ", money(batch.total_amount)],
    ["عدد المستحقات", batch.item_count],
    ["تحويلات ملف البنك", batch.bank_file_count],
    ["تحويلات يدوية", batch.manual_count],
  ];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(summary), "ملخص المجموعة");

  const detailRows = selectedItems.map((item) => ({
    "اسم المؤثر": item.influencer_name,
    "رقم الجوال": item.mobile,
    "الحملة": item.campaign_name,
    "البراند": item.brand_name ?? "",
    "اسم البنك": item.bank_name ?? "",
    "اسم صاحب الحساب": item.account_holder_name ?? "",
    "الآيبان": item.iban ?? "",
    "نوع الوثيقة": item.identity_type ?? "",
    "رقم الهوية أو الإقامة أو السجل": item.identity_number ?? "",
    "المبلغ المستحق": money(item.amount),
    "حالة التعاقد": item.contract_status,
    "نوع التحويل": item.transfer_method === "manual" ? "يدوي" : "ملف البنك",
    "سبب التحويل اليدوي": item.manual_reason ?? "",
    "رابط النشر": item.publication_url ?? "",
    "حالة السطر": item.item_status,
  }));
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(detailRows), type === "manual" ? "التحويلات اليدوية" : "تفاصيل المستحقات");

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  const suffix = type === "manual" ? "manual" : "review";
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filenameBase}-${suffix}.xlsx"`,
    },
  });
}
