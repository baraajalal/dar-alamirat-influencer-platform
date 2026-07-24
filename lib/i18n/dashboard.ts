import ar from "@/messages/dashboard/ar.json";
import en from "@/messages/dashboard/en.json";

export type DashboardLocale = "ar" | "en";
export type DashboardDictionary = typeof ar;

export function normalizeDashboardLocale(value?: string | null): DashboardLocale {
  return value === "en" ? "en" : "ar";
}

export function getDashboardDictionary(locale: DashboardLocale): DashboardDictionary {
  return locale === "en" ? (en as DashboardDictionary) : ar;
}

export function dashboardDirection(locale: DashboardLocale) {
  return locale === "ar" ? "rtl" : "ltr";
}
