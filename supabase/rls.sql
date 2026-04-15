-- =============================================================================
-- MyMedInfo: Row Level Security policies for Supabase
-- Replaces Firestore security rules (firestore.rules)
-- Run this AFTER schema.sql in the Supabase SQL Editor.
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE practices ENABLE ROW LEVEL SECURITY;
ALTER TABLE medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- ===================
-- Helper function: is the current user an active admin?
-- Replaces the Firestore isAdmin() security rule helper
-- ===================
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM admins
    WHERE uid = auth.uid()
      AND is_active = true
  );
$$;

-- =============================================================================
-- PRACTICES policies
-- Firestore rules: allow create: if true; allow read, update, delete: if isAdmin()
-- Extended: practice users can also read/update their own practice via auth_uid
-- =============================================================================

-- Anyone can insert (signup form)
CREATE POLICY "practices_insert_anyone"
  ON practices FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

-- Admins can read all practices
CREATE POLICY "practices_select_admin"
  ON practices FOR SELECT
  TO authenticated
  USING (is_admin());

-- Practice users can read their own practice
CREATE POLICY "practices_select_own"
  ON practices FOR SELECT
  TO authenticated
  USING (auth_uid = auth.uid());

-- Admins can update any practice
CREATE POLICY "practices_update_admin"
  ON practices FOR UPDATE
  TO authenticated
  USING (is_admin());

-- Practice users can update their own practice (medication selections)
CREATE POLICY "practices_update_own"
  ON practices FOR UPDATE
  TO authenticated
  USING (auth_uid = auth.uid())
  WITH CHECK (auth_uid = auth.uid());

-- Only admins can delete practices
CREATE POLICY "practices_delete_admin"
  ON practices FOR DELETE
  TO authenticated
  USING (is_admin());

-- =============================================================================
-- MEDICATIONS policies
-- Firestore rules: allow read: if true; allow write: if isAdmin()
-- =============================================================================

-- Anyone can read medications (patient-facing)
CREATE POLICY "medications_select_anyone"
  ON medications FOR SELECT
  TO authenticated, anon
  USING (true);

-- Only admins can insert medications
CREATE POLICY "medications_insert_admin"
  ON medications FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

-- Only admins can update medications
CREATE POLICY "medications_update_admin"
  ON medications FOR UPDATE
  TO authenticated
  USING (is_admin());

-- Only admins can delete medications
CREATE POLICY "medications_delete_admin"
  ON medications FOR DELETE
  TO authenticated
  USING (is_admin());

-- =============================================================================
-- ADMINS policies
-- Firestore rules: allow read, write: if isAdmin()
-- =============================================================================

-- Only active admins can read admin list
CREATE POLICY "admins_select_admin"
  ON admins FOR SELECT
  TO authenticated
  USING (is_admin());

-- Only active admins can insert new admins
CREATE POLICY "admins_insert_admin"
  ON admins FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

-- Only active admins can update admins
CREATE POLICY "admins_update_admin"
  ON admins FOR UPDATE
  TO authenticated
  USING (is_admin());

-- Only active admins can delete admins
CREATE POLICY "admins_delete_admin"
  ON admins FOR DELETE
  TO authenticated
  USING (is_admin());

-- =============================================================================
-- LOGIN_AUDIT policies
-- Firestore: no explicit rules (default deny), written via Cloud Functions
-- =============================================================================

-- Authenticated users can insert their own audit records
CREATE POLICY "login_audit_insert_authenticated"
  ON login_audit FOR INSERT
  TO authenticated
  WITH CHECK (uid = auth.uid());

-- Only admins can read audit logs
CREATE POLICY "login_audit_select_admin"
  ON login_audit FOR SELECT
  TO authenticated
  USING (is_admin());

-- =============================================================================
-- AUDIT_LOG policies
-- Firestore: no explicit rules (default deny), written via Cloud Functions
-- =============================================================================

-- Only admins can read medication audit logs
CREATE POLICY "audit_log_select_admin"
  ON audit_log FOR SELECT
  TO authenticated
  USING (is_admin());

-- Only admins can insert audit entries (via Edge Functions with service role)
CREATE POLICY "audit_log_insert_admin"
  ON audit_log FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());
