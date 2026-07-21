import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeleteAccountForm } from "@/components/delete-account-form";

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

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

      <DeleteAccountForm email={session.user.email ?? ""} />
    </div>
  );
}
