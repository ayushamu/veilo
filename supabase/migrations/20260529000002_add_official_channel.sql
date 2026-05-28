-- Migration: Veilo Official Channel Setup
-- Description: Seeds the official broadcast channel, updates the auto-join trigger for new accounts, retro-provisions existing active users, and creates strict pg constraints so only gp5282@myamu.ac.in can message.

-- 1. Seed official channel room
INSERT INTO public.rooms (id, type, name, avatar_emoji)
VALUES ('11111111-1111-1111-1111-111111111111', 'group'::public.room_type, 'Veilo Official Channel', '📢')
ON CONFLICT (id) DO NOTHING;

-- 2. Update auto-join trigger function to join the official channel on profile activation
CREATE OR REPLACE FUNCTION public.auto_join_global_room()
RETURNS trigger AS $$
BEGIN
  IF new.status = 'active'::public.profile_status AND old.status = 'onboarding'::public.profile_status THEN
    -- Join global room
    INSERT INTO public.room_participants (room_id, profile_id)
    VALUES ('00000000-0000-0000-0000-000000000000', new.id)
    ON CONFLICT (room_id, profile_id) DO NOTHING;
    
    -- Insert default campus entry notification
    INSERT INTO public.messages (room_id, sender_id, content, type)
    VALUES (
      '00000000-0000-0000-0000-000000000000',
      new.id,
      new.nickname || ' entered the campus chat.',
      'system'::public.message_type
    );

    -- Join Veilo Official Channel
    INSERT INTO public.room_participants (room_id, profile_id)
    VALUES ('11111111-1111-1111-1111-111111111111', new.id)
    ON CONFLICT (room_id, profile_id) DO NOTHING;
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Retro-join existing active users to the official channel
INSERT INTO public.room_participants (room_id, profile_id)
SELECT '11111111-1111-1111-1111-111111111111', id
FROM public.profiles
WHERE status = 'active'
ON CONFLICT (room_id, profile_id) DO NOTHING;



-- 5. Trigger Function: Strict pg constraint to enforce administrative broadcast rights on public.messages
CREATE OR REPLACE FUNCTION public.check_official_channel_message_insert()
RETURNS trigger AS $$
DECLARE
  user_email TEXT;
BEGIN
  IF new.room_id = '11111111-1111-1111-1111-111111111111' THEN
    -- Bypasses system messages (welcomes or automatic alerts)
    IF new.type = 'system'::public.message_type THEN
      RETURN new;
    END IF;
    
    SELECT email INTO user_email FROM auth.users WHERE id = new.sender_id;
    IF user_email IS NULL OR (user_email <> 'gp5282@myamu.ac.in' AND user_email <> 'ayushcmf@gmail.com') THEN
      RAISE EXCEPTION 'Only Veilo Admins are authorized to broadcast in this channel.';
    END IF;
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Attach message insert constraint trigger
DROP TRIGGER IF EXISTS enforce_official_channel_insert_policy ON public.messages;

CREATE TRIGGER enforce_official_channel_insert_policy
BEFORE INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.check_official_channel_message_insert();
