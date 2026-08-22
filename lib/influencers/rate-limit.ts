import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeMobile } from "@/lib/influencers/registration";
type RateLimitAction =
  | "lookup"
  | "register"
  | "save-profile"
  | "portal-access-request"
  | "location-option";
function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  return (
    forwarded?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local"
  );
}

function hash(value: string) {
  const secret =
    process.env.REGISTRATION_RATE_LIMIT_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "development-only";

  return createHash("sha256").update(`${secret}:${value}`).digest("hex");
}

export async function enforceRegistrationRateLimit({
  request,
  action,
  mobile,
  limit,
}: {
  request: Request;
  action: RateLimitAction;
  mobile?: string;
  limit: number;
}) {
  const supabase = createAdminClient();
  const ipHash = hash(clientIp(request));
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { count, error } = await supabase
    .from("registration_rate_limits")
    .select("id", { count: "exact", head: true })
    .eq("action", action)
    .eq("ip_hash", ipHash)
    .gte("created_at", oneHourAgo);

  if (error) {
    console.warn("Rate limit check failed:", error.message);
    return;
  }

  if ((count ?? 0) >= limit) {
    throw new Error("RATE_LIMITED");
  }

  await supabase.from("registration_rate_limits").insert({
    action,
    ip_hash: ipHash,
    mobile_hash: mobile ? hash(normalizeMobile(mobile)) : null,
  });
}
