import Link from "next/link";
import { requireRole } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateProductFulfilment } from "./actions";

export const dynamic = "force-dynamic";
function money(value: number | string | null) { return new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR" }).format(Number(value ?? 0)); }
const statusLabels: Record<string,string> = { pending:"بانتظار التجهيز", preparing:"قيد التجهيز", shipped:"تم الشحن", delivered:"تم التسليم", received:"استلام مؤكد", returned:"مرتجع", cancelled:"ملغى" };

export default async function ProductsPage({ searchParams }: { searchParams?: Promise<{ status?: string; success?: string }> }) {
  await requireRole(["admin","finance"]);
  const query = (await searchParams) ?? {};
  const admin = createAdminClient();
  let request = admin.from("product_fulfilments").select("id,payment_id,assignment_id,influencer_id,order_number,carrier_name,tracking_number,status,prepared_at,shipped_at,delivered_at,received_at,proof_path,notes,updated_at").order("updated_at", { ascending: false });
  if (query.status) request = request.eq("status", query.status);
  const { data: rows, error } = await request;
  if (error) throw new Error(error.message);
  const ids = [...new Set((rows ?? []).map(r => r.assignment_id))];
  const [{ data: assignments }, { data: summaries }] = await Promise.all([
    ids.length ? admin.from("campaign_assignments").select("id,influencer_id,campaign_id").in("id", ids) : Promise.resolve({ data: [] }),
    ids.length ? admin.from("payment_execution_summary").select("payment_id,expected_amount").in("assignment_id", ids) : Promise.resolve({ data: [] }),
  ]);
  const infIds = [...new Set((assignments ?? []).map(a => a.influencer_id))];
  const campIds = [...new Set((assignments ?? []).map(a => a.campaign_id))];
  const [{ data: influencers }, { data: campaigns }] = await Promise.all([
    infIds.length ? admin.from("influencers").select("id,full_name,mobile_e164").in("id", infIds) : Promise.resolve({ data: [] }),
    campIds.length ? admin.from("campaigns").select("id,name,brand").in("id", campIds) : Promise.resolve({ data: [] }),
  ]);
  const assignmentMap = new Map((assignments ?? []).map(a => [a.id,a]));
  const influencerMap = new Map((influencers ?? []).map(i => [i.id,i]));
  const campaignMap = new Map((campaigns ?? []).map(c => [c.id,c]));
  const amountMap = new Map((summaries ?? []).map(s => [s.payment_id,s.expected_amount]));
  return <div dir="inherit" className="space-y-6">
    <section className="rounded-[30px] bg-[linear-gradient(135deg,#527B70,#8DB8A9)] p-7 text-white"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-black text-white/70">المقابل العيني</p><h1 className="mt-2 text-3xl font-black">تسليم المنتجات وتتبع الشحن</h1><p className="mt-3 text-sm font-bold text-white/85">من التجهيز إلى الشحن والاستلام، مع رقم الطلب والتتبع وإثبات التسليم.</p></div><Link href="/dashboard/finance" className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-[#527B70]">العودة للقسم المالي</Link></div></section>
    {query.success ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-black text-emerald-700">تم تحديث حالة التسليم.</div> : null}
    <form className="flex flex-wrap gap-2 rounded-2xl bg-white p-4 shadow-sm"><select name="status" defaultValue={query.status ?? ""} className="rounded-xl border border-[#ECE1F1] px-4 py-2 text-sm font-bold"><option value="">كل الحالات</option>{Object.entries(statusLabels).map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select><button className="rounded-xl bg-[#527B70] px-4 py-2 text-sm font-black text-white">تطبيق الفلتر</button></form>
    <section className="grid gap-5 xl:grid-cols-2">{(rows ?? []).map(row => { const a=assignmentMap.get(row.assignment_id); const i=a ? influencerMap.get(a.influencer_id) : null; const c=a ? campaignMap.get(a.campaign_id) : null; return <article key={row.id} className="rounded-[26px] border border-[#E1E8E5] bg-white p-5 shadow-[0_14px_40px_rgba(67,82,155,.06)]"><div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-black text-[#3D5F56]">{i?.full_name ?? "—"}</h2><p className="mt-1 text-xs font-bold text-[#8A9B96]" dir="ltr">{i?.mobile_e164 ?? "—"}</p><p className="mt-3 text-sm font-black text-[#566B66]">{c?.name ?? "—"} · {c?.brand ?? "—"}</p></div><div className="text-left"><span className="rounded-full bg-[#EDF6F2] px-3 py-1.5 text-xs font-black text-[#527B70]">{statusLabels[row.status] ?? row.status}</span><p className="mt-3 text-sm font-black text-[#3D5F56]">{money(amountMap.get(row.payment_id) ?? 0)}</p></div></div><form action={updateProductFulfilment} className="mt-5 grid gap-3 md:grid-cols-2"><input type="hidden" name="id" value={row.id}/><select name="status" defaultValue={row.status} className="rounded-xl border border-[#ECE1F1] p-3 text-sm font-bold">{Object.entries(statusLabels).map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select><input name="order_number" defaultValue={row.order_number ?? ""} placeholder="رقم الطلب" className="rounded-xl border border-[#ECE1F1] p-3 text-sm"/><input name="carrier_name" defaultValue={row.carrier_name ?? ""} placeholder="شركة الشحن" className="rounded-xl border border-[#ECE1F1] p-3 text-sm"/><input name="tracking_number" defaultValue={row.tracking_number ?? ""} placeholder="رقم التتبع" className="rounded-xl border border-[#ECE1F1] p-3 text-sm"/><input name="proof_path" defaultValue={row.proof_path ?? ""} placeholder="رابط/مسار إثبات التسليم" className="rounded-xl border border-[#ECE1F1] p-3 text-sm md:col-span-2"/><textarea name="notes" defaultValue={row.notes ?? ""} placeholder="ملاحظات" rows={2} className="rounded-xl border border-[#ECE1F1] p-3 text-sm md:col-span-2"/><button className="rounded-xl bg-[#527B70] px-5 py-3 text-sm font-black text-white md:col-span-2">حفظ التحديث</button></form></article>})}</section>
    {(rows ?? []).length === 0 ? <div className="rounded-2xl bg-white p-10 text-center text-sm font-black text-[#8D7B95]">لا توجد مستحقات منتجات بهذه الحالة.</div> : null}
  </div>;
}
