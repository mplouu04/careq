-- Ensure staff bootstrap trigger only runs on INSERT and never overwrites
-- is_active (deactivate was observed flipping back to true after auth updates).

CREATE OR REPLACE FUNCTION public.handle_new_staff_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  v_role := LOWER(TRIM(NEW.raw_app_meta_data->>'staff_role'));

  IF v_role IS NULL OR v_role NOT IN ('admin', 'doctor', 'nurse', 'receptionist') THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.staff (id, first_name, last_name, email, role, is_active)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(TRIM(NEW.raw_app_meta_data->>'staff_first_name'), ''), 'Staff'),
    COALESCE(NULLIF(TRIM(NEW.raw_app_meta_data->>'staff_last_name'), ''), 'User'),
    NEW.email,
    v_role::staff_role,
    TRUE
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_staff_user();
