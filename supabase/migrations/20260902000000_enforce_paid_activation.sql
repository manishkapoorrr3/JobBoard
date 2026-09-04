/*
# Enforce paid activation — walk-ins go 'live' only via the verified-payment route

## Problem
guard_walkins_status() (as recreated by 20260829044916_v1_walkin_board_schema
and 20260901000000_harden_reports_and_autohide) still lets the listing OWNER
change any status of their own walk-in, including 'draft' -> 'live'. Combined
with the client-side demo activation (triggered by the frontend whenever the
Razorpay order call degrades to demo mode), the Rs 499 fee can be bypassed
entirely from the browser (DevTools, or a direct Supabase client call).

## Fix
Recreate guard_walkins_status() so that:
  1. A transition TO 'live' is allowed ONLY for the verified-payment route —
     the service_role API caller (used by /api/razorpay/verify and
     /api/razorpay/webhook) — or a trusted server-side context (psql / SQL
     editor / pg_cron, i.e. no JWT in the session, running as
     postgres / supabase_admin). Browser callers (anon / authenticated) can
     never set 'live'.
  2. The 'reported' moderation carve-out is preserved: the SECURITY DEFINER
     auto_hide_on_reports() trigger can always flip a listing to 'reported'
     (3+ reports from distinct users, de-duplicated by the unique indexes in
     20260901000000).
  3. Every other status transition keeps the previous owner- or
     service_role-only rule (owner takes their own listing offline, admin
     moderation, cron expiry).
  4. INSERTs are unaffected — the trigger is BEFORE UPDATE only. Owner
     'draft' inserts (and seeded sample rows inserted directly by SQL) still
     work.

## Caller-role detection
The caller's role is read from the PostgREST JWT claims session GUC
(`request.jwt.claims`), NOT from current_setting('role'). The `role` GUC can
be overridden by this function's SECURITY DEFINER switch to the function
owner, which would make any role-based check inside the function unreliable.
The claims GUC is set once per API session by PostgREST and survives the
definer switch, so it always identifies the actual caller.

Rules:
  - claims GUC set  => API request: role must parse, else FAIL CLOSED.
      role = 'service_role'  => privileged (verified-payment route, admin).
      role = 'anon'/'authenticated' => 'live' blocked; other transitions
        still require ownership (auth.uid() = posted_by_user_id).
  - claims GUC empty => no JWT in session:
      role GUC 'anon'/'authenticated' => FAIL CLOSED (API without claims).
      otherwise (postgres / supabase_admin / service_role / NULL, e.g. psql,
      SQL editor, pg_cron) => trusted server context, allowed.

## Hardening (kept from 20260901000000)
- SECURITY DEFINER + SET search_path = pg_catalog, public
- REVOKE EXECUTE from public / anon / authenticated (trigger-only function)
- Idempotent: safe to re-run from the Supabase SQL editor or psql.
  Success = "Success. No rows returned".

## Run order
Apply AFTER 20260901000000_harden_reports_and_autohide.sql. Running the
0901 script after this one would overwrite the hardening with the older,
owner-permissive guard body.
*/

CREATE OR REPLACE FUNCTION guard_walkins_status() RETURNS trigger AS $$
DECLARE
  claims_raw text;
  role_guc   text;
  jwt_role   text;
BEGIN
  -- (1) Moderation carve-out: auto-hide may flip any listing to 'reported'
  --     regardless of caller (the report may have been inserted by any
  --     authenticated user; the SECURITY DEFINER auto-hide trigger performs
  --     the update).
  IF NEW.status = 'reported' THEN
    RETURN NEW;
  END IF;

  -- (2) No status change: owner edits of the other columns always pass.
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  claims_raw := current_setting('request.jwt.claims', true);

  IF claims_raw IS NULL OR btrim(claims_raw) = '' THEN
    -- No JWT in this session.
    role_guc := current_setting('role', true);
    IF role_guc IN ('anon', 'authenticated') THEN
      -- An API session whose JWT claims are unreadable: fail closed.
      RAISE EXCEPTION 'Status change refused: caller role could not be verified';
    END IF;
    -- psql / SQL editor / pg_cron / direct postgres or supabase_admin
    -- connections: trusted server context.
    RETURN NEW;
  END IF;

  -- (3) API request: resolve the caller's role from the JWT claims.
  BEGIN
    jwt_role := claims_raw::jsonb ->> 'role';
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Status change refused: could not parse JWT claims';
  END IF;
  IF jwt_role IS NULL THEN
    RAISE EXCEPTION 'Status change refused: JWT role claim missing';
  END IF;

  -- (4) Paid-activation rule: 'live' is set ONLY by the verified-payment
  --     service_role route (/api/razorpay/verify, /api/razorpay/webhook) or
  --     by direct DB administration (handled above). Browser callers can
  --     never publish a walk-in, so the Rs 499 fee cannot be bypassed.
  IF NEW.status = 'live' AND jwt_role <> 'service_role' THEN
    RAISE EXCEPTION 'Only the payment service can set a walk-in live';
  END IF;

  -- (5) Every other transition: row owner or service_role only.
  IF jwt_role <> 'service_role'
     AND auth.uid() IS DISTINCT FROM NEW.posted_by_user_id THEN
    RAISE EXCEPTION 'Only the owner or an admin can change walk-in status';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public;

REVOKE EXECUTE ON FUNCTION guard_walkins_status() FROM public, anon, authenticated;

-- Ensure the BEFORE UPDATE trigger exists (idempotent; if the trigger was
-- already present, this recreates it pointing at the new function body).
DROP TRIGGER IF EXISTS trg_guard_walkins_status ON walkins;
CREATE TRIGGER trg_guard_walkins_status BEFORE UPDATE ON walkins
  FOR EACH ROW EXECUTE FUNCTION guard_walkins_status();
