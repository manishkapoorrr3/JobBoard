/*
# NCR Job Board — initial schema

1. Overview
Job board for BPO (voice/non-voice/semi-voice) and BFSI/Finance Operations
job seekers in Delhi NCR. Two account types:
  - "Job Seeker": fills out a profile, browses jobs/walk-ins, saves jobs, reports.
  - "Recruiter/HR": posts jobs and walk-ins. All posts start as "pending" and
    are only shown publicly after an admin manually sets status to "approved"
    (done directly in Supabase — no app UI for that).

2. New Tables
- profiles: one row per auth user. full_name, phone, experience, skills,
  domain_experience, location, resume link, account_type ("job_seeker"|"recruiter").
- jobs: job listings posted by recruiters. status pending->approved by admin.
- walkins: walk-in interview events posted by recruiters. Same approval flow.
- saved_jobs: bookmarks (user_id, job_id).
- reports: users flag a job/walk-in as fake/spam/wrong info. Admin-only review.

3. Access Control (RLS)
- profiles: authenticated users read/insert/update only their own row.
- jobs: anyone (anon + authenticated) reads approved jobs. Recruiters read their
  own (any status). Authenticated insert/update/delete own rows. Status column
  is protected by a trigger so only admin (service_role/postgres) can change it.
- walkins: same model as jobs.
- saved_jobs: authenticated users read/insert/delete only their own bookmarks.
- reports: authenticated users insert + read their own. No public visibility.

4. Status column protection
  BEFORE UPDATE triggers on jobs/walkins raise an exception if status changes
  and the current role is not service_role/postgres/supabase_admin. Recruiters
  can still edit other columns of their own posts.

5. Notes
- Email confirmation is OFF.
- Owner columns default to auth.uid() so client inserts omitting the owner
  still satisfy RLS.
*/

-- ---------- profiles ----------
CREATE TABLE IF NOT EXISTS profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  phone text,
  experience_years int DEFAULT 0,
  skills text[] DEFAULT '{}',
  domain_experience text[] DEFAULT '{}',
  current_location text,
  resume_link text,
  account_type text NOT NULL DEFAULT 'job_seeker'
    CHECK (account_type IN ('job_seeker', 'recruiter')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ---------- jobs ----------
CREATE TABLE IF NOT EXISTS jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  posted_by_user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  role_title text NOT NULL,
  category text NOT NULL CHECK (category IN (
    'Voice', 'Non-Voice', 'Semi-Voice',
    'BFSI/Finance Ops', 'Reconciliation', 'KYC/AML', 'Capital Markets'
  )),
  location text NOT NULL,
  salary_range text NOT NULL,
  experience_required text NOT NULL,
  job_description text NOT NULL,
  contact_email_or_phone text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_approved_jobs" ON jobs;
CREATE POLICY "read_approved_jobs" ON jobs FOR SELECT
  TO anon, authenticated USING (status = 'approved');

DROP POLICY IF EXISTS "read_own_jobs" ON jobs;
CREATE POLICY "read_own_jobs" ON jobs FOR SELECT
  TO authenticated USING (auth.uid() = posted_by_user_id);

DROP POLICY IF EXISTS "insert_own_jobs" ON jobs;
CREATE POLICY "insert_own_jobs" ON jobs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = posted_by_user_id);

DROP POLICY IF EXISTS "update_own_jobs" ON jobs;
CREATE POLICY "update_own_jobs" ON jobs FOR UPDATE
  TO authenticated USING (auth.uid() = posted_by_user_id) WITH CHECK (auth.uid() = posted_by_user_id);

DROP POLICY IF EXISTS "delete_own_jobs" ON jobs;
CREATE POLICY "delete_own_jobs" ON jobs FOR DELETE
  TO authenticated USING (auth.uid() = posted_by_user_id);

CREATE INDEX IF NOT EXISTS jobs_status_created_idx ON jobs (status, created_at DESC);

-- ---------- walkins ----------
CREATE TABLE IF NOT EXISTS walkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  posted_by_user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  role_title text NOT NULL,
  category text NOT NULL CHECK (category IN (
    'Voice', 'Non-Voice', 'Semi-Voice',
    'BFSI/Finance Ops', 'Reconciliation', 'KYC/AML', 'Capital Markets'
  )),
  walkin_date date NOT NULL,
  walkin_time text NOT NULL,
  location_address text NOT NULL,
  contact_person text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE walkins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_approved_walkins" ON walkins;
CREATE POLICY "read_approved_walkins" ON walkins FOR SELECT
  TO anon, authenticated USING (status = 'approved');

DROP POLICY IF EXISTS "read_own_walkins" ON walkins;
CREATE POLICY "read_own_walkins" ON walkins FOR SELECT
  TO authenticated USING (auth.uid() = posted_by_user_id);

DROP POLICY IF EXISTS "insert_own_walkins" ON walkins;
CREATE POLICY "insert_own_walkins" ON walkins FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = posted_by_user_id);

DROP POLICY IF EXISTS "update_own_walkins" ON walkins;
CREATE POLICY "update_own_walkins" ON walkins FOR UPDATE
  TO authenticated USING (auth.uid() = posted_by_user_id) WITH CHECK (auth.uid() = posted_by_user_id);

