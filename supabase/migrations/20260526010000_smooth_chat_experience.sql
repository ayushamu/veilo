-- Smooth Core Chat Experience
-- Adds optimistic message reconciliation, stable pagination, real unread counts,
-- and narrower participant updates for read/mute state.

ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS client_message_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_sender_client_message_id
ON public.messages(sender_id, client_message_id)
WHERE client_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_room_created_id
ON public.messages(room_id, created_at DESC, id DESC);

DROP POLICY IF EXISTS "Manage room participants" ON public.room_participants;

CREATE POLICY "Users can join rooms as themselves"
ON public.room_participants FOR INSERT
WITH CHECK (
  auth.role() = 'authenticated'
  AND profile_id = auth.uid()
);

CREATE POLICY "Users can update their own room state"
ON public.room_participants FOR UPDATE
USING (
  auth.role() = 'authenticated'
  AND profile_id = auth.uid()
)
WITH CHECK (
  auth.role() = 'authenticated'
  AND profile_id = auth.uid()
);

CREATE POLICY "Users can leave rooms as themselves"
ON public.room_participants FOR DELETE
USING (
  auth.role() = 'authenticated'
  AND profile_id = auth.uid()
);

CREATE OR REPLACE FUNCTION public.enforce_room_participant_state_update()
RETURNS trigger AS $$
BEGIN
  IF new.room_id IS DISTINCT FROM old.room_id
    OR new.profile_id IS DISTINCT FROM old.profile_id
    OR new.joined_at IS DISTINCT FROM old.joined_at THEN
    RAISE EXCEPTION 'Only read and mute state can be updated on room participants.';
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS enforce_room_participant_state_update
ON public.room_participants;

CREATE TRIGGER enforce_room_participant_state_update
BEFORE UPDATE ON public.room_participants
FOR EACH ROW
EXECUTE FUNCTION public.enforce_room_participant_state_update();

DROP POLICY IF EXISTS "Messages readable by room participants" ON public.messages;
DROP POLICY IF EXISTS "Messages insertable by active room participants" ON public.messages;

CREATE POLICY "Messages readable by room participants"
ON public.messages FOR SELECT
USING (
  public.is_room_participant(messages.room_id, auth.uid())
);

CREATE POLICY "Messages insertable by active room participants"
ON public.messages FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
  AND public.is_room_participant(messages.room_id, auth.uid())
  AND NOT EXISTS (
    SELECT 1
    FROM public.room_participants AS other_p
    JOIN public.user_blocks ON user_blocks.blocker_id = other_p.profile_id
    WHERE other_p.room_id = messages.room_id
      AND other_p.profile_id <> auth.uid()
      AND user_blocks.blocked_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Reactions readable by room participants" ON public.message_reactions;
DROP POLICY IF EXISTS "Reactions insertable by room participants" ON public.message_reactions;

CREATE POLICY "Reactions readable by room participants"
ON public.message_reactions FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.messages AS m
    WHERE m.id = message_reactions.message_id
      AND public.is_room_participant(m.room_id, auth.uid())
  )
);

CREATE POLICY "Reactions insertable by room participants"
ON public.message_reactions FOR INSERT
WITH CHECK (
  auth.uid() = profile_id
  AND EXISTS (
    SELECT 1
    FROM public.messages AS m
    WHERE m.id = message_reactions.message_id
      AND public.is_room_participant(m.room_id, auth.uid())
  )
);

CREATE OR REPLACE FUNCTION public.get_chat_inbox()
RETURNS TABLE (
  room_id UUID,
  room_name TEXT,
  avatar_emoji TEXT,
  type public.room_type,
  last_message TEXT,
  last_message_at TIMESTAMP WITH TIME ZONE,
  unread_count BIGINT,
  is_muted BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH my_rooms AS (
    SELECT
      rp.room_id,
      rp.last_read_at,
      rp.is_muted,
      r.type,
      r.name,
      r.avatar_emoji,
      r.created_at
    FROM public.room_participants rp
    JOIN public.rooms r ON r.id = rp.room_id
    WHERE rp.profile_id = auth.uid()
  )
  SELECT
    my_rooms.room_id,
    COALESCE(
      CASE
        WHEN my_rooms.type = 'direct'::public.room_type THEN peer.nickname
        ELSE my_rooms.name
      END,
      'Anonymous Chat'
    )::TEXT AS room_name,
    COALESCE(
      CASE
        WHEN my_rooms.type = 'direct'::public.room_type THEN peer.avatar_emoji
        ELSE my_rooms.avatar_emoji
      END,
      '💬'
    )::TEXT AS avatar_emoji,
    my_rooms.type,
    COALESCE(
      CASE
        WHEN latest.type = 'image'::public.message_type THEN 'Photo'
        ELSE latest.content
      END,
      'Tap to start chatting...'
    )::TEXT AS last_message,
    latest.created_at AS last_message_at,
    COALESCE(unread.count, 0)::BIGINT AS unread_count,
    my_rooms.is_muted
  FROM my_rooms
  LEFT JOIN LATERAL (
    SELECT m.content, m.type, m.created_at
    FROM public.messages m
    WHERE m.room_id = my_rooms.room_id
    ORDER BY m.created_at DESC, m.id DESC
    LIMIT 1
  ) latest ON TRUE
  LEFT JOIN LATERAL (
    SELECT p.nickname, p.avatar_emoji
    FROM public.room_participants rp_peer
    JOIN public.profiles p ON p.id = rp_peer.profile_id
    WHERE rp_peer.room_id = my_rooms.room_id
      AND rp_peer.profile_id <> auth.uid()
      AND my_rooms.type = 'direct'::public.room_type
    ORDER BY rp_peer.joined_at ASC
    LIMIT 1
  ) peer ON TRUE
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS count
    FROM public.messages m_unread
    WHERE m_unread.room_id = my_rooms.room_id
      AND m_unread.created_at > my_rooms.last_read_at
      AND m_unread.sender_id <> auth.uid()
  ) unread ON TRUE
  ORDER BY COALESCE(latest.created_at, my_rooms.created_at) DESC;
$$;

REVOKE ALL ON FUNCTION public.get_chat_inbox() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_chat_inbox() TO authenticated;
