# Deploying to Vercel + Neon

## 1. Database (Neon)

1. Create a project at [neon.tech](https://neon.tech) and copy the pooled
   connection string (Neon encrypts data at rest by default).
2. Run migrations against it from your machine before the first deploy:

   ```bash
   DATABASE_URL="<neon-connection-string>" pnpm db:migrate
   ```

## 2. Google OAuth (optional)

If you want Google sign-in in production, create an OAuth client at
[Google Cloud Console](https://console.cloud.google.com/apis/credentials)
with an authorized redirect URI of
`https://<your-domain>/api/auth/callback/google`.

## 3. Vercel

1. Import the repo at [vercel.com/new](https://vercel.com/new).
2. Set the environment variables below in the Vercel project settings.
3. Deploy. Vercel builds with `pnpm build` and serves the App Router routes
   as serverless functions automatically — no extra config needed.

### Required environment variables

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Neon pooled connection string |
| `AUTH_SECRET` | `openssl rand -base64 33` — must be set, unique per environment |
| `AUTH_URL` | `https://<your-domain>` |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Omit to leave Google sign-in disabled |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_BOT_USERNAME` / `TELEGRAM_WEBHOOK_SECRET` | Omit to leave Telegram payment requests disabled — see README "Telegram setup" |

## 4. Telegram (optional)

Once deployed, register the webhook against your production URL (this
needs to happen once per deploy domain, not on every deploy):

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -d "url=https://<your-domain>/api/telegram/webhook" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

## 5. Post-deploy checklist

- Visit `/terms` and `/privacy` and replace the `[PLACEHOLDER]` fields —
  they're a starting template, not reviewed legal text.
- Confirm account deletion works end-to-end (`/account`) before you have
  real users relying on it.
- The in-memory rate limiter (`src/lib/rate-limit.ts`) tracks counts per
  server process. Vercel can run multiple instances of a serverless
  function concurrently, so the effective limit is "per instance," not
  global — fine for basic abuse deterrence, but swap in a shared store
  (e.g. Upstash Redis) if you need a hard global limit.
- Receipt photos and payment-method QR codes (both uploaded and
  server-generated) currently save to `public/uploads/` on the server's
  local filesystem (`src/app/api/uploads/route.ts`,
  `src/lib/actions/payment-methods.ts`). That does **not** persist on
  Vercel's serverless filesystem between deploys/instances — swap this for
  object storage (e.g. Vercel Blob, S3, Cloudinary) before relying on
  either in production. Telegram payment requests specifically need the
  QR image to be reachable at a public URL, so this matters more once
  Telegram is enabled.
- No Stripe/billing is wired up yet (by choice, to avoid adding a paid
  third-party dependency without sign-off) — the app currently has no
  Pro-tier gating.
