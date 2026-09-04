# Backend setup — operator checklist

This app (Next.js 13 App Router + Supabase) ships with a full backend that
**degrades gracefully to demo behavior when server secrets are unset**. Nothing
below is required to run a demo, but all of it is required to run for real
(privileged admin panel + real Razorpay payments + webhook activation).

Follow the steps in order.

---

## 1. Environment variables

Copy `.env.example` → `.env.local` and fill in the values. In production set the
same variables in your host (Netlify / Vercel / Bolt) dashboard.

| Variable | Where to get it | Public? | If unset |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL | ✅ public | App can't reach Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → `anon` public key | ✅ public | App can't reach Supabase |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Razorpay → Settings → API Keys → Key Id | ✅ public | Payments run in **demo mode** |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → `service_role` key | ⛔ **server-only** | Admin API returns **503**; verify falls back to client-side demo activation |
| `ADMIN_PIN` | You choose it (e.g. a 6-digit PIN) | ⛔ **server-only** | Admin API returns **503** |
| `RAZORPAY_KEY_SECRET` | Razorpay → Settings → API Keys → Key Secret | ⛔ **server-only** | Payments run in **demo mode** |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay → Settings → Webhooks → the secret you set | ⛔ **server-only** | Webhook endpoint no-ops (demo) |

> ⚠️ Server-only variables must **never** be prefixed with `NEXT_PUBLIC_` — that
> would embed them in the browser bundle. Never commit any `.env` file.

`isAdminConfigured()` requires all three of: `NEXT_PUBLIC_SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, and `ADMIN_PIN`.

---

## 2. Supabase — apply the SQL migration

Apply every file in `supabase/migrations/` in timestamp order. If your project
is already on the earlier migrations, you only need the newest one:

```
supabase/migrations/20260901000000_harden_reports_and_autohide.sql
```

To apply it, open **Supabase → SQL Editor**, paste the file contents, and run.
It:

- adds partial unique indexes so a user can report a listing only once;
- recreates `guard_jobs_status` / `guard_walkins_status` so auto-hide can flip a
  listing to `reported` (SECURITY DEFINER, locked `search_path`, `EXECUTE`
  revoked from public/anon/authenticated);
- recreates `auto_hide_on_reports()` with the same hardening;
- includes a **commented-out** `pg_cron` job to auto-expire listings whose
  `paid_until` has passed. To enable it: Supabase → Database → Extensions →
  enable `pg_cron`, then uncomment the `cron.schedule(...)` block at the bottom
  of the migration and run it.

---

## 3. Razorpay

1. Create a Razorpay account and grab **Key Id** + **Key Secret**
   (Settings → API Keys). Put them in `NEXT_PUBLIC_RAZORPAY_KEY_ID` and
   `RAZORPAY_KEY_SECRET`.
2. Listing price is fixed at **Rs 100 = 10000 paise** in the server routes.
3. Configure a webhook (Settings → Webhooks):
   - **URL:** `https://YOUR_DOMAIN/api/razorpay/webhook`
   - **Secret:** any strong string — also set it as `RAZORPAY_WEBHOOK_SECRET`.
   - **Active events:** `payment.captured` and `order.paid`.
   - The webhook activates the walk-in via `order.notes.walkin_id`.

Payment flow:

- `POST /api/razorpay/order` creates an order (returns `{ demo: true }` if
  Razorpay is unconfigured or the API call fails).
- Checkout runs client-side; on success the browser calls
  `POST /api/razorpay/verify`, which checks the HMAC signature, fetches the
  payment, requires `status === 'captured'` and `amount === 10000`, then
  activates the walk-in (`status: 'live'`, `paid_until = now + 7 days`).
- If the service key is missing, verify returns
  `{ demo: true, activateClientSide: true }` and the browser runs the demo
  activation instead.

---

## 4. Bolt / host deployment

Set every variable from step 1 in the host's environment settings (Bolt →
project env, or Netlify/Vercel dashboard). Redeploy after changing env vars.
Keep the service role key, admin PIN, and Razorpay secrets in the **server**
environment only.

---

## 5. Verify

- `npx tsc --noEmit` → 0 errors
- `npm run lint`
- Visit `/admin`, enter `ADMIN_PIN` → should load walk-ins, jobs, and recent
  reports (503 toast if server not configured, "Wrong PIN" on 401).
- Post a walk-in and pay → real Razorpay Checkout opens when keys are set,
  otherwise demo activation.
