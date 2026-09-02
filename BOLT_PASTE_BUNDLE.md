# Bolt paste bundle — full backend
Fallback for Phase 2: if Bolt cannot pull from GitHub main, create/replace these files in the Bolt editor **in this order**. Paths are relative to the project root. Nothing else in the project needs to change.
| # | Path | Action |
| --- | --- | --- |
| 1 | `lib/supabase-admin.ts` | CREATE |
| 2 | `app/api/admin/route.ts` | CREATE |
| 3 | `app/api/razorpay/order/route.ts` | CREATE |
| 4 | `app/api/razorpay/verify/route.ts` | CREATE |
| 5 | `app/api/razorpay/webhook/route.ts` | CREATE |
| 6 | `supabase/migrations/20260901000000_harden_reports_and_autohide.sql` | CREATE |
| 7 | `app/admin/page.tsx` | REPLACE |
| 8 | `app/walkins/new/page.tsx` | REPLACE |
| 9 | `app/walkins/[id]/page.tsx` | REPLACE |
| 10 | `app/walkins/[id]/edit/page.tsx` | CREATE |
| 11 | `app/dashboard/page.tsx` | REPLACE |
| 12 | `app/login/page.tsx` | REPLACE |
| 13 | `app/signup/page.tsx` | REPLACE |
| 14 | `app/profile/saved/page.tsx` | REPLACE |
| 15 | `.env.example` | CREATE |
| 16 | `SETUP_BACKEND.md` | CREATE |

---

## 1. `lib/supabase-admin.ts`

```````ts
// Supabase service-role client (server-only).
//
// This client uses the SUPABASE_SERVICE_ROLE_KEY, which bypasses Row Level
// Security. It must NEVER be imported into client components or exposed to the
// browser. Only import it from route handlers / server code that runs on the
// Node.js runtime.
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined;

let cached: SupabaseClient | null = null;

/**
 * Returns a singleton Supabase client authenticated with the service-role key.
 * Throws if the required env vars are missing — callers should guard with
 * `isAdminConfigured()` (or their own check) before calling this in a code path
 * that must degrade gracefully to demo behavior.
 */
export function getServiceSupabase(): SupabaseClient {
  if (cached) return cached;
  if (!supabaseUrl || !serviceKey) {
    throw new Error(
      'Service Supabase client is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
    );
  }
  cached = createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return cached;
}

/**
 * True when the server has everything it needs to run privileged admin flows:
 * the Supabase URL, the service-role key, and an admin PIN. When false, callers
 * should degrade gracefully (return 503 / demo behavior) instead of throwing.
 */
export function isAdminConfigured(): boolean {
  return Boolean(supabaseUrl && serviceKey && process.env.ADMIN_PIN);
}

```````

## 2. `app/api/admin/route.ts`

```````ts
// Admin API — privileged read + status updates over the service-role client.
//
// Auth is a shared PIN passed in the `x-admin-pin` header, compared against
// process.env.ADMIN_PIN. All data access uses the service-role Supabase client
// (RLS-bypassing), so this route MUST run on the Node.js runtime and must never
// leak the service key to the browser.
import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase, isAdminConfigured } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Status values an admin is allowed to set, per table.
const ALLOWED_STATUS: Record<'walkins' | 'jobs', string[]> = {
  walkins: ['draft', 'live', 'expired', 'reported', 'pending', 'approved', 'rejected'],
  jobs: ['draft', 'live', 'expired', 'reported', 'pending', 'approved', 'rejected'],
};

function pinOk(req: NextRequest): boolean {
  const provided = req.headers.get('x-admin-pin') ?? '';
  const expected = process.env.ADMIN_PIN ?? '';
  return Boolean(expected) && provided === expected;
}

export async function GET(req: NextRequest) {
  if (!isAdminConfigured()) {
    return NextResponse.json(
      { error: 'Admin API is not configured on the server.', configured: false },
      { status: 503 }
    );
  }
  if (!pinOk(req)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const supabase = getServiceSupabase();

  const [walkinsRes, jobsRes, reportsRes] = await Promise.all([
    supabase.from('walkins').select('*').order('created_at', { ascending: false }),
    supabase.from('jobs').select('*').order('created_at', { ascending: false }),
    supabase.from('reports').select('*').order('created_at', { ascending: false }).limit(100),
  ]);

  if (walkinsRes.error || jobsRes.error || reportsRes.error) {
    return NextResponse.json(
      { error: 'Failed to load admin data.' },
      { status: 500 }
    );
  }

  const reports = reportsRes.data ?? [];

  // Per-listing report counts derived from the fetched reports.
  const walkinReportCounts: Record<string, number> = {};
  const jobReportCounts: Record<string, number> = {};
  for (const r of reports as Array<{ walkin_id: string | null; job_id: string | null }>) {
    if (r.walkin_id) walkinReportCounts[r.walkin_id] = (walkinReportCounts[r.walkin_id] ?? 0) + 1;
    if (r.job_id) jobReportCounts[r.job_id] = (jobReportCounts[r.job_id] ?? 0) + 1;
  }

  return NextResponse.json({
    walkins: walkinsRes.data ?? [],
    jobs: jobsRes.data ?? [],
    reports: reports.slice(0, 25),
    walkinReportCounts,
    jobReportCounts,
  });
}

export async function POST(req: NextRequest) {
  if (!isAdminConfigured()) {
    return NextResponse.json(
      { error: 'Admin API is not configured on the server.', configured: false },
      { status: 503 }
    );
  }
  if (!pinOk(req)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  let body: { table?: string; id?: string; status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { table, id, status } = body;
  if (table !== 'walkins' && table !== 'jobs') {
    return NextResponse.json({ error: 'Invalid table.' }, { status: 400 });
  }
  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'Missing id.' }, { status: 400 });
  }
  if (!status || !ALLOWED_STATUS[table].includes(status)) {
    return NextResponse.json({ error: 'Invalid status.' }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from(table)
    .update({ status })
    .eq('id', id)
    .select('id, status')
    .single();

  if (error) {
    return NextResponse.json({ error: 'Update failed.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, row: data });
}

```````

## 3. `app/api/razorpay/order/route.ts`

```````ts
// Razorpay — create order.
//
// Creates a Razorpay order for a walk-in listing (Rs 499 => 49900 paise).
// Degrades gracefully to demo mode ({ demo: true }) when the Razorpay key id /
// secret are not configured, or if the Razorpay API call fails, so the frontend
// can fall back to the existing client-side demo activation.
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Fixed listing price in paise (Rs 499).
const AMOUNT_PAISE = 49900;

export async function POST(req: NextRequest) {
  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  // No real Razorpay credentials => demo mode.
  if (!keyId || !keySecret) {
    return NextResponse.json({ demo: true });
  }

  let body: { walkin_id?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const walkinId = typeof body.walkin_id === 'string' ? body.walkin_id : undefined;

  // Razorpay receipt must be <= 40 chars.
  const receipt = `walkin_${(walkinId ?? 'na').slice(0, 30)}`;

  try {
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: AMOUNT_PAISE,
        currency: 'INR',
        receipt,
        notes: { walkin_id: walkinId ?? '' },
      }),
    });

    if (!res.ok) {
      // Razorpay rejected the request — fall back to demo so the user is not blocked.
      return NextResponse.json({ demo: true });
    }

    const order = await res.json();
    return NextResponse.json({
      demo: false,
      key_id: keyId,
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch {
    return NextResponse.json({ demo: true });
  }
}

```````

## 4. `app/api/razorpay/verify/route.ts`

