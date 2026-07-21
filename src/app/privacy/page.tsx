export const metadata = {
  title: "Privacy Policy — Tesajor",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-16">
      <div>
        <h1 className="text-2xl font-semibold">Privacy Policy</h1>
        <p className="mt-1 text-sm text-muted-foreground">Last updated: [DATE]</p>
      </div>

      <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
        <strong>This is a starting template, not legal advice.</strong> Update
        it to match what the Service actually collects as you build out
        Telegram integration, receipt OCR, and the trip planner&apos;s
        location features, and have a lawyer review it (GDPR/CCPA
        applicability depends on where your users are).
      </p>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">1. What we collect</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Account info: name, email, and password hash (or your Google
            profile info if you sign in with Google).</li>
          <li>Group and expense data you and other members enter: group
            names, expense titles/amounts/categories, receipt photos,
            notes, and settlements.</li>
          <li>Basic technical data: IP address and timestamps, used for
            rate-limiting and abuse prevention on sign-in and registration.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">2. How we use it</h2>
        <p className="text-sm text-muted-foreground">
          To operate the Service: authenticate you, show you your groups and
          balances, and let group members see the expenses and settlements
          you share with them. We don&apos;t sell your data.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">3. Who can see your data</h2>
        <p className="text-sm text-muted-foreground">
          Expenses, balances, and settlements you add to a group are visible
          to the other members of that group. Placeholder members (added
          before they have an account) can see the same data once they claim
          their spot via an invite link.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">4. Third parties</h2>
        <p className="text-sm text-muted-foreground">
          We use Google as an optional sign-in provider (Google sees you
          signed in to this app but not your expense data), and a database
          host to store the data above. [Add Telegram, receipt-OCR, maps,
          and payment providers here once those integrations ship.]
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">5. Data retention &amp; deletion</h2>
        <p className="text-sm text-muted-foreground">
          You can delete your account from your account settings at any
          time. Doing so removes your personal identifiers (name, email,
          login credentials) from your account and any groups you belonged
          to; expense and settlement records remain so other members&apos;
          balances stay accurate, but are no longer linked to your identity.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">6. Cookies</h2>
        <p className="text-sm text-muted-foreground">
          We use a session cookie to keep you signed in. We don&apos;t use
          third-party advertising or tracking cookies.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">7. Children</h2>
        <p className="text-sm text-muted-foreground">
          The Service isn&apos;t directed at children under 13 (or the
          relevant minimum age in your jurisdiction).
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">8. Changes</h2>
        <p className="text-sm text-muted-foreground">
          We may update this policy; material changes will be announced in
          the app.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">9. Contact</h2>
        <p className="text-sm text-muted-foreground">
          Questions about this policy or your data: [CONTACT EMAIL].
        </p>
      </section>
    </div>
  );
}
