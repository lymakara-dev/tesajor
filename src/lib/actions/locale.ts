"use server";

import { cookies } from "next/headers";
import { isSupportedLocale, localeCookieName } from "@/i18n/config";

// Caller (LanguageToggle) follows up with router.refresh() to re-render
// the current route server-side with the new locale.
export async function setLocale(locale: string): Promise<void> {
  if (!isSupportedLocale(locale)) return;
  const cookieStore = await cookies();
  cookieStore.set(localeCookieName, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
