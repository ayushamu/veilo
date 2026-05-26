-- Create public.fcm_tokens table
CREATE TABLE public.fcm_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    token TEXT UNIQUE NOT NULL,
    device_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Indexing for high-performance retrieval during outbound messaging runs
CREATE INDEX idx_fcm_tokens_profile ON public.fcm_tokens(profile_id);

-- Enable Row-Level Security
ALTER TABLE public.fcm_tokens ENABLE ROW LEVEL SECURITY;

-- Define Security RLS Policies
CREATE POLICY "Users can register their own tokens"
ON public.fcm_tokens FOR INSERT WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Users can view their own tokens"
ON public.fcm_tokens FOR SELECT USING (auth.uid() = profile_id);

CREATE POLICY "Users can update their own tokens"
ON public.fcm_tokens FOR UPDATE USING (auth.uid() = profile_id);

CREATE POLICY "Users can delete their own tokens"
ON public.fcm_tokens FOR DELETE USING (auth.uid() = profile_id);

-- Secure RPC to get all recipient FCM tokens in a room, excluding sender and blocked relationships
CREATE OR REPLACE FUNCTION public.get_room_recipient_fcm_tokens(room_id UUID)
RETURNS TABLE (
  profile_id UUID,
  token TEXT
) AS $$
BEGIN
  -- 1. Ensure the calling user is authenticated and matches a participant in the room
  IF NOT EXISTS (
    SELECT 1 FROM public.room_participants 
    WHERE room_participants.room_id = get_room_recipient_fcm_tokens.room_id 
      AND room_participants.profile_id = auth.uid()
  ) THEN
    RETURN;
  END IF;

  -- 2. Retrieve tokens for all other participants, filtering blocks
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Secure RPC to delete stale FCM tokens detected during push dispatch runs
CREATE OR REPLACE FUNCTION public.delete_stale_fcm_token(stale_token TEXT)
RETURNS VOID AS $$
BEGIN
  DELETE FROM public.fcm_tokens
  WHERE token = stale_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