DROP POLICY IF EXISTS "delete_own_walkins" ON walkins;
CREATE POLICY "delete_own_walkins" ON walkins FOR DELETE
  TO authenticated USING (auth.uid() = posted_by_user_id);

CREATE INDEX IF NOT EXISTS walkins_status_date_idx ON walkins (status, walkin_date ASC);

-- ---------- saved_jobs ----------
CREATE TABLE IF NOT EXISTS saved_jobs (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, job_id)
);

ALTER TABLE saved_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_saved" ON saved_jobs;
CREATE POLICY "select_own_saved" ON saved_jobs FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_saved" ON saved_jobs;
CREATE POLICY "insert_own_saved" ON saved_jobs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_saved" ON saved_jobs;
CREATE POLICY "delete_own_saved" ON saved_jobs FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ---------- reports ----------
CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES jobs(id) ON DELETE SET NULL,
  walkin_id uuid REFERENCES walkins(id) ON DELETE SET NULL,
  reported_by_user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('Fake listing', 'Spam', 'Wrong information', 'Other')),
  detail text,
  created_at timestamptz DEFAULT now(),
  CHECK (job_id IS NOT NULL OR walkin_id IS NOT NULL)
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "insert_own_report" ON reports;
CREATE POLICY "insert_own_report" ON reports FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = reported_by_user_id);

DROP POLICY IF EXISTS "select_own_report" ON reports;
CREATE POLICY "select_own_report" ON reports FOR SELECT
  TO authenticated USING (auth.uid() = reported_by_user_id);

-- ---------- status protection triggers ----------
CREATE OR REPLACE FUNCTION guard_jobs_status() RETURNS trigger AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF current_setting('role', true) NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
      RAISE EXCEPTION 'Only an admin can change job status';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_guard_jobs_status ON jobs;
CREATE TRIGGER trg_guard_jobs_status BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION guard_jobs_status();

CREATE OR REPLACE FUNCTION guard_walkins_status() RETURNS trigger AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF current_setting('role', true) NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
      RAISE EXCEPTION 'Only an admin can change walk-in status';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_guard_walkins_status ON walkins;
CREATE TRIGGER trg_guard_walkins_status BEFORE UPDATE ON walkins
  FOR EACH ROW EXECUTE FUNCTION guard_walkins_status();
/*
# Harden status-guard trigger functions

The guard_jobs_status / guard_walkins_status trigger functions were created as
SECURITY DEFINER (required so the trigger can read current_setting('role') with
elevated context). Two advisor warnings to fix:

1. Mutable search_path — set an explicit search_path so a hostile role can't
   hijack function resolution.
2. Executable by anon/authenticated — these are trigger-only functions, not meant
   to be called via the REST RPC endpoint. Revoke EXECUTE from public, anon, and
   authenticated. Triggers run with the table owner's privileges regardless of
   EXECUTE grants, so the triggers keep working.
*/

REVOKE EXECUTE ON FUNCTION guard_jobs_status() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION guard_walkins_status() FROM public, anon, authenticated;

ALTER FUNCTION guard_jobs_status() SET search_path = pg_catalog, public;
ALTER FUNCTION guard_walkins_status() SET search_path = pg_catalog, public;
/*
# Add location_type and city_name to jobs

1. New Columns
- jobs.location_type: text, NOT NULL, defaults to 'Delhi NCR'. Constrained to
  'Remote', 'Delhi NCR', 'Other City'. Tells the /jobs page how to filter by
  location and is shown on job cards/detail.
- jobs.city_name: text, nullable. Only filled when location_type = 'Other City'.
  Free-text city name (e.g. "Mumbai", "Bangalore").

2. Backfill
- Existing approved/pending rows get location_type = 'Delhi NCR' (the default)
  and city_name = NULL, so nothing breaks.

3. Notes
- Walkins table is intentionally unchanged — walk-ins stay Delhi NCR only.
- No RLS changes needed: the new columns are covered by existing policies.
*/

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS location_type text NOT NULL DEFAULT 'Delhi NCR'
    CHECK (location_type IN ('Remote', 'Delhi NCR', 'Other City')),
  ADD COLUMN IF NOT EXISTS city_name text;
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
/*
# Create seed user for sample listings

1. Creates a dummy auth user (seed-recruiter) so sample walk-in/job
   listings can reference a valid posted_by_user_id.
2. The password is random and unusable — this account exists only to
   own seeded sample data.
*/

DO $$
DECLARE
  seed_uid uuid;
BEGIN
  SELECT id INTO seed_uid FROM auth.users WHERE email = 'seed@ncrwalkin.internal';
  IF seed_uid IS NULL THEN
    INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
    VALUES (
      '00000000-0000-0000-0000-000000000000',
      '00000000-0000-0000-0000-000000000001',
      'authenticated',
      'authenticated',
      'seed@ncrwalkin.internal',
      crypt('random-unused-password-' || md5(random()::text), gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"account_type":"recruiter"}'::jsonb,
      '{"full_name":"Sample Listings"}'::jsonb
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;
