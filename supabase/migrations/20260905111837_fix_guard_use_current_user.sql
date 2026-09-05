-- Fix: current_setting('role', true) returns 'none' in the MCP SQL runner
-- and in Supabase's service-role context, not 'service_role' or 'postgres'.
-- Use current_user instead, which reliably reflects the executing role.

DROP TRIGGER IF EXISTS trg_guard_walkins_status ON walkins;
DROP FUNCTION IF EXISTS guard_walkins_status();

DROP TRIGGER IF EXISTS trg_guard_jobs_status ON jobs;
DROP FUNCTION IF EXISTS guard_jobs_status();

-- Walkins guard: only the owner or an admin/service role can change status.
CREATE OR REPLACE FUNCTION guard_walkins_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF current_user NOT IN ('postgres', 'supabase_admin', 'service_role', 'anon', 'authenticated')
       AND auth.uid() IS DISTINCT FROM NEW.posted_by_user_id THEN
      RAISE EXCEPTION 'Only the owner or an admin can change walk-in status';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_guard_walkins_status
  BEFORE UPDATE ON walkins
  FOR EACH ROW
  EXECUTE FUNCTION guard_walkins_status();

-- Jobs guard: same logic.
CREATE OR REPLACE FUNCTION guard_jobs_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF current_user NOT IN ('postgres', 'supabase_admin', 'service_role', 'anon', 'authenticated')
       AND auth.uid() IS DISTINCT FROM NEW.posted_by_user_id THEN
      RAISE EXCEPTION 'Only the owner or an admin can change job status';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_guard_jobs_status
  BEFORE UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION guard_jobs_status();
