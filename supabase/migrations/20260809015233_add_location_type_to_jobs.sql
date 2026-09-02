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
