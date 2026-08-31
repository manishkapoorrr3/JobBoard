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
