-- Database migration to support password authentication tracking

-- 1. Add has_password column to profiles table
ALTER TABLE public.profiles ADD COLUMN has_password BOOLEAN DEFAULT FALSE NOT NULL;

-- 2. Backfill has_password for existing users from auth.users
UPDATE public.profiles p
SET has_password = (u.encrypted_password IS NOT NULL AND u.encrypted_password <> '')
FROM auth.users u
WHERE p.id = u.id;

-- 3. Update the handle_new_user function to set has_password on profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, nickname, gender, avatar_emoji, status, has_password)
  VALUES (
    new.id,
    'Student_' || substring(new.id::text from 1 for 8), -- Unique temporary nickname placeholder
    'male'::public.user_gender,
    '👤',
    'onboarding'::public.profile_status,
    (new.encrypted_password IS NOT NULL AND new.encrypted_password <> '')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
