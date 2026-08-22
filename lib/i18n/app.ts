export type AppLocale = "ar" | "en";

export function normalizeAppLocale(value?: string | null): AppLocale {
  return value === "en" ? "en" : "ar";
}

export function appDirection(locale: AppLocale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}

export function localeLabel(locale: AppLocale) {
  return locale === "ar" ? "العربية" : "English";
}
