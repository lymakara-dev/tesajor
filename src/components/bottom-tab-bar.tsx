"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { House, Users, Plus, MapPinned, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function BottomTabBar() {
  const pathname = usePathname();
  const t = useTranslations("common");

  const tabs = [
    { href: "/", label: t("home"), icon: House },
    { href: "/groups", label: t("groups"), icon: Users },
    { href: "/trips", label: t("trips"), icon: MapPinned },
    { href: "/account", label: t("account"), icon: UserRound },
  ];

  return (
    <nav
      className="elevation-8-top fixed inset-x-0 bottom-0 z-40 border-t border-sandstone bg-background pb-[env(safe-area-inset-bottom)] sm:hidden"
      aria-label={t("navigation")}
    >
      <div className="mx-auto flex max-w-[480px] items-center justify-between px-2">
        {tabs.slice(0, 2).map((tab) => (
          <TabLink key={tab.href} {...tab} active={isActive(pathname, tab.href)} />
        ))}

        <Link
          href="/groups"
          aria-label={t("add")}
          className="elevation-6 -mt-5 flex size-12 shrink-0 items-center justify-center rounded-full bg-saffron text-rice transition-transform active:scale-95"
        >
          <Plus className="size-6" strokeWidth={2} />
        </Link>

        {tabs.slice(2).map((tab) => (
          <TabLink key={tab.href} {...tab} active={isActive(pathname, tab.href)} />
        ))}
      </div>
    </nav>
  );
}

function TabLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: typeof House;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium transition-colors",
        active ? "text-mekong" : "text-muted-foreground",
      )}
    >
      <Icon className="size-5" strokeWidth={1.5} />
      {label}
    </Link>
  );
}
