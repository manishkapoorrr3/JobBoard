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
