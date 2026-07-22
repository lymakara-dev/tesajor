import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { joinTripByInviteCode } from "@/lib/actions/trips";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function JoinTripPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/trips/join/${code}`)}`);
  }

  const result = await joinTripByInviteCode({ inviteCode: code });

  if (!result.ok) {
    return (
      <div className="mx-auto max-w-md px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle>Couldn&apos;t join trip</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {result.error}
          </CardContent>
        </Card>
      </div>
    );
  }

  redirect(`/trips/${result.data.tripId}`);
}
