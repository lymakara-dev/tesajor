# Playbook: Add or change user-facing text (i18n)

**Use when**: any string a user will see — labels, buttons, errors, empty
states, toasts. The app ships in English and Khmer; a hard-coded string is
a review blocker.
**Copy the shape from**: any component using `useTranslations` /
`getTranslations`, and the existing key structure in `messages/en.json`.

## Steps

1. Find the right namespace in `messages/en.json` — keys are grouped by
   feature/screen. Follow the neighboring keys' naming style.
2. Add the key to **both** `messages/en.json` and `messages/km.json` in the
   same position. If you cannot write natural Khmer, still add the km key —
   with the English text and a `// TODO` marker is *not* possible in JSON,
   so instead: add the English string as the km value and list the key in
   your PR description under "needs Khmer translation" so a human
   translates it before release. Never omit the key (missing keys render
   as raw key names).
3. Use it in code (namespaces are lowercase: `"common"`, `"home"`,
   `"marketing"`, …):
   - Client component: `const t = useTranslations("common");` → `t("key")`.
   - Server component: `const t = await getTranslations("marketing");`
     (from `next-intl/server` — see `src/components/marketing-landing.tsx`).
   - Interpolation: `t("owes", { name, amount })` with
     `"owes": "{name} owes {amount}"` in the JSON.
4. Money and dates are **not** translated by hand: format money via
   `src/lib/money/currency.ts` (Intl-based, KHR-aware) and dates via
   Intl / next-intl formatters, so locale switching stays correct.
5. Verify: `pnpm lint && pnpm exec tsc --noEmit`, then switch the app
   language to Khmer in the UI and eyeball the changed screen — Khmer
   strings run longer/taller; check nothing truncates on a mobile
   viewport.

## Don't

- Don't concatenate translated fragments (`t("owes") + name`) — word order
  differs between English and Khmer; use interpolation.
- Don't reuse a key from another screen because the English happens to
  match; the Khmer may need to differ by context.
- Don't put currency symbols or amounts inside translation strings — pass
  formatted values as interpolation parameters.
