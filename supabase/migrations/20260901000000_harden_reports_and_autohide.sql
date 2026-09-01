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
