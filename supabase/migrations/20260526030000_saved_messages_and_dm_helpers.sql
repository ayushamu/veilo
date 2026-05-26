-- Migration: Saved Messages & Direct Messaging Helpers
-- Description: Sets up auto-creation of "Saved Messages" for active users and RPC functions for secure DM routing with block checks.

-- 1. Trigger Function: Automatically create "Saved Messages" room upon profile activation
CREATE OR REPLACE FUNCTION public.create_self_chat_room()
RETURNS trigger AS $$
DECLARE
  new_room_id UUID;
BEGIN
  IF new.status = 'active'::public.profile_status AND old.status = 'onboarding'::public.profile_status THEN
    -- A. Create direct type room
    INSERT INTO public.rooms (type, name, avatar_emoji)
    VALUES ('direct'::public.room_type, 'Saved Messages', '📌')
    RETURNING id INTO new_room_id;

    -- B. Add owner as the sole participant
    INSERT INTO public.room_participants (room_id, profile_id)
    VALUES (new_room_id, new.id);

    -- C. Insert initial welcome system guide message
    INSERT INTO public.messages (room_id, sender_id, content, type)
    VALUES (
      new_room_id,
      new.id,
      'Welcome to your private space! Draft messages, save links, or upload media here.',
      'system'::public.message_type
    );
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger binding
CREATE OR REPLACE TRIGGER on_profile_activated_create_self_chat
  AFTER UPDATE OF status ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.create_self_chat_room();

-- 2. Retro-provision Saved Messages for existing active users who do not have one
DO $$
DECLARE
  r RECORD;
  new_room_id UUID;
BEGIN
  FOR r IN SELECT id FROM public.profiles WHERE status = 'active'::public.profile_status LOOP
    -- If user does not have a direct room with exactly 1 participant (themselves)
    IF NOT EXISTS (
      SELECT 1 
      FROM public.room_participants rp
      JOIN public.rooms rm ON rm.id = rp.room_id
      WHERE rp.profile_id = r.id 
        AND rm.type = 'direct'::public.room_type
        AND (SELECT COUNT(*) FROM public.room_participants WHERE room_id = rm.id) = 1
    ) THEN
      -- Create room
      INSERT INTO public.rooms (type, name, avatar_emoji)
      VALUES ('direct'::public.room_type, 'Saved Messages', '📌')
      RETURNING id INTO new_room_id;

      -- Add participant
      INSERT INTO public.room_participants (room_id, profile_id)
      VALUES (new_room_id, r.id);

      -- Insert welcome message
      INSERT INTO public.messages (room_id, sender_id, content, type)
      VALUES (
        new_room_id,
        r.id,
        'Welcome to your private space! Draft messages, save links, or upload media here.',
        'system'::public.message_type
      );
    END IF;
  END LOOP;
END;
$$;

-- 3. RPC Helper: Finds a DM room containing exactly user_a and user_b
CREATE OR REPLACE FUNCTION public.find_matching_dm_room(user_a UUID, user_b UUID)
RETURNS UUID AS $$
DECLARE
  matched_room_id UUID;
BEGIN
  SELECT rp1.room_id INTO matched_room_id
  FROM public.room_participants rp1
  JOIN public.room_participants rp2 ON rp1.room_id = rp2.room_id
  JOIN public.rooms r ON r.id = rp1.room_id
  WHERE r.type = 'direct'::public.room_type
    AND rp1.profile_id = user_a
    AND rp2.profile_id = user_b
    AND (SELECT COUNT(*) FROM public.room_participants WHERE room_id = r.id) = 2
  LIMIT 1;

  RETURN matched_room_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. RPC Helper: Creates a direct messaging room for user_a and user_b (checks blocks first)
CREATE OR REPLACE FUNCTION public.create_dm_room(user_a UUID, user_b UUID)
RETURNS UUID AS $$
DECLARE
  new_room_id UUID;
  block_exists BOOLEAN;
BEGIN
  -- A. Check if either user has blocked the other
  SELECT EXISTS (
    SELECT 1 FROM public.user_blocks
    WHERE (blocker_id = user_a AND blocked_id = user_b)
       OR (blocker_id = user_b AND blocked_id = user_a)
  ) INTO block_exists;

  IF block_exists THEN
    -- Throw an ambiguous exception matching our privacy policy wording
    RAISE EXCEPTION 'Chat unavailable';
  END IF;

  -- B. Create room record (name and emoji left null for direct chats to resolve dynamically)
  INSERT INTO public.rooms (type)
  VALUES ('direct'::public.room_type)
  RETURNING id INTO new_room_id;

  -- C. Add both participants
  INSERT INTO public.room_participants (room_id, profile_id)
  VALUES (new_room_id, user_a), (new_room_id, user_b);

  RETURN new_room_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
