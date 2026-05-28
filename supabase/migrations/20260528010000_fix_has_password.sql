-- Database migration to correct has_password tracking
-- Resolves the issue where Supabase populates encrypted_password with placeholder hashes for OTP users.

-- 1. Reset has_password to FALSE for all existing users (except those who registered with password metadata)
UPDATE public.profiles
SET has_password = COALESCE(
  (SELECT (u.raw_user_meta_data->>'is_password_signup') = 'true'
   FROM auth.users u
   WHERE u.id = public.profiles.id),
  false
);

-- 2. Update the handle_new_user function to set has_password from raw_user_meta_data
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
    COALESCE((new.raw_user_meta_data->>'is_password_signup') = 'true', false)
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
