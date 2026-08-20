import Image from "next/image";
import Link from "next/link";

export default function HomePage() {
  return (
    <main dir="rtl" className="min-h-screen bg-[radial-gradient(circle_at_10%_10%,rgba(216,221,247,.8),transparent_30%),linear-gradient(135deg,#fbfcff,#f2f4fc)] px-4 py-10 font-['Tajawal',Tahoma,Arial,sans-serif] text-[#33447F]">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl items-center">
        <section className="grid w-full overflow-hidden rounded-[36px] border border-white/90 bg-white/88 shadow-[0_28px_90px_rgba(67,82,155,.14)] backdrop-blur-xl lg:grid-cols-[.9fr_1.1fr]">
          <div className="relative overflow-hidden bg-[linear-gradient(145deg,#7180D2,#5364B8)] p-8 text-white sm:p-12">
            <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-white/10" />
            <div className="absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-white/10" />
            <div className="relative">
              <Image src="/da-logo.png" alt="دار الأميرات" width={88} height={88} className="rounded-3xl bg-white/95 p-2" priority />
              <p className="mt-8 text-sm font-black text-white/70">منصة مؤثري دار الأميرات</p>
              <h1 className="mt-3 text-4xl font-black leading-tight sm:text-5xl">بوابتك للتعاون وإدارة الفرص</h1>
              <p className="mt-5 max-w-xl text-base font-semibold leading-8 text-white/80">سجّل الدخول إذا كان حسابك مفعّلًا، أو أرسل طلب تفعيل جديد وأكمل ملفك ليتم مراجعته من فريق دار الأميرات.</p>
              <div className="mt-9 space-y-3 text-sm font-bold text-white/85">
                {["ملف مؤثر منظم ومتكامل", "إدارة حسابات التواصل والمقاييس", "متابعة الحملات والمستحقات من البوابة بعد التفعيل"].map((item) => <div key={item} className="flex items-center gap-3"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15">✓</span>{item}</div>)}
              </div>
            </div>
          </div>
          <div className="flex flex-col justify-center p-7 sm:p-12">
            <p className="text-sm font-black text-[#6877C8]">مرحبًا بك</p>
            <h2 className="mt-2 text-3xl font-black">كيف ترغب بالمتابعة؟</h2>
            <p className="mt-3 text-sm font-semibold leading-7 text-[#7D86A7]">اختر تسجيل الدخول للحساب المفعّل، أو ابدأ طلب تفعيل جديد. الأرشيف الداخلي لا يظهر لك ولا تحتاج الرجوع إليه.</p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <Link href="/login" className="rounded-[26px] border border-[#D8DDF7] bg-white p-6 shadow-[0_14px_35px_rgba(67,82,155,.08)] transition hover:-translate-y-1 hover:border-[#AAB6E9]">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EEF0FB] text-xl">↪</span>
                <h3 className="mt-5 text-xl font-black">تسجيل الدخول</h3>
                <p className="mt-2 text-sm font-semibold leading-6 text-[#7D86A7]">لدي حساب مفعّل وأريد الدخول إلى بوابة المؤثر.</p>
              </Link>
              <Link href="/portal-access/request" className="rounded-[26px] bg-[linear-gradient(135deg,#6575CB,#4F60B6)] p-6 text-white shadow-[0_18px_40px_rgba(79,96,182,.25)] transition hover:-translate-y-1">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-xl">＋</span>
                <h3 className="mt-5 text-xl font-black">طلب تفعيل حساب</h3>
                <p className="mt-2 text-sm font-semibold leading-6 text-white/75">أنشئ ملفك وأرسله للمراجعة ثم استلم رابط التفعيل من الموظف.</p>
              </Link>
            </div>
            <Link href="/staff/login" className="mt-7 text-center text-xs font-bold text-[#8B94B1] hover:text-[#6877C8]">دخول الموظفين والإدارة</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
