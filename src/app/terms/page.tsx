export const metadata = {
  title: "Terms of Service — Tesajor",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-16">
      <div>
        <h1 className="text-2xl font-semibold">Terms of Service</h1>
        <p className="mt-1 text-sm text-muted-foreground">Last updated: [DATE]</p>
      </div>

      <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
        <strong>This is a starting template, not legal advice.</strong> Replace
        the bracketed placeholders and have a lawyer review this before
        launching commercially — requirements vary by jurisdiction and by
        what you actually do with user data (e.g. Telegram messaging,
        location data for the trip planner, payments).
      </p>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">1. Acceptance of terms</h2>
        <p className="text-sm text-muted-foreground">
          By creating an account or using [PRODUCT NAME] (&quot;the
          Service&quot;), operated by [COMPANY NAME] (&quot;we&quot;,
          &quot;us&quot;), you agree to these Terms of Service. If you do not
          agree, do not use the Service.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">2. The Service</h2>
        <p className="text-sm text-muted-foreground">
          The Service lets you track shared expenses, compute balances
          between group members, and record settlements. Balance and
          settlement suggestions are calculated from data you and other
          members enter; we are not a party to any payment and do not
          guarantee any member will actually pay what they owe.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">3. Accounts</h2>
        <p className="text-sm text-muted-foreground">
          You are responsible for the accuracy of information you submit and
          for safeguarding your account credentials. You must be old enough
          to form a binding contract in your jurisdiction to use the
          Service.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">4. Acceptable use</h2>
        <p className="text-sm text-muted-foreground">
          Don&apos;t use the Service to harass others, upload unlawful
          content, attempt to access another user&apos;s data without
          authorization, or interfere with the Service&apos;s operation.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">5. Your content</h2>
        <p className="text-sm text-muted-foreground">
          You retain ownership of the expense data, receipt photos, and
          notes you upload. You grant us a license to store and display
          that content to the group members you share it with, solely to
          operate the Service.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">6. Paid plans</h2>
        <p className="text-sm text-muted-foreground">
          [If/when a paid Pro tier is enabled: describe billing terms,
          renewal, refunds, and how to cancel here.]
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">7. Termination</h2>
        <p className="text-sm text-muted-foreground">
          You may delete your account at any time from your account
          settings. We may suspend or terminate accounts that violate these
          terms.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">8. Disclaimers &amp; liability</h2>
        <p className="text-sm text-muted-foreground">
          The Service is provided &quot;as is&quot; without warranties of
          any kind. To the maximum extent permitted by law, [COMPANY NAME]
          is not liable for indirect, incidental, or consequential damages
          arising from your use of the Service, including disputes over
          money owed between users.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">9. Changes</h2>
        <p className="text-sm text-muted-foreground">
          We may update these terms; continued use after changes take effect
          means you accept the updated terms.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">10. Contact</h2>
        <p className="text-sm text-muted-foreground">
          Questions about these terms: [CONTACT EMAIL].
        </p>
      </section>
    </div>
  );
}
