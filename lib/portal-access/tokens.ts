import { createHash, randomBytes } from "node:crypto";

export function generatePortalToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashPortalToken(token) };
}

export function hashPortalToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function portalTokenExpiry(hours = 72) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}
