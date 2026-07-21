import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-start gap-4 px-4 py-24">
      <h1 className="text-3xl font-semibold tracking-tight">
        Split bills without the headache.
      </h1>
      <p className="text-muted-foreground">
        Track who paid, who owes what, and settle up with the fewest
        payments possible.
      </p>
      <Link href="/register">
        <Button size="lg">Get started</Button>
      </Link>
    </div>
  );
}
