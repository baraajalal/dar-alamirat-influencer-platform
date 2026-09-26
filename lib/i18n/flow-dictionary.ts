import ar from "@/messages/flows/ar.json";
import en from "@/messages/flows/en.json";
import type { AppLocale } from "@/lib/i18n/app";

export type FlowDictionary = typeof ar;

export function getFlowDictionary(locale: AppLocale): FlowDictionary {
  return locale === "en" ? (en as FlowDictionary) : ar;
}

export function formatFlowMessage(
  template: string,
  values: Record<string, string | number>,
) {
  return Object.entries(values).reduce(
    (message, [key, value]) => message.replaceAll(`{${key}}`, String(value)),
    template,
  );
}
