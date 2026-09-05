-- The guard trigger functions referenced `posted_by_user_id` as a bare
-- identifier, which PL/pgSQL cannot resolve. They need NEW.posted_by_user_id.
-- Drop and recreate both functions with the correct column reference.

DROP TRIGGER IF EXISTS trg_guard_walkins_status ON walkins;
DROP FUNCTION IF EXISTS guard_walkins_status();

DROP TRIGGER IF EXISTS trg_guard_jobs_status ON jobs;
DROP FUNCTION IF EXISTS guard_jobs_status();

-- Walkins guard: only the owner or a service/admin role can change status.
CREATE OR REPLACE FUNCTION guard_walkins_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF current_setting('role', true) NOT IN ('service_role','postgres','supabase_admin')
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
    IF current_setting('role', true) NOT IN ('service_role','postgres','supabase_admin')
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
