import { NextResponse } from "next/server";

/**
 * Legacy SmartSuite endpoints are intentionally OFF in the beta build.
 * They can only be enabled temporarily with an explicit server-side flag.
 */
export function legacySmartSuiteRoutesEnabled() {
  return process.env.ENABLE_LEGACY_SMARTSUITE_ROUTES === "true";
}

export function legacySmartSuiteDisabledResponse() {
  if (legacySmartSuiteRoutesEnabled()) return null;

  return NextResponse.json(
    {
      success: false,
      code: "LEGACY_ROUTE_DISABLED",
      message:
        "تم إيقاف هذا المسار القديم في النسخة التجريبية. استخدم مسار Supabase الحالي داخل النظام.",
    },
    {
      status: 410,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
