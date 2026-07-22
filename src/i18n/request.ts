import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { defaultLocale, isSupportedLocale, localeCookieName } from "./config";

// Cookie-based locale, no URL prefix — every route keeps its exact same
// path (/groups, /trips/[id], ...), which matters here specifically
// because it keeps the existing Playwright test's exact-match
// waitForURL() calls intact.
export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(localeCookieName)?.value;
  const locale = isSupportedLocale(cookieLocale) ? cookieLocale : defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
