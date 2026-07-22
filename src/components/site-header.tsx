import Link from "next/link";
import { getTranslations, getLocale } from "next-intl/server";
import { auth, signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { LanguageToggle } from "@/components/language-toggle";
import type { Locale } from "@/i18n/config";

export async function SiteHeader() {
  const session = await auth();
  const t = await getTranslations("common");
  const locale = (await getLocale()) as Locale;

  return (
    <>
      {/* Krama ribbon — one of the 3 sanctioned uses of the gingham pattern. */}
      <div className="krama-pattern h-1" aria-hidden="true" />
      <header className="border-b border-sandstone">
        <div className="mx-auto flex max-w-[480px] items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center">
            <Logo variant="lockup" size={32} />
          </Link>
          <nav className="flex items-center gap-2">
            {session?.user ? (
              <>
                {/* Redundant on mobile once the bottom tab bar takes over
                    primary navigation there; kept for desktop. */}
                <Link href="/groups" className="hidden text-sm font-medium sm:inline">
                  {t("groups")}
                </Link>
                <Link href="/trips" className="hidden text-sm font-medium sm:inline">
                  {t("trips")}
                </Link>
                <Link href="/account" className="hidden text-sm font-medium sm:inline">
                  {t("account")}
                </Link>
                <LanguageToggle current={locale} />
                <form
                  action={async () => {
                    "use server";
                    await signOut({ redirectTo: "/" });
                  }}
                >
                  <Button variant="ghost" size="sm" type="submit">
                    {t("signOut")}
                  </Button>
                </form>
              </>
            ) : (
              <>
                <Link href="/login" className="text-sm font-medium">
                  {t("signIn")}
                </Link>
                <LanguageToggle current={locale} />
                <Link href="/register">
                  <Button size="sm">{t("getStarted")}</Button>
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
    </>
  );
}
