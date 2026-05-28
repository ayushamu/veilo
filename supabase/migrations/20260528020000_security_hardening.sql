-- Security hardening pass:
-- - Bind SECURITY DEFINER RPCs to auth.uid()
-- - Remove arbitrary stale FCM token deletion
-- - Enforce proxy-only media URLs for image messages

CREATE OR REPLACE FUNCTION public.find_matching_dm_room(user_a UUID, user_b UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  matched_room_id UUID;
  block_exists BOOLEAN;
BEGIN
  IF auth.uid() IS NULL OR user_a IS DISTINCT FROM auth.uid() OR user_a = user_b THEN
    RAISE EXCEPTION 'Chat unavailable';
  END IF;

  IF NOT public.is_profile_active(user_a) OR NOT public.is_profile_active(user_b) THEN
    RAISE EXCEPTION 'Chat unavailable';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_blocks
    WHERE (blocker_id = user_a AND blocked_id = user_b)
       OR (blocker_id = user_b AND blocked_id = user_a)
  ) INTO block_exists;

  IF block_exists THEN
    RAISE EXCEPTION 'Chat unavailable';
  END IF;

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
$$;

REVOKE ALL ON FUNCTION public.find_matching_dm_room(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_matching_dm_room(UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_dm_room(user_a UUID, user_b UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_room_id UUID;
  block_exists BOOLEAN;
BEGIN
  IF auth.uid() IS NULL OR user_a IS DISTINCT FROM auth.uid() OR user_a = user_b THEN
    RAISE EXCEPTION 'Chat unavailable';
  END IF;

  IF NOT public.is_profile_active(user_a) OR NOT public.is_profile_active(user_b) THEN
    RAISE EXCEPTION 'Chat unavailable';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_blocks
    WHERE (blocker_id = user_a AND blocked_id = user_b)
       OR (blocker_id = user_b AND blocked_id = user_a)
  ) INTO block_exists;

  IF block_exists THEN
    RAISE EXCEPTION 'Chat unavailable';
  END IF;

  INSERT INTO public.rooms (type)
  VALUES ('direct'::public.room_type)
  RETURNING id INTO new_room_id;

  INSERT INTO public.room_participants (room_id, profile_id)
  VALUES (new_room_id, user_a), (new_room_id, user_b);

  RETURN new_room_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_dm_room(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_dm_room(UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_unseen_confessions(current_user_id UUID, limit_val INT)
RETURNS TABLE (
  id UUID,
  profile_id UUID,
  content TEXT,
  mood_emoji VARCHAR,
  gradient_id SMALLINT,
  allow_dm BOOLEAN,
  created_at TIMESTAMPTZ,
  poster_nickname VARCHAR,
  poster_avatar VARCHAR,
  reactions JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  safe_limit INT;
BEGIN
  IF auth.uid() IS NULL OR current_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF NOT public.is_profile_active(current_user_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  safe_limit := LEAST(GREATEST(COALESCE(limit_val, 20), 1), 50);

  RETURN QUERY
  SELECT
    c.id,
    c.profile_id,
    c.content,
    c.mood_emoji,
    c.gradient_id,
    c.allow_dm,
    c.created_at,
    p.nickname::VARCHAR AS poster_nickname,
    p.avatar_emoji::VARCHAR AS poster_avatar,
    COALESCE(
      (
        SELECT jsonb_agg(jsonb_build_object('emoji', r.emoji, 'profile_id', r.profile_id))
        FROM public.confession_reactions r
        WHERE r.confession_id = c.id
      ),
      '[]'::jsonb
    ) AS reactions
  FROM public.confessions c
  JOIN public.profiles p ON c.profile_id = p.id
  WHERE c.profile_id <> current_user_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.confession_seen cs
      WHERE cs.confession_id = c.id
        AND cs.profile_id = current_user_id
    )
  ORDER BY c.created_at DESC
  LIMIT safe_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.get_unseen_confessions(UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_unseen_confessions(UUID, INT) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_room_recipient_fcm_tokens(room_id UUID)
RETURNS TABLE (
  profile_id UUID,
  token TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.room_participants
    WHERE room_participants.room_id = get_room_recipient_fcm_tokens.room_id
      AND room_participants.profile_id = auth.uid()
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT f.profile_id, f.token
  FROM public.fcm_tokens f
  JOIN public.room_participants rp ON rp.profile_id = f.profile_id
  WHERE rp.room_id = get_room_recipient_fcm_tokens.room_id
    AND rp.profile_id <> auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.user_blocks ub
      WHERE (ub.blocker_id = auth.uid() AND ub.blocked_id = f.profile_id)
         OR (ub.blocker_id = f.profile_id AND ub.blocked_id = auth.uid())
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_room_recipient_fcm_tokens(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_room_recipient_fcm_tokens(UUID) TO authenticated;

DROP FUNCTION IF EXISTS public.delete_stale_fcm_token(TEXT);

ALTER TABLE public.messages
DROP CONSTRAINT IF EXISTS messages_media_url_proxy_only;

ALTER TABLE public.messages
ADD CONSTRAINT messages_media_url_proxy_only
CHECK (
  (
    type = 'image'::public.message_type
    AND media_url IS NOT NULL
    AND media_url ~ ('^/api/media/' || room_id::TEXT || '/[A-Za-z0-9._-]+$')
  )
  OR
  (
    type <> 'image'::public.message_type
    AND media_url IS NULL
  )
) NOT VALID;

