import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { joinGroupByInviteCode } from "@/lib/actions/groups";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function JoinGroupPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/groups/join/${code}`)}`);
  }

  const result = await joinGroupByInviteCode({ inviteCode: code });

  if (!result.ok) {
    const t = await getTranslations("join");
    return (
      <div className="mx-auto max-w-[480px] px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle>{t("couldNotJoinGroup")}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {result.error}
          </CardContent>
        </Card>
      </div>
    );
  }

  redirect(`/groups/${result.data.groupId}`);
}
