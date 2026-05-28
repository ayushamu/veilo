-- Migration: Realtime Presence, Last Seen Privacy, & Receipts Support
-- Date: 2026-05-29

-- 1. Upgrade profiles table with presence parameters
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS show_last_seen BOOLEAN DEFAULT TRUE NOT NULL;

-- 2. Build high-performance indices for queries
CREATE INDEX IF NOT EXISTS idx_profiles_last_seen_at ON public.profiles(last_seen_at);

-- 3. Create high-efficiency RPC helper to fetch peer profile & read receipts in DMs
CREATE OR REPLACE FUNCTION public.get_peer_presence_and_read_status(
    p_room_id UUID,
    p_current_user_id UUID
)
RETURNS TABLE (
    peer_id UUID,
    nickname VARCHAR,
    avatar_emoji VARCHAR,
    last_seen_at TIMESTAMP WITH TIME ZONE,
    show_last_seen BOOLEAN,
    peer_last_read_at TIMESTAMP WITH TIME ZONE,
    my_last_read_at TIMESTAMP WITH TIME ZONE
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Verify current user is a participant of the room
    IF NOT EXISTS (
        SELECT 1 FROM public.room_participants 
        WHERE room_id = p_room_id AND profile_id = p_current_user_id
    ) THEN
        RAISE EXCEPTION 'Not a participant of this room';
    END IF;

    RETURN QUERY
    SELECT 
        p.id as peer_id,
        p.nickname,
        p.avatar_emoji,
        p.last_seen_at,
        p.show_last_seen,
        rp_peer.last_read_at as peer_last_read_at,
        rp_me.last_read_at as my_last_read_at
    FROM public.room_participants rp_peer
    JOIN public.room_participants rp_me ON rp_me.room_id = p_room_id AND rp_me.profile_id = p_current_user_id
    JOIN public.profiles p ON p.id = rp_peer.profile_id
    WHERE rp_peer.room_id = p_room_id
      AND rp_peer.profile_id != p_current_user_id
    LIMIT 1;
END;
$$;
