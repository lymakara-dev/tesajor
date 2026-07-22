export const locales = ["en", "km"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";
export const localeCookieName = "locale";

export const localeLabels: Record<Locale, string> = {
  en: "English",
  km: "ខ្មែរ",
};

export const localeShortLabels: Record<Locale, string> = {
  en: "EN",
  km: "KM",
};

export function isSupportedLocale(value: string | undefined | null): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}
