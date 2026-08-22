import { logout } from "@/app/login/actions";

export default function UnauthorizedPage() {
  return (
    <main dir="inherit" className="flex min-h-screen items-center justify-center p-6">
      <div className="card max-w-lg text-center">
        <h1 className="text-2xl font-extrabold">ليس لديك صلاحية للدخول</h1>
        <p className="mt-3 text-[#6B6475]">
          حسابك لا يملك الصلاحية المطلوبة لعرض هذه الصفحة.
        </p>
        <form action={logout}>
          <button className="mt-6 rounded-xl bg-[#AD79C5] px-6 py-3 font-bold text-white">
            تسجيل الخروج
          </button>
        </form>
      </div>
    </main>
  );
}
