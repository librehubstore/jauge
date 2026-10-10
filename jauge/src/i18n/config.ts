export const LOCALES = ["fr", "en", "es", "it", "pt", "de", "nl"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "fr";
export const LOCALE_COOKIE = "NEXT_LOCALE";

export function pickLocale(cookie?: string | null, acceptLanguage?: string | null): Locale {
  if (cookie && (LOCALES as readonly string[]).includes(cookie)) return cookie as Locale;
  for (const part of (acceptLanguage ?? "").split(",")) {
    const l = part.trim().slice(0, 2).toLowerCase();
    if ((LOCALES as readonly string[]).includes(l)) return l as Locale;
  }
  return DEFAULT_LOCALE;
}
