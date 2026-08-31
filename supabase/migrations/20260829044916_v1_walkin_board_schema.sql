/*
# NCR Walk-in V1 — full schema upgrade

## Overview
Transforms the job board from a generic BPO/BFSI prototype into a Delhi-NCR
BPO walk-in board with ₹499 paid walk-in posts. Adds rich card fields
(salary, shift, cab, WhatsApp, education, etc.), expands status from
pending/approved/rejected to draft/live/expired/reported, removes the
admin-only status guard (recruiters now self-publish after paying), and
adds an auto-hide trigger when a listing receives 3+ reports.

## 1. New Columns — walkins
- city (text): Noida | Greater Noida | Gurgaon | Delhi | Ghaziabad | Faridabad
- area (text): e.g. Sector 62, Udyog Vihar, Cyber City
- salary_min (int): lower end of salary range in INR
- salary_max (int): upper end of salary range in INR
- education (text): 10th | 12th | Graduate
- shift (text): Day | Night | Rotational
- cab (boolean, default false): cab pickup/drop provided
- languages (text): English | Hindi | both
- whatsapp_number (text): 10-digit Indian mobile for WhatsApp apply
- hr_phone (text, nullable): alternate HR phone
- openings (int): number of open positions
- description (text): 4-6 line job description
- is_sample (boolean, default false): marks seeded demo listings
- paid_until (timestamptz, nullable): when the paid listing expires (7 days)

## 2. New Columns — jobs
- city (text): same city options + Remote
- area (text)
- salary_min (int), salary_max (int)
- education (text), shift (text), cab (boolean), languages (text)
- whatsapp_number (text), hr_phone (text), openings (int)
- is_sample (boolean, default false)
- paid_until (timestamptz, nullable)
(jobs already has job_description, salary_range, experience_required)

## 3. Status Expansion
Both walkins and jobs: constraint expanded from
  ('pending','approved','rejected')
to
  ('draft','live','expired','reported','pending','approved','rejected')
New posts use 'live' (paid walk-ins) or 'draft' (before payment).
Legacy 'approved' rows remain visible.

## 4. Status Guard Triggers — Modified
The old guard functions blocked ALL non-admin status changes. Replaced with
functions that allow the ROW OWNER (auth.uid() = posted_by_user_id) to change
status too, so recruiters can self-publish after paying and renew expired
listings.

## 5. RLS Policy Updates
- read_approved_jobs → read_live_jobs: SELECT for anon+authenticated when
  status IN ('live','approved') (keeps old data visible).
- read_approved_walkins → read_live_walkins: same.
- All other policies unchanged.

## 6. Auto-Hide on Reports
New trigger: after INSERT on reports, if the referenced walkin/job has 3+
reports, set its status to 'reported'. The trigger function is SECURITY
DEFINER so it bypasses RLS; the modified status guard allows it because the
function runs as postgres.

## 7. Notes
- No columns dropped or renamed — existing data and code still work.
- All new columns are nullable (except boolean defaults) so existing rows
  are not broken.
- Seeding is done separately via execute_sql after this migration.
*/

-- ============ walkins: add columns ============
ALTER TABLE walkins
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS area text,
  ADD COLUMN IF NOT EXISTS salary_min int,
  ADD COLUMN IF NOT EXISTS salary_max int,
  ADD COLUMN IF NOT EXISTS education text CHECK (education IS NULL OR education IN ('10th','12th','Graduate')),
  ADD COLUMN IF NOT EXISTS shift text CHECK (shift IS NULL OR shift IN ('Day','Night','Rotational')),
  ADD COLUMN IF NOT EXISTS cab boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS languages text CHECK (languages IS NULL OR languages IN ('English','Hindi','both')),
  ADD COLUMN IF NOT EXISTS whatsapp_number text,
  ADD COLUMN IF NOT EXISTS hr_phone text,
  ADD COLUMN IF NOT EXISTS openings int,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS is_sample boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS paid_until timestamptz;

