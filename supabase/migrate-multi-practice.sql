-- =============================================================================
-- Unified user backfill for existing Supabase projects
-- Run this after deploying the updated schema/rls/rpc files.
--
-- What it does:
-- 1. Creates or updates `users` rows from legacy `admins`
-- 2. Creates or updates `users` rows from legacy `practice_users`
-- 3. Backfills any missing `users` rows from legacy `practices.auth_uid`
-- 4. Creates `practice_memberships` rows from those legacy practice links
-- 5. Leaves legacy `selected_medications` untouched for migration review only
--
-- What it does NOT do:
-- - It does not auto-accept any global medication cards
-- - It does not create practice custom cards
-- =============================================================================

BEGIN;

INSERT INTO users (
  uid,
  email,
  name,
  is_active,
  global_role,
  created_at,
  updated_at
)
SELECT
  admins.uid,
  admins.email,
  admins.name,
  admins.is_active,
  admins.role,
  admins.created_at,
  NOW()
FROM admins
ON CONFLICT (uid) DO UPDATE
SET
  email = EXCLUDED.email,
  name = EXCLUDED.name,
  is_active = users.is_active AND EXCLUDED.is_active,
  global_role = EXCLUDED.global_role,
  updated_at = NOW();

INSERT INTO users (
  uid,
  email,
  name,
  is_active,
  global_role,
  created_at,
  updated_at
)
SELECT
  practice_users.uid,
  practice_users.email,
  practice_users.name,
  practice_users.is_active,
  COALESCE(users.global_role, NULL),
  COALESCE(users.created_at, practice_users.created_at, NOW()),
  NOW()
FROM practice_users
LEFT JOIN users
  ON users.uid = practice_users.uid
ON CONFLICT (uid) DO UPDATE
SET
  email = CASE
    WHEN COALESCE(users.email, '') = '' THEN EXCLUDED.email
    ELSE users.email
  END,
  name = CASE
    WHEN COALESCE(users.name, '') = '' THEN EXCLUDED.name
    ELSE users.name
  END,
  is_active = users.is_active AND EXCLUDED.is_active,
  updated_at = NOW();

INSERT INTO users (
  uid,
  email,
  name,
  is_active,
  global_role,
  created_at,
  updated_at
)
SELECT
  auth_users.id,
  COALESCE(auth_users.email, practices.contact_email, ''),
  COALESCE(
    NULLIF(auth_users.raw_user_meta_data ->> 'display_name', ''),
    NULLIF(practices.contact_name, ''),
    NULLIF(practices.name, ''),
    COALESCE(auth_users.email, practices.contact_email, 'Practice user')
  ),
  true,
  NULL,
  COALESCE(practices.signed_up_at, NOW()),
  NOW()
FROM practices
JOIN auth.users AS auth_users
  ON auth_users.id = practices.auth_uid
WHERE practices.auth_uid IS NOT NULL
ON CONFLICT (uid) DO UPDATE
SET
  email = CASE
    WHEN COALESCE(users.email, '') = '' THEN EXCLUDED.email
    ELSE users.email
  END,
  name = CASE
    WHEN COALESCE(users.name, '') = '' THEN EXCLUDED.name
    ELSE users.name
  END,
  updated_at = NOW();

UPDATE practice_memberships
SET
  is_default = false,
  updated_at = NOW()
WHERE user_uid IN (
  SELECT DISTINCT auth_uid
  FROM practices
  WHERE auth_uid IS NOT NULL
);

WITH ranked_links AS (
  SELECT
    practices.id AS practice_id,
    practices.auth_uid AS user_uid,
    ROW_NUMBER() OVER (
      PARTITION BY practices.auth_uid
      ORDER BY COALESCE(practices.signed_up_at, NOW()), practices.name
    ) = 1 AS is_default,
    COALESCE(practices.signed_up_at, NOW()) AS created_at
  FROM practices
  WHERE practices.auth_uid IS NOT NULL
)
INSERT INTO practice_memberships (
  practice_id,
  user_uid,
  role,
  is_default,
  created_at,
  updated_at
)
SELECT
  ranked_links.practice_id,
  ranked_links.user_uid,
  'admin',
  ranked_links.is_default,
  ranked_links.created_at,
  NOW()
FROM ranked_links
ON CONFLICT (practice_id, user_uid) DO UPDATE
SET
  role = EXCLUDED.role,
  is_default = EXCLUDED.is_default,
  updated_at = NOW();

COMMIT;
