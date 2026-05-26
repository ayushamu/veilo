-- ============================================================
-- Veilo: Anonymous Confession Cards (Discover Page)
-- ============================================================

-- 1. Confession Posts Table
CREATE TABLE public.confessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id    UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content       TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 280),
  mood_emoji    VARCHAR(8) NOT NULL DEFAULT '💭',
  gradient_id   SMALLINT NOT NULL DEFAULT 0 CHECK (gradient_id BETWEEN 0 AND 7),
  allow_dm      BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_confessions_created ON public.confessions(created_at DESC);
CREATE INDEX idx_confessions_profile  ON public.confessions(profile_id);

-- 2. Confession Reactions (one per user per confession; can update emoji)
CREATE TABLE public.confession_reactions (
  confession_id UUID REFERENCES public.confessions(id) ON DELETE CASCADE NOT NULL,
  profile_id    UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  emoji         VARCHAR(8) NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (confession_id, profile_id)
);

CREATE INDEX idx_confession_reactions_confession ON public.confession_reactions(confession_id);

-- 3. Seen Tracking — true Tinder-style: don't show a card twice
CREATE TABLE public.confession_seen (
  confession_id UUID REFERENCES public.confessions(id) ON DELETE CASCADE NOT NULL,
  profile_id    UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  seen_at       TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (confession_id, profile_id)
);

CREATE INDEX idx_confession_seen_profile ON public.confession_seen(profile_id);

-- ============================================================
-- 4. Row Level Security
-- ============================================================

ALTER TABLE public.confessions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.confession_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.confession_seen      ENABLE ROW LEVEL SECURITY;

-- Confessions: readable by all active users
CREATE POLICY "Active users can read confessions"
  ON public.confessions FOR SELECT
  USING (public.is_profile_active(auth.uid()));

-- Confessions: only the poster can insert
CREATE POLICY "Users post own confessions"
  ON public.confessions FOR INSERT
  WITH CHECK (auth.uid() = profile_id AND public.is_profile_active(auth.uid()));

-- Confessions: only the poster can delete
CREATE POLICY "Users delete own confessions"
  ON public.confessions FOR DELETE
  USING (auth.uid() = profile_id);

-- Reactions: readable by active users
CREATE POLICY "Active users read confession reactions"
  ON public.confession_reactions FOR SELECT
  USING (public.is_profile_active(auth.uid()));

-- Reactions: insert own
CREATE POLICY "Active users react to confessions"
  ON public.confession_reactions FOR INSERT
  WITH CHECK (auth.uid() = profile_id AND public.is_profile_active(auth.uid()));

-- Reactions: update own (change emoji)
CREATE POLICY "Users update own confession reaction"
  ON public.confession_reactions FOR UPDATE
  USING (auth.uid() = profile_id);

-- Reactions: delete own
CREATE POLICY "Users remove own confession reaction"
  ON public.confession_reactions FOR DELETE
  USING (auth.uid() = profile_id);

-- Seen: users manage their own seen records
CREATE POLICY "Users manage own seen"
  ON public.confession_seen FOR ALL
  USING (auth.uid() = profile_id)
  WITH CHECK (auth.uid() = profile_id);

-- ============================================================
-- 5. Enable Realtime
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.confessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.confession_reactions;

-- ============================================================
-- 6. RPC Helper to fetch unseen confessions in database
-- ============================================================

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
) AS $$
BEGIN
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
  WHERE c.profile_id != current_user_id
    AND NOT EXISTS (
      SELECT 1 
      FROM public.confession_seen cs 
      WHERE cs.confession_id = c.id 
        AND cs.profile_id = current_user_id
    )
  ORDER BY c.created_at DESC
  LIMIT limit_val;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
