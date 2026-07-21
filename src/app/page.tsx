import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const features = [
  {
    title: "Five ways to split",
    body: "Equal, exact amounts, percentages, shares, or itemized — tag who ate what and split tax & tip proportionally.",
  },
  {
    title: "Multiple payers, one bill",
    body: "Two people split the check? Add every payer and their amount — the math always reconciles to the cent.",
  },
  {
    title: "Simplify debts",
    body: "One tap turns a tangle of IOUs into the minimum number of payments needed to settle the whole group.",
  },
  {
    title: "Full activity trail",
    body: "Every expense and settlement is logged and editable, so nothing gets lost or double-counted.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-col">
      <section className="mx-auto flex max-w-2xl flex-col items-start gap-4 px-4 py-24">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Split bills without the headache.
        </h1>
        <p className="text-muted-foreground text-lg">
          Track who paid, who owes what, and settle up with the fewest
          payments possible — built for splitting the bill right at the
          table.
        </p>
        <div className="flex gap-3">
          <Link href="/register">
            <Button size="lg">Get started — it&apos;s free</Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="outline">
              Sign in
            </Button>
          </Link>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-2xl gap-4 px-4 pb-24 sm:grid-cols-2">
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
        <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-sm text-muted-foreground">
          <span>&copy; {new Date().getFullYear()} Tesajor</span>
          <div className="flex gap-4">
            <Link href="/terms" className="underline">
              Terms
            </Link>
            <Link href="/privacy" className="underline">
              Privacy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
