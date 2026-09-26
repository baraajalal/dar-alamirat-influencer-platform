import ar from "@/messages/app/ar.json";
import en from "@/messages/app/en.json";
import type { AppLocale } from "@/lib/i18n/app";

export type AppDictionary = typeof ar;

export function getAppDictionary(locale: AppLocale): AppDictionary {
  return locale === "en" ? (en as AppDictionary) : ar;
}
