import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export async function SiteHeader() {
  const session = await auth();

  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
        <Link href="/" className="font-semibold">
          Tesajor
        </Link>
        <nav className="flex items-center gap-3">
          {session?.user ? (
            <>
              <Link href="/groups" className="text-sm">
                Groups
              </Link>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/" });
                }}
              >
                <Button variant="ghost" size="sm" type="submit">
                  Sign out
                </Button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="text-sm">
                Sign in
              </Link>
              <Link href="/register">
                <Button size="sm">Get started</Button>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
