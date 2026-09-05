-- Proper fix: allow server roles (postgres, supabase_admin, service_role)
-- and the row owner. Block all other authenticated users from changing
-- status on rows they don't own.

DROP TRIGGER IF EXISTS trg_guard_walkins_status ON walkins;
DROP FUNCTION IF EXISTS guard_walkins_status();

DROP TRIGGER IF EXISTS trg_guard_jobs_status ON jobs;
DROP FUNCTION IF EXISTS guard_jobs_status();

CREATE OR REPLACE FUNCTION guard_walkins_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    -- Allow server-side roles that bypass RLS.
    IF current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
      RETURN NEW;
    END IF;
    -- Allow the row owner.
    IF auth.uid() = NEW.posted_by_user_id THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Only the owner or an admin can change walk-in status';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_guard_walkins_status
  BEFORE UPDATE ON walkins
  FOR EACH ROW
  EXECUTE FUNCTION guard_walkins_status();

CREATE OR REPLACE FUNCTION guard_jobs_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
      RETURN NEW;
    END IF;
    IF auth.uid() = NEW.posted_by_user_id THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Only the owner or an admin can change job status';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_guard_jobs_status
  BEFORE UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION guard_jobs_status();