-- ============ jobs: add columns ============
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS area text,
  ADD COLUMN IF NOT EXISTS salary_min int,
  ADD COLUMN IF NOT EXISTS salary_max int,
  ADD COLUMN IF NOT EXISTS education text CHECK (education IS NULL OR education IN ('10th','12th','Graduate')),
  ADD COLUMN IF NOT EXISTS shift text CHECK (shift IS NULL OR shift IN ('Day','Night','Rotational')),
  ADD COLUMN IF NOT EXISTS cab boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS languages text CHECK (languages IS NULL OR languages IN ('English','Hindi','both')),
  ADD COLUMN IF NOT EXISTS whatsapp_number text,
  ADD COLUMN IF NOT EXISTS hr_phone text,
  ADD COLUMN IF NOT EXISTS openings int,
  ADD COLUMN IF NOT EXISTS is_sample boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS paid_until timestamptz;

-- ============ Expand status constraints ============
DO $$
DECLARE
  c text;
BEGIN
  -- walkins
  SELECT conname INTO c FROM pg_constraint
    WHERE conrelid = 'walkins'::regclass AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%status%';
  IF c IS NOT NULL THEN EXECUTE format('ALTER TABLE walkins DROP CONSTRAINT %I', c); END IF;
  ALTER TABLE walkins ADD CONSTRAINT walkins_status_check
    CHECK (status IN ('draft','live','expired','reported','pending','approved','rejected'));

  -- jobs
  SELECT conname INTO c FROM pg_constraint
    WHERE conrelid = 'jobs'::regclass AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%status%';
  IF c IS NOT NULL THEN EXECUTE format('ALTER TABLE jobs DROP CONSTRAINT %I', c); END IF;
  ALTER TABLE jobs ADD CONSTRAINT jobs_status_check
    CHECK (status IN ('draft','live','expired','reported','pending','approved','rejected'));
END $$;

-- ============ Replace status guard triggers ============
-- Allow row owner to change status (for self-publishing after payment).
CREATE OR REPLACE FUNCTION guard_jobs_status() RETURNS trigger AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF current_setting('role', true) NOT IN ('service_role','postgres','supabase_admin')
       AND auth.uid() IS DISTINCT FROM posted_by_user_id THEN
      RAISE EXCEPTION 'Only the owner or an admin can change job status';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION guard_walkins_status() RETURNS trigger AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF current_setting('role', true) NOT IN ('service_role','postgres','supabase_admin')
       AND auth.uid() IS DISTINCT FROM posted_by_user_id THEN
      RAISE EXCEPTION 'Only the owner or an admin can change walk-in status';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers already exist; just update the functions they call.
-- (CREATE OR REPLACE FUNCTION updates the body in place.)

-- ============ Update RLS read policies ============
DROP POLICY IF EXISTS "read_approved_jobs" ON jobs;
DROP POLICY IF EXISTS "read_live_jobs" ON jobs;
CREATE POLICY "read_live_jobs" ON jobs FOR SELECT
  TO anon, authenticated USING (status IN ('live','approved'));

DROP POLICY IF EXISTS "read_approved_walkins" ON walkins;
DROP POLICY IF EXISTS "read_live_walkins" ON walkins;
CREATE POLICY "read_live_walkins" ON walkins FOR SELECT
  TO anon, authenticated USING (status IN ('live','approved'));

-- ============ Auto-hide trigger on reports ============
CREATE OR REPLACE FUNCTION auto_hide_on_reports() RETURNS trigger AS $$
DECLARE
  rpt_count int;
  tbl text;
  row_id uuid;
BEGIN
  IF NEW.walkin_id IS NOT NULL THEN
    SELECT count(*) INTO rpt_count FROM reports WHERE walkin_id = NEW.walkin_id;
    IF rpt_count >= 3 THEN
      UPDATE walkins SET status = 'reported' WHERE id = NEW.walkin_id AND status NOT IN ('reported','rejected');
    END IF;
  ELSIF NEW.job_id IS NOT NULL THEN
    SELECT count(*) INTO rpt_count FROM reports WHERE job_id = NEW.job_id;
    IF rpt_count >= 3 THEN
      UPDATE jobs SET status = 'reported' WHERE id = NEW.job_id AND status NOT IN ('reported','rejected');
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_hide_on_reports ON reports;
CREATE TRIGGER trg_auto_hide_on_reports AFTER INSERT ON reports
  FOR EACH ROW EXECUTE FUNCTION auto_hide_on_reports();
