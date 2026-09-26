"use client";

import { useEffect } from "react";
import type { AppLocale } from "@/lib/i18n/app";

/**
 * Legacy compatibility shell.
 *
 * IMPORTANT:
 * We intentionally do not translate or mutate text nodes in the DOM.
 * Next.js 16 can stream/hydrate nested boundaries after this component has
 * mounted. Mutating document.body with DOM text walkers or observers
 * can therefore change server-rendered text before a nested boundary hydrates,
 * producing hydration mismatches and corrupting dynamic data such as creator
 * names (e.g. Arabic fragments inside a person's name).
 *
 * All visible UI translation must come from the SSR-safe dictionaries.
 * Database/user-generated values must be rendered exactly as stored.
 */
export function GlobalTranslator({ locale }: { locale: AppLocale }) {
  useEffect(() => {
    document.documentElement.lang = locale === "ar" ? "ar" : "en";
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
    document.documentElement.dataset.locale = locale;
  }, [locale]);

  return null;
}
