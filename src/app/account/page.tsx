import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { paymentMethods, telegramAccounts, users } from "@/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EditProfileForm } from "@/components/edit-profile-form";
import { DeleteAccountForm } from "@/components/delete-account-form";
import { TelegramConnectCard } from "@/components/telegram-connect-card";
import { PaymentMethodsCard } from "@/components/payment-methods-card";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import type { Locale } from "@/i18n/config";
import { UserRound, Palette } from "lucide-react";

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const t = await getTranslations("account");
  const locale = (await getLocale()) as Locale;

  const [me] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);

  const [telegramAccount] = await db
    .select()
    .from(telegramAccounts)
    .where(eq(telegramAccounts.userId, session.user.id))
    .limit(1);

  const methods = await db
    .select()
    .from(paymentMethods)
    .where(eq(paymentMethods.userId, session.user.id));

  return (
    <div className="mx-auto max-w-[480px] space-y-6 px-4 py-10">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5 text-base">
            <UserRound className="size-4 text-mekong" strokeWidth={1.5} />
            {t("profile")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EditProfileForm
            name={me?.name ?? session.user.name ?? ""}
            email={me?.email ?? session.user.email ?? ""}
            image={me?.image ?? null}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5 text-base">
            <Palette className="size-4 text-mekong" strokeWidth={1.5} />
            {t("preferences")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">{t("appearance")}</p>
            <ThemeToggle />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">{t("language")}</p>
            <LanguageToggle current={locale} />
          </div>
        </CardContent>
      </Card>

      <TelegramConnectCard
        linked={Boolean(telegramAccount)}
        username={telegramAccount?.username ?? null}
        hasChatId={Boolean(telegramAccount?.chatId)}
      />

      <PaymentMethodsCard
        ownerName={session.user.name ?? ""}
        methods={methods.map((m) => ({
          id: m.id,
          label: m.label,
          qrImageUrl: m.qrImageUrl,
          paymentLink: m.paymentLink,
          isDefault: m.isDefault,
        }))}
      />

      <DeleteAccountForm email={session.user.email ?? ""} />
    </div>
  );
}
