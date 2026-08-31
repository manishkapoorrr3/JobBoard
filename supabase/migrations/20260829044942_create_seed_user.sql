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
