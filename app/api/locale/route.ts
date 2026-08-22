import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { normalizeAppLocale } from "@/lib/i18n/app";

export async function POST(request: Request) {
  let value = "ar";
  try {
    const body = await request.json();
    value = String(body?.locale ?? "ar");
  } catch {
    // Keep Arabic as the safe default for malformed requests.
  }

  const locale = normalizeAppLocale(value);
  const cookieStore = await cookies();
  const options = {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };

  cookieStore.set("app_locale", locale, options);
  // Backward compatibility with the existing dashboard locale implementation.
  cookieStore.set("dashboard_locale", locale, options);

  return NextResponse.json({ ok: true, locale });
}
