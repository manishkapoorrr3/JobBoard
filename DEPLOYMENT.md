# Deploying NCR Walk-in to production

This is a Next.js 13 (App Router) app backed by Supabase (Postgres + Auth) and
paid listing activation via Razorpay. It deploys to **Netlify**.

There are two things to stand up:

1. **Supabase** — creates the database schema, tables, RLS policies, and the
   seed user. The app reads/writes data through the **anon key** (safe in the
   browser; Row Level Security guards every query).
2. **Netlify** — hosts the Next.js build and injects the environment variables.

> **Do the Supabase step first**, then set Netlify env vars **before** you
> trigger the Netlify build. The build **requires** `NEXT_PUBLIC_SUPABASE_URL`
> and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to be present, otherwise prerendering
> fails with `Error: supabaseUrl is required.`

---

## Part 1 — Supabase (apply the migrations)

Your project already exists. You just need to apply the schema.

1. Sign in to [https://supabase.com](https://supabase.com) and open your project.
2. In the left sidebar go to **SQL Editor** → **New query**.
3. Paste the **entire contents** of **`supabase/combined-migrations.sql`** into
   the editor, then click **Run**.
   - This runs the 5 migrations in order: create tables, harden the status-guard
     triggers, add location columns, upgrade to the walk-in schema, and create
     the seed user. It is safe to run even if some parts already exist.
4. In the left sidebar go to **Settings → API** (or **Data API**).
   - Copy the **Project URL** — looks like `https://<ref>.supabase.co`.
   - Copy the **anon public key** (the public `anon` key, **not** `service_role` —
     the service role key bypasses RLS, so never use it in the browser).
5. In **Authentication → Providers → Email** — email confirmation is expected to
   be **off** (the schema relies on signup not requiring confirmation). If you
   want users to verify email, flip it on; account creation still works, they'll
   just need to click the confirmation link.

Keep the **Project URL** and **anon key** handy — you need them in Part 2.

> Want it fully managed instead? Run `supabase db push` from this repo with the
> Supabase CLI (set your `SUPABASE_ACCESS_TOKEN` and link the project). The
> SQL-editor path above needs no CLI.

---

## Part 2 — Netlify (deploy the app)

1. Go to [https://app.netlify.com](https://app.netlify.com).
2. **Add new site → Import an existing project → GitHub**.
   - Select the `manishkapoorrr3/JobBoard` repo.
   - Netlify auto-detects the config from **`netlify.toml`**:
     - Build command: `npx next build`
     - Publish directory: `.next`
     - Plugin: `@netlify/plugin-nextjs`
   - If prompted, pick the `main` branch (or create a deploy from `main`).
3. **Before the first build**, set the environment variables:
   **Site settings → Environment variables → Add a variable**. Add all four:

   | Variable | Value |
   |----------|-------|
   | `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |
   | `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Your Razorpay key ID (leave blank for demo pay) |
   | `NEXT_PUBLIC_ADMIN_PIN` | Admin PIN for `/admin` (default in code is `499499`) |

   > `NEXT_PUBLIC_*` variables are **inlined at build time**, so they must be
   > set before triggering the build. Changing them later requires a redeploy.

4. Click **Deploy site**. Netlify builds and publishes. You get a URL like
   `https://<random-name>.netlify.app`.
5. (Optional, recommended) **Site settings → Domain management** to attach a
   custom domain such as `ncrwalkin.com` with automatic HTTPS.

---

## Part 3 — Seed sample data (optional)

The schema seeds a `seed@ncrwalkin.internal` owner so sample listings can exist,
but no sample listings are auto-created. To add a few, either:

- Use the app: log in as a recruiter → **Post a walk-in** → fill the form →
  **Demo pay** (activates it to `live`), or
- Insert directly in the Supabase SQL Editor, e.g.:

```sql
insert into walkins (
  posted_by_user_id, company_name, role_title, category, city, area,
  location_address, walkin_date, walkin_time, salary_min, salary_max,
  education, shift, cab, languages, whatsapp_number, description, status, is_sample
) values (
  '00000000-0000-0000-0000-000000000001',  -- seed user id
  'Acme BPO', 'Customer Support Executive', 'Voice', 'Noida', 'Sector 62',
  'Plot 12, Sector 62, Noida', current_date + 1, '10:00 - 14:00',
  18000, 25000, '12th', 'Day', true, 'English', '9876543210',
  'Voice process, cab available, week off Sunday.', 'live', true
);
```

---

## Part 4 — Verify

- Open your Netlify URL: the home page, `/walkins`, `/jobs`, `/login`,
  `/signup`, `/pricing` should all load.
- Log in / sign up and confirm your profile saves (this exercises Supabase).
- Post a walk-in and **Demo pay** — it should go live and appear on `/walkins`.
- Check `/admin` with your `NEXT_PUBLIC_ADMIN_PIN` to moderate listings.

---

## Local development

```bash
cp .env.example .env.local   # fill in your real Supabase URL + anon key, etc.
npm install
npm run dev                  # http://localhost:3000
```

`.env.local` is gitignored so local secrets never get committed.

---

## Troubleshooting

- **Build fails with `supabaseUrl is required.`** → the build-time env vars
  weren't set. Add `NEXT_PUBLIC_SUPABASE_URL` (and the anon key) to Netlify's
  Environment variables, then trigger a new deploy.
- **Logins fail / "Invalid login credentials"** → check Supabase
  Authentication settings and disable email confirmation (or confirm emails).
- **Lists are empty** → check that walk-ins/jobs have status `live`/`approved`
  (the public RLS policy only exposes `live` and `approved`). Recruiters must
  pay / approve to make a posting visible.
- **`/admin` doesn't open** → the `NEXT_PUBLIC_ADMIN_PIN` env var differs from
  what you typed, or it was left at the default `499499`.
- **Payments** → set `NEXT_PUBLIC_RAZORPAY_KEY_ID` to enable real Razorpay
  checkout; otherwise the app runs in demo mode (activates without charging).
