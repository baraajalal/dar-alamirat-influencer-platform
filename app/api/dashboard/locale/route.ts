import { NextResponse } from "next/server";

const ONE_YEAR = 60 * 60 * 24 * 365;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { locale?: unknown } | null;
  const locale = body?.locale === "en" ? "en" : body?.locale === "ar" ? "ar" : null;

  if (!locale) {
    return NextResponse.json({ ok: false, error: "invalid_locale" }, { status: 400 });
  }

  const response = NextResponse.json({ ok: true, locale });
  response.cookies.set("dashboard_locale", locale, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR,
  });
  return response;
}
