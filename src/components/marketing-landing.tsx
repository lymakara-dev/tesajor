import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/Logo";
import { UserPlus, LogIn } from "lucide-react";

export async function MarketingLanding() {
  const t = await getTranslations("marketing");
  const features = t.raw("features") as { title: string; body: string }[];

  return (
    <div className="flex flex-col">
      <section className="mx-auto flex max-w-[480px] flex-col items-start gap-4 px-4 py-24">
        <Logo variant="lockup" size={48} animate />
        <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
          {t("headline")}
        </h1>
        <p className="text-muted-foreground text-lg">{t("subtitle")}</p>
        <div className="flex gap-3">
          <Link href="/register">
            <Button size="lg">
              <UserPlus className="size-4" strokeWidth={1.5} />
              {t("getStarted")}
            </Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="outline">
              <LogIn className="size-4" strokeWidth={1.5} />
              {t("signIn")}
            </Button>
          </Link>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-[480px] gap-4 px-4 pb-24 sm:grid-cols-2">
        {features.map((f) => (
          <Card key={f.title}>
            <CardHeader>
              <CardTitle className="text-base">{f.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {f.body}
            </CardContent>
          </Card>
        ))}
      </section>

      <footer className="border-t">
        <div className="mx-auto flex max-w-[480px] flex-wrap items-center justify-between gap-2 px-4 py-6 text-sm text-muted-foreground">
          <span>{t("copyright", { year: new Date().getFullYear() })}</span>
          <div className="flex gap-4">
            <Link href="/terms" className="underline">
              {t("terms")}
            </Link>
            <Link href="/privacy" className="underline">
              {t("privacy")}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
