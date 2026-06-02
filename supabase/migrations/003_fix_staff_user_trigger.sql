-- Fix: handle_new_staff_user trigger fails when admin creates a user via the dashboard API
-- Root cause: SECURITY DEFINER without SET search_path causes RLS/permission failures when
-- the auth service inserts into public.staff during user creation.
--
-- RUN THIS IN: Supabase Dashboard → SQL Editor → New query → Run

-- Step 1: Grant the auth sub-role access to public.staff
-- (required because the trigger fires as the auth.users owner, not postgres)
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT INSERT, UPDATE ON public.staff TO supabase_auth_admin;

-- Step 2: Recreate the trigger function with search_path and safe role casting
CREATE OR REPLACE FUNCTION public.handle_new_staff_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- Only run when user metadata contains a role
  v_role := LOWER(TRIM(NEW.raw_user_meta_data->>'role'));

  IF v_role IS NULL OR v_role NOT IN ('admin', 'doctor', 'nurse', 'receptionist') THEN
    -- Not a staff user (e.g. regular patient auth) — skip silently
    RETURN NEW;
  END IF;

  INSERT INTO public.staff (id, first_name, last_name, email, role, is_active)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'first_name'), ''), 'Staff'),
    COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'last_name'), ''), 'User'),
    NEW.email,
    v_role::staff_role,
    TRUE
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Step 3: Recreate the trigger (drop + create to ensure it uses the updated function)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_staff_user();
