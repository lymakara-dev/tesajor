import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";

export async function SiteHeader() {
  const session = await auth();

  return (
    <>
      {/* Krama ribbon — one of the 3 sanctioned uses of the gingham pattern. */}
      <div className="krama-pattern h-1" aria-hidden="true" />
      <header className="border-b border-sandstone">
        <div className="mx-auto flex max-w-[480px] items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center">
            <Logo variant="lockup" size={32} />
          </Link>
          <nav className="flex items-center gap-3">
            {session?.user ? (
              <>
                <Link href="/groups" className="text-sm font-medium">
                  Groups
                </Link>
                <Link href="/trips" className="text-sm font-medium">
                  Trips
                </Link>
                <Link href="/account" className="text-sm font-medium">
                  Account
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
                <Link href="/login" className="text-sm font-medium">
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
    </>
  );
}
