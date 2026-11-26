-- ============================================================================
-- Purchase (PredictionSales) Migration: Create public.users Table
-- Run in PredictionSales Supabase SQL Editor
-- (https://nqxkywfmkakdkhdwivck.supabase.co)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT DEFAULT NULL,
  role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'manager', 'account_manager', 'staff')),
  role_label TEXT NOT NULL DEFAULT 'Staff',
  department TEXT DEFAULT 'Purchase',
  avatar_initials TEXT NOT NULL DEFAULT 'WM',
  phone TEXT DEFAULT NULL,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique_idx
  ON public.users (lower(email));

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read access to users" ON public.users;
CREATE POLICY "Allow read access to users"
  ON public.users
  FOR SELECT
  USING (true);
