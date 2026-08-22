"use client";

import { useState } from "react";

type Coordinator = {
  recordId: string;
  name: string;
  code: string;
  mobile: string;
  status: string;
};

export default function CoordinatorLoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [pin, setPin] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function login() {
    if (!identifier.trim() || !pin.trim()) {
      alert("يرجى إدخال كود المنسق أو رقم الجوال والرمز السري");
      return;
    }

    try {
      setIsLoading(true);

      const response = await fetch("/api/coordinator/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          identifier,
          pin,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        alert(result.message || "تعذر تسجيل الدخول");
        return;
      }

      const coordinator: Coordinator = result.coordinator;

      localStorage.setItem("coordinator", JSON.stringify(coordinator));

      window.location.href = "/coordinator";
    } catch (error) {
      console.error(error);
      alert("حدث خطأ غير متوقع أثناء تسجيل الدخول");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F5F5F7] text-[#2E2335]" dir="inherit">
      <header className="header-lavender px-5 py-8 text-center md:px-10 md:py-12">
        <div className="mx-auto flex max-w-4xl flex-col items-center">
          <img
            src="/da-logo.png"
            alt="Dar Al Ameerat Logo"
            className="mb-5 h-20 w-auto object-contain md:h-24"
          />

          <h1 className="text-2xl font-extrabold md:text-4xl">
            بوابة منسقي الحملات
          </h1>

          <p className="mt-2 text-sm text-white/80 md:text-lg">
            Campaign Coordinators Portal
          </p>
        </div>
      </header>

      <section className="mx-auto mt-10 max-w-md px-4">
        <div className="card">
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-bold text-[#3B264B]">
              تسجيل الدخول
            </h2>
            <p className="mt-1 text-sm text-[#777]">
              Enter your coordinator code or mobile number
            </p>
          </div>

          <div className="space-y-4">
            <label className="block">
              <div className="mb-2 text-sm font-semibold">
                كود المنسق أو رقم الجوال
              </div>
              <input
                className="input"
                placeholder="DA-001 أو رقم الجوال"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
              />
            </label>

            <label className="block">
              <div className="mb-2 text-sm font-semibold">
                الرمز السري PIN
              </div>
              <input
                className="input"
                type="password"
                placeholder="****"
                value={pin}
                onChange={(event) => setPin(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") login();
                }}
              />
            </label>

            <button
              type="button"
              onClick={login}
              disabled={isLoading}
              className="w-full rounded-2xl bg-[#AD79C5] px-6 py-3 font-bold text-white shadow-lg shadow-[#AD79C5]/25 transition hover:bg-[#9564AE] disabled:opacity-60"
            >
              {isLoading ? "جاري التحقق..." : "دخول / Login"}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}