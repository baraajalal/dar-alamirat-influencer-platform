import Link from "next/link";
import { requireInfluencerAccount } from "@/lib/influencer-portal/require-influencer-account";
import { markAllNotificationsRead } from "./actions";

export const dynamic = "force-dynamic";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Riyadh" }).format(new Date(value));
}

export default async function InfluencerNotificationsPage() {
  const { influencer, admin } = await requireInfluencerAccount();
  const { data: notifications, error } = await admin
    .from("influencer_notifications")
    .select("id,type,title,body,action_url,read_at,created_at")
    .eq("influencer_id", influencer.id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  const unread = (notifications ?? []).filter((row) => !row.read_at).length;

  return (
    <div dir="rtl" className="space-y-5">
      <section className="rounded-[28px] bg-[linear-gradient(135deg,#5A6BC3,#96A2E5)] p-6 text-white shadow-[0_20px_58px_rgba(68,82,170,.18)]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black text-white/70">بوابة المؤثر</p>
            <h1 className="mt-2 text-2xl font-black">الإشعارات والملاحظات</h1>
            <p className="mt-2 text-sm font-bold text-white/80">ملاحظات البنك والمستحقات وتحديثات القسائم تظهر هنا.</p>
          </div>
          <span className="rounded-full bg-white/16 px-4 py-2 text-sm font-black ring-1 ring-white/20">{unread} غير مقروء</span>
        </div>
      </section>

      {unread > 0 ? (
        <form action={markAllNotificationsRead}>
          <button className="rounded-xl border border-[#DDE2F2] bg-white px-5 py-3 text-sm font-black text-[#596BC4]">تحديد الكل كمقروء</button>
        </form>
      ) : null}

      <section className="space-y-3">
        {(notifications ?? []).map((notification) => (
          <article key={notification.id} className={`rounded-[22px] border p-5 shadow-[0_12px_36px_rgba(67,82,155,.06)] ${notification.read_at ? "border-[#E5E8F3] bg-white" : "border-[#BFC8EF] bg-[#F8F9FF]"}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-black text-[#3D4D7D]">{notification.title}</h2>
                <p className="mt-2 text-sm font-bold leading-7 text-[#68749A]">{notification.body}</p>
              </div>
              <span className="text-xs font-bold text-[#929AB1]">{formatDate(notification.created_at)}</span>
            </div>
            {notification.action_url ? <Link href={notification.action_url} className="mt-4 inline-flex rounded-xl bg-[#EEF1FF] px-4 py-2 text-xs font-black text-[#596BC4]">فتح الصفحة المرتبطة</Link> : null}
          </article>
        ))}
        {(notifications ?? []).length === 0 ? <div className="rounded-[24px] border border-dashed border-[#CDD4EE] bg-white p-10 text-center text-sm font-black text-[#8A93AE]">لا توجد إشعارات حتى الآن.</div> : null}
      </section>
    </div>
  );
}
