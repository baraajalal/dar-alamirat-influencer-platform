const ARABIC_INDIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const EASTERN_ARABIC_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

export function toLatinDigits(value: string | null | undefined) {
  return String(value ?? "").replace(/[٠-٩۰-۹]/g, (digit) => {
    const arabicIndex = ARABIC_INDIC_DIGITS.indexOf(digit);
    if (arabicIndex >= 0) return String(arabicIndex);

    const easternIndex = EASTERN_ARABIC_DIGITS.indexOf(digit);
    return easternIndex >= 0 ? String(easternIndex) : digit;
  });
}

export function digitsOnly(value: string | null | undefined) {
  return toLatinDigits(value).replace(/\D/g, "");
}

/**
 * Normalizes commonly-entered Saudi mobile formats to 9665XXXXXXXX.
 * Accepted examples include 05..., 5..., 9665..., +9665..., 009665...,
 * Arabic/Persian digits, spaces, dashes, and parentheses.
 */
export function normalizeSaudiMobile(value: string | null | undefined) {
  let digits = digitsOnly(value);

  if (digits.startsWith("00966")) {
    digits = digits.slice(2);
  }

  // Tolerate the common accidental format 96605XXXXXXXX.
  if (digits.startsWith("96605") && digits.length === 13) {
    digits = `966${digits.slice(4)}`;
  }

  if (digits.startsWith("9665") && digits.length === 12) {
    return digits;
  }

  if (digits.startsWith("05") && digits.length === 10) {
    return `966${digits.slice(1)}`;
  }

  if (digits.startsWith("5") && digits.length === 9) {
    return `966${digits}`;
  }

  return null;
}

export function isSaudiMobile(value: string | null | undefined) {
  return normalizeSaudiMobile(value) !== null;
}
