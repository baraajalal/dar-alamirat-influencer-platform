import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const accountType = requestUrl.searchParams.get("account_type");
  const defaultNext = accountType === "staff" ? "/staff/set-password" : "/set-password";
  const requestedNext = requestUrl.searchParams.get("next") || defaultNext;
  const next = requestedNext.startsWith("/") ? requestedNext : defaultNext;

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role,is_active,invitation_status")
        .eq("id", data.user.id)
        .maybeSingle();

      if (accountType === "staff") {
        if (!profile || profile.role === "influencer") {
          await supabase.auth.signOut();
          return NextResponse.redirect(new URL("/staff/login?error=not_staff", requestUrl.origin));
        }
        if (!profile.is_active || profile.invitation_status === "disabled") {
          await supabase.auth.signOut();
          return NextResponse.redirect(new URL("/staff/login?error=account_disabled", requestUrl.origin));
        }
        return NextResponse.redirect(new URL(next, requestUrl.origin));
      }

      return NextResponse.redirect(new URL(next, requestUrl.origin));
    }
  }

  const failurePath = accountType === "staff" ? "/staff/login?error=invalid_invite" : "/login?error=invalid_invite";
  return NextResponse.redirect(new URL(failurePath, requestUrl.origin));
}