```````ts
// Razorpay — verify payment and activate the walk-in.
//
// Steps:
//  1. Verify the checkout signature: HMAC-SHA256(order_id|payment_id, secret)
//     compared with a constant-time comparison.
//  2. Fetch the payment from Razorpay and require status === 'captured' and
//     amount === 49900 (Rs 499) to defend against tampering.
//  3. Activate the walk-in via the service-role client (status 'live',
//     paid_until = now + 7 days).
//
// Graceful degradation:
//  - No Razorpay secret  => { demo: true }
//  - No service-role key => { demo: true, activateClientSide: true } (the
//    browser will run the existing client-side demo activation).
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getServiceSupabase } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const AMOUNT_PAISE = 49900;

// Constant-time string comparison over hex signatures.
function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function POST(req: NextRequest) {
  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  // No Razorpay secret => demo mode.
  if (!keyId || !keySecret) {
    return NextResponse.json({ demo: true });
  }

  let body: {
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
    walkin_id?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, walkin_id } = body;
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return NextResponse.json({ error: 'Missing payment fields.' }, { status: 400 });
  }

  // 1. Verify the signature.
  const expected = crypto
    .createHmac('sha256', keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  if (!safeEqualHex(expected, razorpay_signature)) {
    return NextResponse.json({ error: 'Signature verification failed.' }, { status: 400 });
  }

  // 2. Fetch the payment and confirm it was captured for the right amount.
  try {
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const res = await fetch(`https://api.razorpay.com/v1/payments/${razorpay_payment_id}`, {
      headers: { Authorization: `Basic ${auth}` },
    });
    if (!res.ok) {
      return NextResponse.json({ error: 'Could not verify payment.' }, { status: 400 });
    }
    const payment = await res.json();
    if (payment.status !== 'captured' || payment.amount !== AMOUNT_PAISE) {
      return NextResponse.json({ error: 'Payment not captured or amount mismatch.' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'Could not verify payment.' }, { status: 400 });
  }

  // 3. Activate the walk-in. If there is no service key, ask the client to
  //    run its existing demo activation instead.
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ demo: true, activateClientSide: true });
  }

  const targetId = walkin_id;
  if (!targetId) {
    return NextResponse.json({ error: 'Missing walkin_id.' }, { status: 400 });
  }

  const paidUntil = new Date();
  paidUntil.setDate(paidUntil.getDate() + 7);

  const supabase = getServiceSupabase();
  const { error } = await supabase
    .from('walkins')
    .update({ status: 'live', paid_until: paidUntil.toISOString() })
    .eq('id', targetId);

  if (error) {
    return NextResponse.json({ error: 'Activation failed.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, paid_until: paidUntil.toISOString() });
}

```````

## 5. `app/api/razorpay/webhook/route.ts`

```````ts
// Razorpay — webhook receiver.
//
// Razorpay sends server-to-server events signed with the webhook secret. We
// verify the `x-razorpay-signature` header (HMAC-SHA256 of the raw body) and, on
// `payment.captured` or `order.paid`, activate the walk-in referenced by the
// order's notes.walkin_id via the service-role client.
//
// Degrades gracefully: without the webhook secret or the service-role key we
// acknowledge the event (200) so Razorpay does not retry indefinitely, but do
// nothing.
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getServiceSupabase } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const signature = req.headers.get('x-razorpay-signature') ?? '';

  // Raw body is required for signature verification.
  const raw = await req.text();

  if (!webhookSecret) {
    return NextResponse.json({ demo: true });
  }

  const expected = crypto.createHmac('sha256', webhookSecret).update(raw).digest('hex');
  if (!signature || !safeEqualHex(expected, signature)) {
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
  }

  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const event = payload?.event as string | undefined;
  if (event !== 'payment.captured' && event !== 'order.paid') {
    // Not an event we act on — acknowledge so Razorpay stops retrying.
    return NextResponse.json({ ok: true, ignored: event ?? null });
  }

  const walkinId = payload?.payload?.order?.entity?.notes?.walkin_id as string | undefined;
  if (!walkinId) {
    return NextResponse.json({ ok: true, note: 'No walkin_id in order notes.' });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    // Nothing we can do server-side; acknowledge to avoid retries.
    return NextResponse.json({ ok: true, note: 'Service key not configured.' });
  }

  const paidUntil = new Date();
  paidUntil.setDate(paidUntil.getDate() + 7);

  const supabase = getServiceSupabase();
  const { error } = await supabase
    .from('walkins')
    .update({ status: 'live', paid_until: paidUntil.toISOString() })
    .eq('id', walkinId);

  if (error) {
    return NextResponse.json({ error: 'Activation failed.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, walkin_id: walkinId });
}

```````

## 6. `supabase/migrations/20260901000000_harden_reports_and_autohide.sql`

```````sql
/*
# Harden reports + status guards + auto-hide

## Overview
Three hardening changes plus an optional expiry job:

1. Prevent duplicate reports: a user can report a given walk-in (or job) at most
   once. Enforced with partial unique indexes so the two nullable FK columns
   don't collide.

2. Recreate the status-guard trigger functions so that a status transition TO
   'reported' is always allowed (RETURN NEW) before the owner/role check runs.
   This lets the SECURITY DEFINER auto-hide trigger flip a listing to 'reported'
   regardless of who inserted the report. The functions are SECURITY DEFINER with
   a locked-down search_path and EXECUTE revoked from public/anon/authenticated
   (triggers still fire — they run with the table owner's privileges).

3. Recreate auto_hide_on_reports() with the same hardening (SECURITY DEFINER,
   safe search_path, EXECUTE revoked).

4. A commented-out pg_cron job that expires listings whose paid_until has passed.
*/

-- ============================================================
-- 1. Partial unique indexes: one report per user per listing
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS reports_unique_user_walkin
  ON reports (reported_by_user_id, walkin_id)
  WHERE walkin_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS reports_unique_user_job
  ON reports (reported_by_user_id, job_id)
  WHERE job_id IS NOT NULL;

-- ============================================================
-- 2. Status-guard functions — allow transitions to 'reported'
-- ============================================================
CREATE OR REPLACE FUNCTION guard_jobs_status() RETURNS trigger AS $$
BEGIN
  -- Always permit auto-hide (status -> 'reported'), regardless of caller.
  IF NEW.status = 'reported' THEN
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF current_setting('role', true) NOT IN ('service_role','postgres','supabase_admin')
       AND auth.uid() IS DISTINCT FROM NEW.posted_by_user_id THEN
      RAISE EXCEPTION 'Only the owner or an admin can change job status';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public;

CREATE OR REPLACE FUNCTION guard_walkins_status() RETURNS trigger AS $$
BEGIN
  -- Always permit auto-hide (status -> 'reported'), regardless of caller.
  IF NEW.status = 'reported' THEN
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF current_setting('role', true) NOT IN ('service_role','postgres','supabase_admin')
       AND auth.uid() IS DISTINCT FROM NEW.posted_by_user_id THEN
      RAISE EXCEPTION 'Only the owner or an admin can change walk-in status';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public;

REVOKE EXECUTE ON FUNCTION guard_jobs_status() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION guard_walkins_status() FROM public, anon, authenticated;

-- ============================================================
-- 3. Auto-hide function — hardened
-- ============================================================
CREATE OR REPLACE FUNCTION auto_hide_on_reports() RETURNS trigger AS $$
DECLARE
  rpt_count int;
BEGIN
  IF NEW.walkin_id IS NOT NULL THEN
    SELECT count(*) INTO rpt_count FROM reports WHERE walkin_id = NEW.walkin_id;
    IF rpt_count >= 3 THEN
      UPDATE walkins SET status = 'reported'
        WHERE id = NEW.walkin_id AND status NOT IN ('reported','rejected');
    END IF;
  ELSIF NEW.job_id IS NOT NULL THEN
    SELECT count(*) INTO rpt_count FROM reports WHERE job_id = NEW.job_id;
    IF rpt_count >= 3 THEN
      UPDATE jobs SET status = 'reported'
        WHERE id = NEW.job_id AND status NOT IN ('reported','rejected');
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public;

REVOKE EXECUTE ON FUNCTION auto_hide_on_reports() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS trg_auto_hide_on_reports ON reports;
CREATE TRIGGER trg_auto_hide_on_reports AFTER INSERT ON reports
  FOR EACH ROW EXECUTE FUNCTION auto_hide_on_reports();

-- ============================================================
-- 4. OPTIONAL: auto-expire listings past paid_until (pg_cron)
-- ============================================================
-- Requires the pg_cron extension (Supabase: enable under Database > Extensions).
-- Uncomment to expire paid listings automatically every 15 minutes.
--
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
--
-- SELECT cron.schedule(
--   'expire-listings',
--   '*/15 * * * *',
--   $$
--     UPDATE walkins SET status = 'expired'
--       WHERE paid_until IS NOT NULL AND paid_until < now()
--         AND status = 'live';
--     UPDATE jobs SET status = 'expired'
--       WHERE paid_until IS NOT NULL AND paid_until < now()
--         AND status = 'live';
--   $$
-- );

```````

## 7. `app/admin/page.tsx`

```````tsx
'use client';
// Admin panel — talks to the server-side /api/admin route (service-role backed).
// The PIN never touches the client bundle: it's entered by the operator and sent
// as the `x-admin-pin` header on every request. The server compares it against
// ADMIN_PIN and uses the service-role client to read/update.
import { useState } from 'react';
import { Walkin, Job } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Shield, Loader2, Eye, EyeOff, AlertTriangle, Flag } from 'lucide-react';
import { formatRelative } from '@/lib/format';

interface ReportRow {
  id: string;
  job_id: string | null;
  walkin_id: string | null;
  reason: string;
  detail: string | null;
  created_at: string;
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [pin, setPin] = useState('');
  const [walkins, setWalkins] = useState<Walkin[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [walkinCounts, setWalkinCounts] = useState<Record<string, number>>({});
  const [jobCounts, setJobCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function loadData(currentPin: string): Promise<boolean> {
    setLoading(true);
    try {
      const res = await fetch('/api/admin', {
        headers: { 'x-admin-pin': currentPin },
        cache: 'no-store',
      });
      if (res.status === 503) {
        toast.error('Admin API is not configured on the server.');
        return false;
      }
      if (res.status === 401) {
        toast.error('Wrong PIN.');
        return false;
      }
      if (!res.ok) {
        toast.error('Could not load admin data.');
        return false;
      }
      const data = await res.json();
      setWalkins((data.walkins as Walkin[]) ?? []);
      setJobs((data.jobs as Job[]) ?? []);
      setReports((data.reports as ReportRow[]) ?? []);
      setWalkinCounts(data.walkinReportCounts ?? {});
      setJobCounts(data.jobReportCounts ?? {});
      return true;
    } catch {
      toast.error('Could not reach the admin API.');
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function tryAuth(e: React.FormEvent) {
    e.preventDefault();
    if (!pin.trim()) return toast.error('Enter the admin PIN.');
    const ok = await loadData(pin);
    if (ok) {
      setAuthed(true);
      toast.success('Admin access granted.');
    }
  }

  async function setStatus(table: 'walkins' | 'jobs', id: string, status: string) {
    setBusyId(id);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'x-admin-pin': pin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ table, id, status }),
      });
      if (res.status === 503) return toast.error('Admin API is not configured on the server.');
      if (res.status === 401) return toast.error('Session expired — re-enter PIN.');
      if (!res.ok) return toast.error('Could not update status.');

      if (table === 'walkins') {
        setWalkins((prev) => prev.map((w) => (w.id === id ? { ...w, status: status as Walkin['status'] } : w)));
      } else {
        setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, status: status as Job['status'] } : j)));
      }
      toast.success('Updated.');
    } catch {
      toast.error('Could not update status.');
    } finally {
      setBusyId(null);
    }
  }

  if (!authed) {
    return (
      <div className="mx-auto max-w-sm">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-slate-700" />
          <h1 className="text-2xl font-bold text-slate-900">Admin</h1>
        </div>
        <form onSubmit={tryAuth} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pin">Admin PIN</Label>
            <Input
              id="pin"
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Enter PIN"
              autoComplete="off"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enter
          </Button>
        </form>
      </div>
    );
  }

  const reportedWalkins = walkins.filter((w) => w.status === 'reported');
  const reportedJobs = jobs.filter((j) => j.status === 'reported');

  function reportTarget(r: ReportRow): string {
    if (r.walkin_id) {
      const w = walkins.find((x) => x.id === r.walkin_id);
      return w ? `Walk-in: ${w.role_title} — ${w.company_name}` : `Walk-in ${r.walkin_id.slice(0, 8)}`;
    }
    if (r.job_id) {
      const j = jobs.find((x) => x.id === r.job_id);
      return j ? `Job: ${j.role_title} — ${j.company_name}` : `Job ${r.job_id.slice(0, 8)}`;
    }
    return 'Unknown target';
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Shield className="h-6 w-6 text-slate-700" />
        <h1 className="text-2xl font-bold text-slate-900">Admin Panel</h1>
      </div>

      {(reportedWalkins.length > 0 || reportedJobs.length > 0) && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 p-4 text-sm text-red-800">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          {reportedWalkins.length + reportedJobs.length} listing(s) reported and hidden. Review below.
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
      ) : (
        <>
          {/* Recent reports */}
          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <Flag className="h-4 w-4 text-red-500" />
              Recent reports ({reports.length})
            </h2>
            {reports.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                No reports yet.
              </p>
            ) : (
              <div className="space-y-2">
                {reports.map((r) => (
                  <div key={r.id} className="rounded-lg border border-slate-200 bg-white p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-slate-900">{reportTarget(r)}</p>
                      <span className="shrink-0 text-xs text-slate-400">{formatRelative(r.created_at)}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-600">
                      <span className="font-medium text-red-600">{r.reason}</span>
                      {r.detail ? ` — ${r.detail}` : ''}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Walkins */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">Walk-ins ({walkins.length})</h2>
            <div className="space-y-2">
              {walkins.map((w) => (
                <div key={w.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {w.role_title} — {w.company_name}
                      {(walkinCounts[w.id] ?? 0) > 0 && (
                        <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                          <Flag className="h-3 w-3" />{walkinCounts[w.id]}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500">Status: {w.status} | {w.city}, {w.area} | {w.walkin_date}</p>
                  </div>
                  <div className="flex gap-1">
                    {busyId === w.id ? (
                      <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                    ) : w.status === 'reported' ? (
                      <Button size="sm" variant="outline" onClick={() => setStatus('walkins', w.id, 'live')}>
                        <Eye className="mr-1 h-3.5 w-3.5" />Unhide
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => setStatus('walkins', w.id, 'reported')}>
                        <EyeOff className="mr-1 h-3.5 w-3.5" />Hide
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Jobs */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">Jobs ({jobs.length})</h2>
            <div className="space-y-2">
              {jobs.map((j) => (
                <div key={j.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {j.role_title} — {j.company_name}
                      {(jobCounts[j.id] ?? 0) > 0 && (
                        <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                          <Flag className="h-3 w-3" />{jobCounts[j.id]}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500">Status: {j.status} | {j.location_type}</p>
                  </div>
                  <div className="flex gap-1">
                    {busyId === j.id ? (
                      <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                    ) : j.status === 'reported' ? (
                      <Button size="sm" variant="outline" onClick={() => setStatus('jobs', j.id, 'live')}>
                        <Eye className="mr-1 h-3.5 w-3.5" />Unhide
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => setStatus('jobs', j.id, 'reported')}>
                        <EyeOff className="mr-1 h-3.5 w-3.5" />Hide
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

```````

## 8. `app/walkins/new/page.tsx`

```````tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase-client';
import { RequireRecruiter } from '@/lib/auth-guards';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Loader2, Eye, CheckCircle2 } from 'lucide-react';
import { NCR_CITIES, EDUCATION_OPTIONS, SHIFT_OPTIONS, LANGUAGE_OPTIONS, formatSalaryFull } from '@/lib/types';
import { formatWalkinDate, localISODate } from '@/lib/format';

const RAZORPAY_KEY = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
const PRICE = 499;

function PostWalkinInner() {
  const supabase = getSupabase();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [paying, setPaying] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const [form, setForm] = useState({
    company_name: '',
    role_title: '',
    category: '',
    city: '',
    area: '',
    addressLine: '',
    walkin_date: '',
    walkin_start_time: '',
    walkin_end_time: '',
    salary_min: '',
    salary_max: '',
    education: '',
    shift: '',
    cab: false,
    languages: '',
    whatsapp_number: '',
    hr_phone: '',
    openings: '',
    description: '',
  });

  function set(key: keyof typeof form, value: string | boolean) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function validate(): string | null {
    if (!form.company_name.trim()) return 'Company name is required.';
    if (!form.role_title.trim()) return 'Role title is required.';
    if (!form.category) return 'Please choose a category.';
    if (!form.city) return 'Please choose a city.';
    if (!form.area.trim()) return 'Area is required (e.g. Sector 62).';
    if (!form.addressLine.trim()) return 'Address is required.';
    if (!form.walkin_date) return 'Walk-in date is required.';
    if (form.walkin_date < localISODate()) return 'Walk-in date cannot be in the past.';
    if (!form.walkin_start_time.trim()) return 'Start time is required.';
    if (!form.salary_min || !form.salary_max) return 'Salary range is required.';
    const salMin = parseInt(form.salary_min);
    const salMax = parseInt(form.salary_max);
    if (!Number.isFinite(salMin) || !Number.isFinite(salMax) || salMin <= 0 || salMax <= 0) {
      return 'Salary must be positive numbers.';
    }
    if (salMin > salMax) return 'Minimum salary cannot be greater than maximum salary.';
    if (!form.education) return 'Please choose minimum education.';
    if (!form.shift) return 'Please choose shift type.';
    if (!form.languages) return 'Please choose language requirement.';
    if (!/^\d{10}$/.test(form.whatsapp_number.replace(/\D/g, ''))) return 'WhatsApp number must be a valid 10-digit Indian mobile.';
    if (!form.description.trim()) return 'Description is required.';
    return null;
  }

  async function handleSaveDraft() {
    const err = validate();
    if (err) return toast.error(err);

    setSaving(true);
    const { data, error } = await supabase.from('walkins').insert({
      company_name: form.company_name.trim(),
      role_title: form.role_title.trim(),
      category: form.category,
      city: form.city,
      area: form.area.trim(),
      location_address: form.addressLine.trim(),
      walkin_date: form.walkin_date,
      walkin_time: [form.walkin_start_time.trim(), form.walkin_end_time.trim()].filter(Boolean).join(' - '),
      salary_min: parseInt(form.salary_min) || null,
      salary_max: parseInt(form.salary_max) || null,
      education: form.education || null,
      shift: form.shift || null,
      cab: form.cab,
      languages: form.languages || null,
      whatsapp_number: form.whatsapp_number.replace(/\D/g, ''),
      hr_phone: form.hr_phone.replace(/\D/g, '') || null,
      openings: parseInt(form.openings) || null,
      description: form.description.trim(),
      contact_person: null,
      status: 'draft',
    }).select('id').single();
    setSaving(false);

    if (error) return toast.error('Could not save your listing. Please try again.');
    setCreatedId(data.id);
    setShowPreview(true);
  }

  // Load the Razorpay checkout.js script once.
  function loadCheckoutScript(): Promise<boolean> {
    return new Promise((resolve) => {
      if ((window as any).Razorpay) return resolve(true);
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  }

  async function handlePay() {
    if (!createdId) return;
    setPaying(true);

    // Ask the server to create a Razorpay order. When Razorpay is not
    // configured (or the call fails), the server returns { demo: true } and we
    // fall back to the existing client-side demo activation.
    let order: {
      demo?: boolean;
      key_id?: string;
      order_id?: string;
      amount?: number;
      currency?: string;
    };
    try {
      const res = await fetch('/api/razorpay/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walkin_id: createdId }),
      });
      order = await res.json();
    } catch {
      order = { demo: true };
    }

    if (order.demo || !order.order_id || !order.key_id) {
      await activateListing();
      return;
    }

    const loaded = await loadCheckoutScript();
    if (!loaded) {
      toast.error('Could not load the payment gateway. Please try again.');
      setPaying(false);
      return;
    }

    const rzp = new (window as any).Razorpay({
      key: order.key_id,
      order_id: order.order_id,
      amount: order.amount ?? PRICE * 100,
      currency: order.currency ?? 'INR',
      name: 'NCR Walk-in',
      description: 'Walk-in listing — 7 days',
      handler: async (response: {
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
      }) => {
        try {
          const vRes = await fetch('/api/razorpay/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              walkin_id: createdId,
            }),
          });
          const result = await vRes.json();
          if (vRes.ok && result.ok) {
            setPaying(false);
            toast.success('Your walk-in is live!');
            router.push('/walkins');
          } else if (result.activateClientSide) {
            await activateListing();
          } else {
            setPaying(false);
            toast.error(result.error || 'Payment verification failed. Please contact support.');
          }
        } catch {
          setPaying(false);
          toast.error('Payment verification failed. Please contact support.');
        }
      },
      modal: { ondismiss: () => setPaying(false) },
    });
    rzp.open();
  }

  async function activateListing() {
    if (!createdId) return;
    const paidUntil = new Date();
    paidUntil.setDate(paidUntil.getDate() + 7);

    const { error } = await supabase
      .from('walkins')
      .update({ status: 'live', paid_until: paidUntil.toISOString() })
      .eq('id', createdId);

    setPaying(false);
    if (error) return toast.error('Payment received but listing activation failed. Please contact support.');

    toast.success('Your walk-in is live!');
    router.push('/walkins');
  }

  if (showPreview && createdId) {
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 text-emerald-600">
            <CheckCircle2 className="h-5 w-5" />
            <span className="font-semibold">Listing saved — preview</span>
          </div>
          <p className="mt-1 text-sm text-slate-600">Review your listing below, then pay Rs {PRICE} to make it live for 7 days.</p>
        </div>

        {/* Preview card */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="font-semibold text-slate-900">{form.role_title}</h3>
          <p className="text-sm text-slate-600">{form.company_name}</p>
          <p className="mt-2 text-lg font-bold text-emerald-700">{formatSalaryFull(parseInt(form.salary_min) || null, parseInt(form.salary_max) || null)}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[form.category, form.shift, form.cab && 'Cab', form.education].filter(Boolean).map((c) => (
              <span key={c as string} className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">{c as string}</span>
            ))}
          </div>
          <p className="mt-3 text-sm text-slate-600">
            {formatWalkinDate(form.walkin_date)} {[form.walkin_start_time, form.walkin_end_time].filter(Boolean).join(' - ')} | {form.city}, {form.area}
          </p>
          <p className="mt-2 text-sm text-slate-700">{form.description}</p>
        </div>

        {/* Payment */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-slate-900">Pay Rs {PRICE}</p>
              <p className="text-sm text-slate-600">Listing goes live instantly. Visible for 7 days.</p>
            </div>
            <Button onClick={handlePay} disabled={paying} className="bg-emerald-600 text-white hover:bg-emerald-700">
              {paying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {RAZORPAY_KEY ? `Pay Rs ${PRICE}` : `Demo pay Rs ${PRICE}`}
            </Button>
          </div>
          {!RAZORPAY_KEY && (
            <p className="mt-2 text-xs text-amber-600">
              Demo mode: no real payment will be charged. Set NEXT_PUBLIC_RAZORPAY_KEY_ID to enable Razorpay Checkout.
            </p>
          )}
        </div>

        <Button variant="outline" onClick={() => setShowPreview(false)} className="w-full">
          <Eye className="mr-2 h-4 w-4" />Edit listing
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-900">Post a walk-in interview</h1>
      <p className="mt-1 text-sm text-slate-600">
        Rs {PRICE} for 7 days. Your listing goes live instantly after payment.
      </p>

      <form onSubmit={(e) => { e.preventDefault(); handleSaveDraft(); }} className="mt-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="company">Company name *</Label>
            <Input id="company" value={form.company_name} onChange={(e) => set('company_name', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="role">Role title *</Label>
            <Input id="role" value={form.role_title} onChange={(e) => set('role_title', e.target.value)} placeholder="e.g. Customer Care Executive" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Category *</Label>
            <Select value={form.category} onValueChange={(v) => set('category', v)}>
              <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Voice">Voice</SelectItem>
                <SelectItem value="Non-Voice">Non-Voice</SelectItem>
                <SelectItem value="Semi-Voice">Semi-Voice</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>City *</Label>
            <Select value={form.city} onValueChange={(v) => set('city', v)}>
              <SelectTrigger><SelectValue placeholder="Select city" /></SelectTrigger>
              <SelectContent>
                {NCR_CITIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="area">Area *</Label>
            <Input id="area" value={form.area} onChange={(e) => set('area', e.target.value)} placeholder="e.g. Sector 62" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="address">Address line *</Label>
            <Input id="address" value={form.addressLine} onChange={(e) => set('addressLine', e.target.value)} placeholder="Full venue address" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="date">Walk-in date *</Label>
            <Input id="date" type="date" value={form.walkin_date} onChange={(e) => set('walkin_date', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="startTime">Start time *</Label>
            <Input id="startTime" type="time" value={form.walkin_start_time} onChange={(e) => set('walkin_start_time', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="endTime">End time</Label>
            <Input id="endTime" type="time" value={form.walkin_end_time} onChange={(e) => set('walkin_end_time', e.target.value)} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="salMin">Salary min (INR) *</Label>
            <Input id="salMin" type="number" value={form.salary_min} onChange={(e) => set('salary_min', e.target.value)} placeholder="e.g. 15000" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="salMax">Salary max (INR) *</Label>
            <Input id="salMax" type="number" value={form.salary_max} onChange={(e) => set('salary_max', e.target.value)} placeholder="e.g. 22000" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Education *</Label>
            <Select value={form.education} onValueChange={(v) => set('education', v)}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {EDUCATION_OPTIONS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Shift *</Label>
            <Select value={form.shift} onValueChange={(v) => set('shift', v)}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {SHIFT_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Languages *</Label>
            <Select value={form.languages} onValueChange={(v) => set('languages', v)}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {LANGUAGE_OPTIONS.map((l) => <SelectItem key={l} value={l}>{l === 'both' ? 'English & Hindi' : l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="wa">WhatsApp number *</Label>
            <Input id="wa" value={form.whatsapp_number} onChange={(e) => set('whatsapp_number', e.target.value)} placeholder="10-digit mobile" maxLength={10} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hr">HR phone (optional)</Label>
            <Input id="hr" value={form.hr_phone} onChange={(e) => set('hr_phone', e.target.value)} placeholder="Alternate phone" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="openings">Openings (optional)</Label>
            <Input id="openings" type="number" value={form.openings} onChange={(e) => set('openings', e.target.value)} placeholder="e.g. 10" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox checked={form.cab} onCheckedChange={(v) => set('cab', v === true)} id="cab" />
          <Label htmlFor="cab" className="cursor-pointer">Cab pickup & drop provided</Label>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="desc">Description *</Label>
          <Textarea id="desc" value={form.description} onChange={(e) => set('description', e.target.value)} rows={5} placeholder="Process details, week off, incentives, what to carry (CV + Aadhaar)..." />
        </div>

        <Button type="submit" disabled={saving} className="w-full">
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <Eye className="mr-2 h-4 w-4" />Preview &amp; Continue
        </Button>
      </form>
    </div>
  );
}

export default function PostWalkinPage() {
  return (
    <RequireRecruiter>
      <PostWalkinInner />
    </RequireRecruiter>
  );
}

```````

## 9. `app/walkins/[id]/page.tsx`

```````tsx
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { getSupabase } from '@/lib/supabase-client';
import { useAuth } from '@/lib/auth-context';
import { Walkin, whatsappApplyUrl, formatSalaryFull } from '@/lib/types';
import { ReportButton } from '@/components/report-button';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, MapPin, Clock, MessageCircle, Phone, Users, GraduationCap, Moon, Car, Languages, Inbox, Share2, Pencil } from 'lucide-react';
import { formatWalkinDate, formatDate } from '@/lib/format';

export default function WalkinDetailPage() {
  const supabase = getSupabase();
  const params = useParams();
  const id = params.id as string;
  const { user } = useAuth();
  const [walkin, setWalkin] = useState<Walkin | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('walkins')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (data) {
        const d = data as Walkin;
        const isPublicStatus = d.status === 'live' || d.status === 'approved' || d.status === 'expired';
        const isOwner = d.posted_by_user_id === user?.id;
        if (isPublicStatus || isOwner) {
          setWalkin(d);
        }
      }
      setLoading(false);
    })();
  }, [supabase, id, user]);

  if (loading) return <Skeleton className="h-64 w-full rounded-xl" />;

  if (!walkin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Inbox className="h-8 w-8 text-slate-300" />
        <p className="mt-2 text-slate-600">This walk-in is no longer available.</p>
        <Link href="/walkins" className="mt-4">
          <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Back to walk-ins</Button>
        </Link>
      </div>
    );
  }

  const locationStr = [walkin.city, walkin.area].filter(Boolean).join(', ') || walkin.location_address;
  const fullAddress = walkin.location_address || [walkin.area, walkin.city].filter(Boolean).join(', ');
  const waUrl = walkin.whatsapp_number
    ? whatsappApplyUrl(walkin.whatsapp_number, walkin.role_title, walkin.company_name, walkin.city || 'NCR')
    : null;
  const mapUrl = `https://maps.google.com/?q=${encodeURIComponent(fullAddress)}`;
  const dateLabel = formatWalkinDate(walkin.walkin_date);
  const paidUntilPast = walkin.paid_until ? new Date(walkin.paid_until).getTime() < Date.now() : false;
  const isExpired = walkin.status === 'expired' || paidUntilPast;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center justify-between">
        <Link href="/walkins" className="inline-flex items-center text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft className="mr-1 h-4 w-4" />All walk-ins
        </Link>
        {user?.id === walkin.posted_by_user_id && (
          <Link href={`/walkins/${walkin.id}/edit`} className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600 hover:underline">
            <Pencil className="h-3.5 w-3.5" />Edit listing
          </Link>
        )}
      </div>

      {(walkin.status === 'draft' || walkin.status === 'pending') && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p>
            This listing is <span className="font-semibold">{walkin.status}</span> and is only visible to you.
            {' '}<Link href="/dashboard" className="font-semibold underline hover:no-underline">Go to your dashboard</Link>
          </p>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{walkin.role_title}</h1>
            <p className="text-slate-600">{walkin.company_name}</p>
          </div>
          {user && <ReportButton walkinId={walkin.id} />}
        </div>

        <div className="mt-4 rounded-lg bg-emerald-50 p-3">
          <p className="text-2xl font-bold text-emerald-700">{formatSalaryFull(walkin.salary_min, walkin.salary_max)}</p>
          <p className="text-xs text-emerald-600">per month + incentives</p>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <InfoRow icon={<Clock className="h-4 w-4" />} label="When" value={`${dateLabel}, ${walkin.walkin_time}`} sub={formatDate(walkin.walkin_date)} />
          <InfoRow icon={<MapPin className="h-4 w-4" />} label="Where" value={locationStr} sub={walkin.location_address} />
          {walkin.shift && <InfoRow icon={<Moon className="h-4 w-4" />} label="Shift" value={walkin.shift} />}
          {walkin.education && <InfoRow icon={<GraduationCap className="h-4 w-4" />} label="Education" value={walkin.education} />}
          {walkin.cab && <InfoRow icon={<Car className="h-4 w-4" />} label="Cab" value="Pickup & drop provided" />}
          {walkin.languages && <InfoRow icon={<Languages className="h-4 w-4" />} label="Languages" value={walkin.languages === 'both' ? 'English & Hindi' : walkin.languages} />}
          {walkin.openings != null && <InfoRow icon={<Users className="h-4 w-4" />} label="Openings" value={`${walkin.openings}`} />}
        </div>

        {/* Chips */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {[walkin.category, walkin.shift, walkin.cab && 'Cab', walkin.education].filter(Boolean).map((c) => (
            <span key={c as string} className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
              {c as string}
            </span>
          ))}
        </div>
      </div>

      {walkin.description && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900">Details</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{walkin.description}</p>
        </div>
      )}

      {/* What to bring */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">What to bring</h2>
        <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-700">
          <li>Updated CV / resume</li>
          <li>Aadhaar card (original + photocopy)</li>
          <li>2 passport-size photos</li>
          {walkin.education && <li>{walkin.education} certificate / marksheet</li>}
        </ul>
      </div>

      {/* Map link */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <a
          href={mapUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:underline"
        >
          <MapPin className="h-4 w-4" />
          Open in Google Maps
        </a>
        <p className="mt-1 text-sm text-slate-600">{fullAddress}</p>
      </div>

      {isExpired && (
        <div className="rounded-xl bg-amber-50 p-4 text-center text-sm text-amber-800">
          This walk-in has expired. Check current listings on the walk-ins page.
        </div>
      )}

      {/* Sticky WhatsApp apply bar — mobile */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white p-3 md:hidden">
        <div className="flex gap-2">
          {waUrl && (
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700"
            >
              <MessageCircle className="h-5 w-5" />
              Apply on WhatsApp
            </a>
          )}
          {walkin.hr_phone && (
            <a
              href={`tel:${walkin.hr_phone}`}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-3 text-slate-700"
            >
              <Phone className="h-5 w-5" />
            </a>
          )}
        </div>
      </div>

      {/* Desktop apply buttons */}
      <div className="hidden gap-3 md:flex">
        {waUrl && (
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-6 py-3 font-bold text-white transition-colors hover:bg-emerald-700"
          >
            <MessageCircle className="h-5 w-5" />
            Apply on WhatsApp
          </a>
        )}
        {walkin.hr_phone && (
          <a
            href={`tel:${walkin.hr_phone}`}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-6 py-3 font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            <Phone className="h-5 w-5" />
            Call HR
          </a>
        )}
        <a
          href={`https://wa.me/?text=${encodeURIComponent(`Walk-in: ${walkin.role_title} at ${walkin.company_name}, ${locationStr}. Apply via NCR Walk-in.`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-3 text-slate-600 hover:bg-slate-50"
        >
          <Share2 className="h-5 w-5" />
        </a>
      </div>

      {/* Spacer for sticky bar on mobile */}
      <div className="h-16 md:hidden" />
    </div>
  );
}

function InfoRow({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-slate-50 p-3">
      <span className="mt-0.5 text-slate-400">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
        <p className="break-words text-sm text-slate-800">{value}</p>
        {sub && <p className="mt-0.5 break-words text-xs text-slate-500">{sub}</p>}
      </div>
    </div>
  );
}

```````

## 10. `app/walkins/[id]/edit/page.tsx`

```````tsx
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase-client';
import { useAuth } from '@/lib/auth-context';
import { RequireRecruiter } from '@/lib/auth-guards';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, Inbox, Save } from 'lucide-react';
import { NCR_CITIES, EDUCATION_OPTIONS, SHIFT_OPTIONS, LANGUAGE_OPTIONS, Walkin } from '@/lib/types';
import { localISODate } from '@/lib/format';

function EditWalkinInner() {
  const supabase = getSupabase();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    company_name: '',
    role_title: '',
    category: '',
    city: '',
    area: '',
    addressLine: '',
    walkin_date: '',
    walkin_start_time: '',
    walkin_end_time: '',
    salary_min: '',
    salary_max: '',
    education: '',
    shift: '',
    cab: false,
    languages: '',
    whatsapp_number: '',
    hr_phone: '',
    openings: '',
    description: '',
  });

  function set(key: keyof typeof form, value: string | boolean) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('walkins')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      const walkin = data as Walkin | null;
      if (!walkin || walkin.posted_by_user_id !== user?.id) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      const [start, end] = (walkin.walkin_time || '').split(' - ');
      setForm({
        company_name: walkin.company_name || '',
        role_title: walkin.role_title || '',
        category: walkin.category || '',
        city: walkin.city || '',
        area: walkin.area || '',
        addressLine: walkin.location_address || '',
        walkin_date: walkin.walkin_date || '',
        walkin_start_time: start || '',
        walkin_end_time: end || '',
        salary_min: walkin.salary_min != null ? String(walkin.salary_min) : '',
        salary_max: walkin.salary_max != null ? String(walkin.salary_max) : '',
        education: walkin.education || '',
        shift: walkin.shift || '',
        cab: !!walkin.cab,
        languages: walkin.languages || '',
        whatsapp_number: walkin.whatsapp_number || '',
        hr_phone: walkin.hr_phone || '',
        openings: walkin.openings != null ? String(walkin.openings) : '',
        description: walkin.description || '',
      });
      setLoading(false);
    })();
  }, [supabase, id, user]);

  function validate(): string | null {
    if (!form.company_name.trim()) return 'Company name is required.';
    if (!form.role_title.trim()) return 'Role title is required.';
    if (!form.category) return 'Please choose a category.';
    if (!form.city) return 'Please choose a city.';
    if (!form.area.trim()) return 'Area is required (e.g. Sector 62).';
    if (!form.addressLine.trim()) return 'Address is required.';
    if (!form.walkin_date) return 'Walk-in date is required.';
    if (form.walkin_date < localISODate()) return 'Walk-in date cannot be in the past.';
    if (!form.walkin_start_time.trim()) return 'Start time is required.';
    if (!form.salary_min || !form.salary_max) return 'Salary range is required.';
    const salMin = parseInt(form.salary_min);
    const salMax = parseInt(form.salary_max);
    if (!Number.isFinite(salMin) || !Number.isFinite(salMax) || salMin <= 0 || salMax <= 0) {
      return 'Salary must be positive numbers.';
    }
    if (salMin > salMax) return 'Minimum salary cannot be greater than maximum salary.';
    if (!form.education) return 'Please choose minimum education.';
    if (!form.shift) return 'Please choose shift type.';
    if (!form.languages) return 'Please choose language requirement.';
    if (!/^\d{10}$/.test(form.whatsapp_number.replace(/\D/g, ''))) return 'WhatsApp number must be a valid 10-digit Indian mobile.';
    if (!form.description.trim()) return 'Description is required.';
    return null;
  }

  async function handleSave() {
    const err = validate();
    if (err) return toast.error(err);

    setSaving(true);
    const { error } = await supabase
      .from('walkins')
      .update({
        company_name: form.company_name.trim(),
        role_title: form.role_title.trim(),
        category: form.category,
        city: form.city,
        area: form.area.trim(),
        location_address: form.addressLine.trim(),
        walkin_date: form.walkin_date,
        walkin_time: [form.walkin_start_time.trim(), form.walkin_end_time.trim()].filter(Boolean).join(' - '),
        salary_min: parseInt(form.salary_min) || null,
        salary_max: parseInt(form.salary_max) || null,
        education: form.education || null,
        shift: form.shift || null,
        cab: form.cab,
        languages: form.languages || null,
        whatsapp_number: form.whatsapp_number.replace(/\D/g, ''),
        hr_phone: form.hr_phone.replace(/\D/g, '') || null,
        openings: parseInt(form.openings) || null,
        description: form.description.trim(),
      })
      .eq('id', id);
    setSaving(false);

    if (error) return toast.error('Could not update your listing. Please try again.');

    toast.success('Listing updated!');
    router.push('/dashboard');
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Inbox className="h-8 w-8 text-slate-300" />
        <p className="mt-2 text-slate-600">This walk-in doesn&apos;t exist or isn&apos;t yours.</p>
        <Link href="/dashboard" className="mt-4">
          <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Back to dashboard</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/dashboard" className="inline-flex items-center text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="mr-1 h-4 w-4" />Back to dashboard
      </Link>
      <h1 className="mt-3 text-2xl font-bold text-slate-900">Edit walk-in interview</h1>
      <p className="mt-1 text-sm text-slate-600">
        Update your listing details. This does not change its status or payment.
      </p>

      <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="mt-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="company">Company name *</Label>
            <Input id="company" value={form.company_name} onChange={(e) => set('company_name', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="role">Role title *</Label>
            <Input id="role" value={form.role_title} onChange={(e) => set('role_title', e.target.value)} placeholder="e.g. Customer Care Executive" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Category *</Label>
            <Select value={form.category} onValueChange={(v) => set('category', v)}>
              <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Voice">Voice</SelectItem>
                <SelectItem value="Non-Voice">Non-Voice</SelectItem>
                <SelectItem value="Semi-Voice">Semi-Voice</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>City *</Label>
            <Select value={form.city} onValueChange={(v) => set('city', v)}>
              <SelectTrigger><SelectValue placeholder="Select city" /></SelectTrigger>
              <SelectContent>
                {NCR_CITIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="area">Area *</Label>
            <Input id="area" value={form.area} onChange={(e) => set('area', e.target.value)} placeholder="e.g. Sector 62" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="address">Address line *</Label>
            <Input id="address" value={form.addressLine} onChange={(e) => set('addressLine', e.target.value)} placeholder="Full venue address" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="date">Walk-in date *</Label>
            <Input id="date" type="date" value={form.walkin_date} onChange={(e) => set('walkin_date', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="startTime">Start time *</Label>
            <Input id="startTime" type="time" value={form.walkin_start_time} onChange={(e) => set('walkin_start_time', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="endTime">End time</Label>
            <Input id="endTime" type="time" value={form.walkin_end_time} onChange={(e) => set('walkin_end_time', e.target.value)} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="salMin">Salary min (INR) *</Label>
            <Input id="salMin" type="number" value={form.salary_min} onChange={(e) => set('salary_min', e.target.value)} placeholder="e.g. 15000" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="salMax">Salary max (INR) *</Label>
            <Input id="salMax" type="number" value={form.salary_max} onChange={(e) => set('salary_max', e.target.value)} placeholder="e.g. 22000" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Education *</Label>
            <Select value={form.education} onValueChange={(v) => set('education', v)}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {EDUCATION_OPTIONS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Shift *</Label>
            <Select value={form.shift} onValueChange={(v) => set('shift', v)}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {SHIFT_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Languages *</Label>
            <Select value={form.languages} onValueChange={(v) => set('languages', v)}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {LANGUAGE_OPTIONS.map((l) => <SelectItem key={l} value={l}>{l === 'both' ? 'English & Hindi' : l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="wa">WhatsApp number *</Label>
            <Input id="wa" value={form.whatsapp_number} onChange={(e) => set('whatsapp_number', e.target.value)} placeholder="10-digit mobile" maxLength={10} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hr">HR phone (optional)</Label>
            <Input id="hr" value={form.hr_phone} onChange={(e) => set('hr_phone', e.target.value)} placeholder="Alternate phone" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="openings">Openings (optional)</Label>
            <Input id="openings" type="number" value={form.openings} onChange={(e) => set('openings', e.target.value)} placeholder="e.g. 10" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox checked={form.cab} onCheckedChange={(v) => set('cab', v === true)} id="cab" />
          <Label htmlFor="cab" className="cursor-pointer">Cab pickup & drop provided</Label>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="desc">Description *</Label>
          <Textarea id="desc" value={form.description} onChange={(e) => set('description', e.target.value)} rows={5} placeholder="Process details, week off, incentives, what to carry (CV + Aadhaar)..." />
        </div>

        <Button type="submit" disabled={saving} className="w-full">
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <Save className="mr-2 h-4 w-4" />Save changes
        </Button>
      </form>
    </div>
  );
}

export default function EditWalkinPage() {
  return (
    <RequireRecruiter>
      <EditWalkinInner />
    </RequireRecruiter>
  );
}

```````

## 11. `app/dashboard/page.tsx`

```````tsx
'use client';
import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase-client';
import { useAuth } from '@/lib/auth-context';
import { RequireRecruiter } from '@/lib/auth-guards';
import { Walkin, formatSalary } from '@/lib/types';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { toast } from 'sonner';
import { Loader2, RefreshCw, ExternalLink, Calendar, Pencil } from 'lucide-react';
import { formatWalkinDate } from '@/lib/format';

const PRICE = 499;

function DashboardInner() {
  const supabase = getSupabase();
  const { user } = useAuth();
  const [walkins, setWalkins] = useState<Walkin[]>([]);
  const [loading, setLoading] = useState(true);
  const [renewingId, setRenewingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('walkins')
        .select('*')
        .eq('posted_by_user_id', user.id)
        .order('created_at', { ascending: false });
      setWalkins((data as Walkin[]) ?? []);
      setLoading(false);
    })();
  }, [supabase, user]);

  // Load the Razorpay checkout.js script once.
  function loadCheckoutScript(): Promise<boolean> {
    return new Promise((resolve) => {
      if ((window as any).Razorpay) return resolve(true);
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  }

  // Client-side demo activation (no real payment) — mirrors the post flow.
  async function demoRenew(id: string) {
    const paidUntil = new Date();
    paidUntil.setDate(paidUntil.getDate() + 7);
    const { error } = await supabase
      .from('walkins')
      .update({ status: 'live', paid_until: paidUntil.toISOString() })
      .eq('id', id);
    setRenewingId(null);
    if (error) return toast.error('Could not renew listing.');
    setWalkins((prev) => prev.map((w) => (w.id === id ? { ...w, status: 'live', paid_until: paidUntil.toISOString() } : w)));
    toast.success('Renewed for 7 days!');
  }

  async function renew(id: string) {
    setRenewingId(id);

    let order: {
      demo?: boolean;
      key_id?: string;
      order_id?: string;
      amount?: number;
      currency?: string;
    };
    try {
      const res = await fetch('/api/razorpay/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walkin_id: id }),
      });
      order = await res.json();
    } catch {
      order = { demo: true };
    }

    if (order.demo || !order.order_id || !order.key_id) {
      await demoRenew(id);
      return;
    }

    const loaded = await loadCheckoutScript();
    if (!loaded) {
      toast.error('Could not load the payment gateway. Please try again.');
      setRenewingId(null);
      return;
    }

    const rzp = new (window as any).Razorpay({
      key: order.key_id,
      order_id: order.order_id,
      amount: order.amount ?? PRICE * 100,
      currency: order.currency ?? 'INR',
      name: 'NCR Walk-in',
      description: 'Renew walk-in listing — 7 days',
      handler: async (response: {
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
      }) => {
        try {
          const vRes = await fetch('/api/razorpay/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              walkin_id: id,
            }),
          });
          const result = await vRes.json();
          if (vRes.ok && result.ok) {
            const paidUntil = result.paid_until ?? new Date(Date.now() + 7 * 86400000).toISOString();
            setRenewingId(null);
            setWalkins((prev) => prev.map((w) => (w.id === id ? { ...w, status: 'live', paid_until: paidUntil } : w)));
            toast.success('Renewed for 7 days!');
          } else if (result.activateClientSide) {
            await demoRenew(id);
          } else {
            setRenewingId(null);
            toast.error(result.error || 'Payment verification failed. Please contact support.');
          }
        } catch {
          setRenewingId(null);
          toast.error('Payment verification failed. Please contact support.');
        }
      },
      modal: { ondismiss: () => setRenewingId(null) },
    });
    rzp.open();
  }

  const now = new Date();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">My Listings</h1>
        <Link href="/walkins/new">
          <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700">Post new walk-in</Button>
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
      ) : walkins.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center">
          <p className="text-sm text-slate-500">You have not posted any walk-ins yet.</p>
          <Link href="/walkins/new" className="mt-3 inline-block text-sm font-medium text-emerald-600 hover:underline">
            Post your first walk-in →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {walkins.map((w) => {
            const isExpired = w.status === 'expired' || (w.paid_until && new Date(w.paid_until) < now);
            const isLive = w.status === 'live' && (!w.paid_until || new Date(w.paid_until) >= now);
            return (
              <div key={w.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold text-slate-900">{w.role_title}</h3>
                    <p className="truncate text-sm text-slate-600">{w.company_name}</p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        {formatWalkinDate(w.walkin_date)} {w.walkin_time}
                      </span>
                      <span className="font-medium text-emerald-700">{formatSalary(w.salary_min, w.salary_max)}</span>
                      <span className="text-slate-400">{w.city}, {w.area}</span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    {isLive && <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">Live</span>}
                    {isExpired && <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">Expired</span>}
                    {w.status === 'draft' && <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Draft</span>}
                    {w.status === 'reported' && <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">Reported</span>}
                  </div>
                </div>

                <div className="mt-3 flex gap-2">
                  <Link href={`/walkins/${w.id}`}>
                    <Button size="sm" variant="outline">
                      <ExternalLink className="mr-1.5 h-3.5 w-3.5" />View
                    </Button>
                  </Link>
                  <Link href={`/walkins/${w.id}/edit`}>
                    <Button size="sm" variant="outline">
                      <Pencil className="mr-1.5 h-3.5 w-3.5" />Edit
                    </Button>
                  </Link>
                  {isExpired && (
                    <Button
                      size="sm"
                      onClick={() => renew(w.id)}
                      disabled={renewingId === w.id}
                      className="bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                      {renewingId === w.id ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      Renew Rs 499
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <RequireRecruiter>
      <DashboardInner />
    </RequireRecruiter>
  );
}

```````

## 12. `app/login/page.tsx`

```````tsx
'use client';
// Login page: email or phone sign-in, plus a "Forgot password?" flow.
// Phone accounts are stored as `${digits}@phone.ncrwalkin` (see signup), so phone
// login validates a 10-digit mobile and reconstructs that synthetic email.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSupabase } from '@/lib/supabase-client';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Mail, Phone } from 'lucide-react';

type Mode = 'email' | 'phone';
type View = 'login' | 'forgot';

export default function LoginPage() {
  const router = useRouter();
  const supabase = getSupabase();
  const { refreshProfile } = useAuth();
  const [view, setView] = useState<View>('login');
  const [mode, setMode] = useState<Mode>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function authMessage(msg: string): string {
    const m = msg.toLowerCase();
    if (m.includes('invalid login') || m.includes('invalid credentials')) return 'Wrong credentials. Please try again.';
    if (m.includes('not confirmed')) return 'Please confirm your email first.';
    if (m.includes('rate limit')) return 'Too many attempts. Please wait a minute and try again.';
    return msg || 'Could not log in. Please try again.';
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    let signInEmail: string;
    if (mode === 'email') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return toast.error('Please enter a valid email address.');
      signInEmail = email.trim();
    } else {
      const digits = phone.replace(/\D/g, '');
      if (!/^\d{10}$/.test(digits)) return toast.error('Please enter a valid 10-digit Indian mobile number.');
      signInEmail = `${digits}@phone.ncrwalkin`;
    }
    if (!password) return toast.error('Please enter your password.');

    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: signInEmail,
      password,
    });
    if (error) {
      setSubmitting(false);
      toast.error(authMessage(error.message));
      return;
    }

    await refreshProfile();
    toast.success('Logged in!');
    router.push('/');
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resetEmail.trim())) return toast.error('Please enter a valid email address.');

    setSubmitting(true);
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
      redirectTo: `${origin}/login`,
    });
    setSubmitting(false);
    if (error) {
      toast.error(authMessage(error.message));
      return;
    }
    toast.success('If an account exists, a reset link has been sent to your email.');
    setView('login');
  }

  if (view === 'forgot') {
    return (
      <div className="mx-auto max-w-md">
        <h1 className="text-2xl font-bold text-slate-900">Reset your password</h1>
        <p className="mt-1 text-sm text-slate-600">
          Enter your account email and we&apos;ll send you a link to reset your password.
        </p>

        <form onSubmit={handleForgot} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="resetEmail">Email</Label>
            <Input
              id="resetEmail"
              type="email"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send reset link
          </Button>
        </form>

        <button
          type="button"
          onClick={() => setView('login')}
          className="mt-4 text-sm font-medium text-blue-600 hover:underline"
        >
          ← Back to log in
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-bold text-slate-900">Log in</h1>
      <p className="mt-1 text-sm text-slate-600">
        New here?{' '}
        <Link href="/signup" className="font-medium text-blue-600 hover:underline">Create an account</Link>
      </p>

      {/* Email / Phone toggle */}
      <div className="mt-6 grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setMode('email')}
          className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition ${
            mode === 'email' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Mail className="h-4 w-4" />Email
        </button>
        <button
          type="button"
          onClick={() => setMode('phone')}
          className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition ${
            mode === 'phone' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Phone className="h-4 w-4" />Phone
        </button>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        {mode === 'email' ? (
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="10-digit mobile"
              maxLength={10}
              autoComplete="tel"
            />
          </div>
        )}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <button
              type="button"
              onClick={() => setView('forgot')}
              className="text-xs font-medium text-blue-600 hover:underline"
            >
              Forgot password?
            </button>
          </div>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
            autoComplete="current-password"
          />
        </div>
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Log in
        </Button>
      </form>
    </div>
  );
}

```````

## 13. `app/signup/page.tsx`

```````tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSupabase } from '@/lib/supabase-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { AccountType } from '@/lib/types';
import { Loader2 } from 'lucide-react';

export default function SignupPage() {
  const router = useRouter();
  const supabase = getSupabase();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [accountType, setAccountType] = useState<AccountType>('job_seeker');
  const [submitting, setSubmitting] = useState(false);

  function authMessage(msg: string): string {
    const m = msg.toLowerCase();
    if (m.includes('already') || m.includes('already registered')) return 'An account with this email already exists.';
    if (m.includes('password')) return 'Password must be at least 6 characters.';
    if (m.includes('invalid email') || m.includes('email')) return 'Please enter a valid email address.';
    if (m.includes('rate limit')) return 'Too many attempts. Please wait a minute and try again.';
    return msg || 'Could not create your account. Please try again.';
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) return toast.error('Please enter your full name.');

    if (accountType === 'job_seeker') {
      if (!/^\d{10}$/.test(phone.replace(/\D/g, ''))) return toast.error('Please enter a valid 10-digit Indian mobile number.');
      if (password.length < 6) return toast.error('Password must be at least 6 characters.');
      if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return toast.error('Please enter a valid email address.');
    } else {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return toast.error('Please enter a valid email address.');
      if (password.length < 6) return toast.error('Password must be at least 6 characters.');
    }

    setSubmitting(true);
    const signupEmail = email.trim() || `${phone.replace(/\D/g, '')}@phone.ncrwalkin`;
    const { data, error } = await supabase.auth.signUp({
      email: signupEmail,
      password,
      options: { data: { full_name: fullName.trim(), account_type: accountType, phone: phone.replace(/\D/g, '') || undefined } },
    });
    if (error) {
      setSubmitting(false);
      toast.error(authMessage(error.message));
      return;
    }

    const userId = data.user?.id;
    if (userId) {
      const { error: profileErr } = await supabase.from('profiles').insert({
        user_id: userId,
        full_name: fullName.trim(),
        phone: phone.replace(/\D/g, '') || null,
        account_type: accountType,
        skills: [],
        domain_experience: [],
      });
      if (profileErr) console.warn('profile insert failed', profileErr);
    }

    toast.success('Account created!');
    router.push(accountType === 'recruiter' ? '/walkins/new' : '/walkins');
  }

  const isSeeker = accountType === 'job_seeker';

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-bold text-slate-900">Create your account</h1>
      <p className="mt-1 text-sm text-slate-600">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-emerald-600 hover:underline">Log in</Link>
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" autoComplete="name" />
        </div>

        <div className="space-y-1.5">
          <Label>I am a...</Label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setAccountType('job_seeker')}
              className={`rounded-lg border p-3 text-left transition-colors ${
                isSeeker ? 'border-emerald-600 bg-emerald-50 ring-1 ring-emerald-600' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <span className="block text-sm font-semibold text-slate-900">Job Seeker</span>
              <span className="block text-xs text-slate-500">Find BPO walk-ins</span>
            </button>
            <button
              type="button"
              onClick={() => setAccountType('recruiter')}
              className={`rounded-lg border p-3 text-left transition-colors ${
                !isSeeker ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <span className="block text-sm font-semibold text-slate-900">Recruiter / HR</span>
              <span className="block text-xs text-slate-500">Post walk-ins (Rs 499)</span>
            </button>
          </div>
        </div>

        {isSeeker ? (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone number (10-digit) *</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98XXXXXXXX" maxLength={10} inputMode="numeric" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email (optional)</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
              <p className="text-xs text-slate-500">If you skip email, we use your phone as login.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" autoComplete="new-password" />
            </div>
          </>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email *</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="hr@company.com" autoComplete="email" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password *</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" autoComplete="new-password" />
            </div>
          </>
        )}

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create account
        </Button>
      </form>

      <p className="mt-4 text-center text-xs text-slate-500">
        You can browse and apply on WhatsApp without an account. Sign up only to save jobs or post listings.
      </p>
    </div>
  );
}

```````

## 14. `app/profile/saved/page.tsx`

```````tsx
'use client';
// Saved jobs page — shows all jobs the logged-in job seeker has bookmarked.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSupabase } from '@/lib/supabase-client';
import { useAuth } from '@/lib/auth-context';
import { RequireAuth } from '@/lib/auth-guards';
import { Job } from '@/lib/types';
import { CategoryBadge } from '@/lib/categories';
import { SaveButton } from '@/components/save-button';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { MapPin, Banknote, Briefcase, Bookmark, Inbox } from 'lucide-react';
import { formatRelative } from '@/lib/format';

function SavedJobsInner() {
  const supabase = getSupabase();
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      // Join saved_jobs -> jobs and only keep live or approved ones (a job may
      // have been un-approved, paused, or deleted after the user saved it).
      const { data, error } = await supabase
        .from('saved_jobs')
        .select('job_id, jobs(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) {
        setLoading(false);
        return;
      }
      const approved = (data ?? [])
        .map((row) => row.jobs as unknown as Job)
        .filter((j): j is Job => !!j && (j.status === 'live' || j.status === 'approved'));
      setJobs(approved);
      setLoading(false);
    })();
  }, [supabase, user]);

  if (loading) {
    return <div className="space-y-3">{[1, 2].map((i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Bookmark className="h-5 w-5 text-blue-600" />
        <h1 className="text-2xl font-bold text-slate-900">Saved jobs</h1>
      </div>

      {jobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 py-16 text-center">
          <Inbox className="h-8 w-8 text-slate-300" />
          <p className="mt-2 text-sm text-slate-500">You haven&apos;t saved any jobs yet.</p>
          <Link href="/jobs" className="mt-4"><Button variant="outline">Browse jobs</Button></Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {jobs.map((job) => (
            <div key={job.id} className="group rounded-xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-md">
              <div className="flex items-start justify-between gap-2">
                <Link href={`/jobs/${job.id}`} className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold text-slate-900 group-hover:text-blue-700">{job.role_title}</h3>
                  <p className="truncate text-sm text-slate-600">{job.company_name}</p>
                </Link>
                <SaveButton jobId={job.id} />
              </div>

              <Link href={`/jobs/${job.id}`} className="mt-3 block space-y-2">
                <CategoryBadge category={job.category} />
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                  <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-slate-400" />{job.location_type === 'Other City' ? job.city_name || 'Other City' : job.location_type}</span>
                  <span className="inline-flex items-center gap-1"><Banknote className="h-3.5 w-3.5 text-slate-400" />{job.salary_range}</span>
                  <span className="inline-flex items-center gap-1"><Briefcase className="h-3.5 w-3.5 text-slate-400" />{job.experience_required}</span>
                </div>
                <p className="text-xs text-slate-400">Posted {formatRelative(job.created_at)}</p>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SavedJobsPage() {
  return (
    <RequireAuth>
      <SavedJobsInner />
    </RequireAuth>
  );
}

```````

## 15. `.env.example`

```````bash
# ---------------------------------------------------------------------------
# NCR Walk-in — environment variables
#
# Copy this file to `.env.local` and fill in real values. NEVER commit .env files.
#
# Anything prefixed with NEXT_PUBLIC_ is embedded in the browser bundle and is
# therefore PUBLIC. Server-only secrets MUST NOT use the NEXT_PUBLIC_ prefix.
#
# The app degrades gracefully to demo behavior when server secrets are unset:
#   - No SUPABASE_SERVICE_ROLE_KEY / ADMIN_PIN  => admin API returns 503.
#   - No RAZORPAY_KEY_SECRET / KEY_ID           => payments run in demo mode.
# ---------------------------------------------------------------------------

# ---- Public (safe to expose to the browser) ----

# Supabase project URL, e.g. https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_URL=

# Supabase anon/public key (RLS-protected).
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Razorpay key id (public — used to open Checkout). Leave blank for demo mode.
NEXT_PUBLIC_RAZORPAY_KEY_ID=

# ---- Server-only (NEVER prefix these with NEXT_PUBLIC_) ----

# Supabase service-role key. Bypasses RLS — server-side only.
SUPABASE_SERVICE_ROLE_KEY=

# Shared PIN that gates the /admin panel and /api/admin route.
ADMIN_PIN=

# Razorpay key secret. Used server-side to create orders and verify payments.
RAZORPAY_KEY_SECRET=

# Razorpay webhook secret. Used to verify x-razorpay-signature on webhooks.
RAZORPAY_WEBHOOK_SECRET=

```````

## 16. `SETUP_BACKEND.md`

```````md
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
2. Listing price is fixed at **Rs 499 = 49900 paise** in the server routes.
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
  payment, requires `status === 'captured'` and `amount === 49900`, then
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

```````
