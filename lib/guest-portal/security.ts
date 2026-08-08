import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { digitsOnly } from "@/lib/influencers/mobile";

export const GUEST_SESSION_COOKIE = "da_guest_portal_session";
export const GUEST_SESSION_DAYS = 7;

export function createOpaqueToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function hashOpaqueValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function normalizeDigits(value: string) {
  return digitsOnly(value);
}

export function lastFourDigits(value: string) {
  return normalizeDigits(value).slice(-4);
}

export function secureEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function isValidRawToken(value: string) {
  return /^[A-Za-z0-9_-]{32,256}$/.test(value);
}

export function guestSessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires: expiresAt,
  };
}

export function sanitizeFilename(value: string) {
  const cleaned = value
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 100);
  return cleaned || "upload";
}

export function normalizeExternalUrl(value: string) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

type LinkRow = {
  id: string;
  assignment_id: string;
  token_hash: string;
  expires_at: string;
  is_active: boolean;
  failed_attempts: number;
  max_attempts: number;
  locked_at: string | null;
  campaign_assignments: {
    id: string;
    influencer_id: string;
    influencers: { mobile_e164: string; full_name: string } | null;
  } | null;
};

export async function findGuestLink(rawToken: string) {
  if (!isValidRawToken(rawToken)) return null;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("submission_links")
    .select("id,assignment_id,token_hash,expires_at,is_active,failed_attempts,max_attempts,locked_at,campaign_assignments(id,influencer_id,influencers(mobile_e164,full_name))")
    .eq("token_hash", hashOpaqueValue(rawToken))
    .maybeSingle();

  if (error) throw new Error(error.message);
  return { admin, link: (data ?? null) as unknown as LinkRow | null };
}

export function guestLinkIsUsable(link: LinkRow) {
  return (
    link.is_active &&
    !link.locked_at &&
    new Date(link.expires_at).getTime() > Date.now() &&
    link.failed_attempts < link.max_attempts
  );
}

export async function requireGuestSession(rawToken: string) {
  const found = await findGuestLink(rawToken);
  if (!found?.link || !guestLinkIsUsable(found.link)) return null;

  const cookieStore = await cookies();
  const rawSession = cookieStore.get(GUEST_SESSION_COOKIE)?.value ?? "";
  if (!isValidRawToken(rawSession)) return null;

  const { data: session, error } = await found.admin
    .from("guest_portal_sessions")
    .select("id,submission_link_id,expires_at,revoked_at")
    .eq("session_hash", hashOpaqueValue(rawSession))
    .eq("submission_link_id", found.link.id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!session || session.revoked_at || new Date(session.expires_at).getTime() <= Date.now()) return null;

  await Promise.all([
    found.admin
      .from("guest_portal_sessions")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", session.id),
    found.admin
      .from("submission_links")
      .update({ last_opened_at: new Date().toISOString(), used_at: new Date().toISOString() })
      .eq("id", found.link.id),
  ]);

  return {
    admin: found.admin,
    link: found.link,
    sessionId: session.id as string,
    assignmentId: found.link.assignment_id,
  };
}

export function hashUserAgent(value: string | null) {
  return value ? hashOpaqueValue(value).slice(0, 32) : null;
}
