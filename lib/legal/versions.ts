export const LEGAL_DOCUMENT_VERSIONS = {
  terms: "2026-09-11-v1",
  privacy: "2026-09-11-v1",
} as const;

export type LegalLocale = "ar" | "en";

export function normalizeLegalLocale(value?: string | null): LegalLocale {
  return value === "en" ? "en" : "ar";
}
