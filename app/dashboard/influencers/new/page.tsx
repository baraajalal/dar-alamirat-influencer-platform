import Link from "next/link";
import { requireRole } from "@/lib/auth/require-user";
import { createInfluencer } from "./actions";

type NewInfluencerPageProps = {
  searchParams: Promise<{
    error?: string | string[];
  }>;
};

export default async function NewInfluencerPage({
  searchParams,
}: NewInfluencerPageProps) {
  await requireRole(["admin", "coordinator"]);

  const params = await searchParams;

  const errorCode =
    typeof params.error === "string"
      ? params.error
      : undefined;

  const errorMessages: Record<string, string> = {
    invalid_name: "يرجى إدخال اسم صحيح للمؤثر.",
    invalid_mobile:
      "رقم الجوال غير صحيح. استخدمي رقمًا سعوديًا مثل 05xxxxxxxx.",
    invalid_email:
      "صيغة البريد الإلكتروني غير صحيحة.",
    duplicate_mobile:
      "يوجد مؤثر مسجل مسبقًا بنفس رقم الجوال.",
    save_failed:
      "تعذر حفظ بيانات المؤثر. يرجى المحاولة مرة أخرى.",
  };

  const error = errorCode
    ? errorMessages[errorCode] ??
      "حدث خطأ غير متوقع."
    : undefined;

  return (
    <main
      dir="rtl"
      style={{
        minHeight: "100vh",
        background: "#f5f5f5",
        padding: "40px 20px",
      }}
    >
      <div
        style={{
          maxWidth: "760px",
          margin: "0 auto",
          background: "#ffffff",
          padding: "32px",
          borderRadius: "16px",
          boxShadow: "0 8px 25px rgba(0,0,0,0.06)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
            marginBottom: "28px",
          }}
        >
          <div>
            <h1 style={{ margin: "0 0 8px" }}>
              إضافة مؤثر جديد
            </h1>

            <p style={{ margin: 0, color: "#666666" }}>
              أدخلي البيانات الأساسية للمؤثر.
            </p>
          </div>

          <Link
            href="/dashboard/influencers"
            style={{
              color: "#111827",
              textDecoration: "none",
              border: "1px solid #d1d5db",
              borderRadius: "8px",
              padding: "10px 14px",
            }}
          >
            رجوع
          </Link>
        </div>

        {error && (
          <div
            style={{
              marginBottom: "20px",
              padding: "13px",
              borderRadius: "8px",
              background: "#fee2e2",
              color: "#991b1b",
            }}
          >
            {error}
          </div>
        )}

        <form action={createInfluencer}>
          <div style={gridStyle}>
            <div style={fieldStyle}>
              <label htmlFor="full_name" style={labelStyle}>
                الاسم الكامل *
              </label>

              <input
                id="full_name"
                name="full_name"
                type="text"
                required
                minLength={2}
                style={inputStyle}
              />
            </div>

            <div style={fieldStyle}>
              <label htmlFor="mobile" style={labelStyle}>
                رقم الجوال *
              </label>

              <input
                id="mobile"
                name="mobile"
                type="tel"
                required
                placeholder="05xxxxxxxx"
                dir="ltr"
                style={inputStyle}
              />
            </div>

            <div style={fieldStyle}>
              <label htmlFor="email" style={labelStyle}>
                البريد الإلكتروني
              </label>

              <input
                id="email"
                name="email"
                type="email"
                dir="ltr"
                style={inputStyle}
              />
            </div>

            <div style={fieldStyle}>
              <label htmlFor="city" style={labelStyle}>
                المدينة
              </label>

              <input
                id="city"
                name="city"
                type="text"
                placeholder="الرياض"
                style={inputStyle}
              />
            </div>

            <div style={fieldStyle}>
              <label htmlFor="country" style={labelStyle}>
                الدولة
              </label>

              <input
                id="country"
                name="country"
                type="text"
                defaultValue="Saudi Arabia"
                style={inputStyle}
              />
            </div>

            <div style={fieldStyle}>
              <label
                htmlFor="mawthooq_status"
                style={labelStyle}
              >
                هل لديه ترخيص موثوق؟
              </label>

              <select
                id="mawthooq_status"
                name="mawthooq_status"
                defaultValue="unknown"
                style={inputStyle}
              >
                <option value="unknown">غير محدد</option>
                <option value="yes">نعم</option>
                <option value="no">لا</option>
              </select>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-start",
              gap: "12px",
              marginTop: "28px",
            }}
          >
            <button
              type="submit"
              style={{
                padding: "12px 24px",
                border: "none",
                borderRadius: "8px",
                background: "#111827",
                color: "#ffffff",
                fontSize: "15px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              حفظ المؤثر
            </button>

            <Link
              href="/dashboard/influencers"
              style={{
                padding: "12px 24px",
                border: "1px solid #d1d5db",
                borderRadius: "8px",
                color: "#111827",
                textDecoration: "none",
              }}
            >
              إلغاء
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}

const gridStyle = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(260px, 1fr))",
  gap: "20px",
};

const fieldStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: "7px",
};

const labelStyle = {
  fontWeight: 600,
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box" as const,
  padding: "12px",
  border: "1px solid #d1d5db",
  borderRadius: "8px",
  background: "#ffffff",
  fontSize: "15px",
};