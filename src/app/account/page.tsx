import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { paymentMethods, telegramAccounts } from "@/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeleteAccountForm } from "@/components/delete-account-form";
import { TelegramConnectCard } from "@/components/telegram-connect-card";
import { PaymentMethodsCard } from "@/components/payment-methods-card";

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

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
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <h1 className="text-2xl font-semibold">Account</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>
            <span className="text-muted-foreground">Name: </span>
            {session.user.name}
          </p>
          <p>
            <span className="text-muted-foreground">Email: </span>
            {session.user.email}
          </p>
        </CardContent>
      </Card>

      <TelegramConnectCard
        linked={Boolean(telegramAccount)}
        username={telegramAccount?.username ?? null}
        hasChatId={Boolean(telegramAccount?.chatId)}
      />

      <PaymentMethodsCard
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
