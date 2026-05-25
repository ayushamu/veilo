-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Define Custom Enums
CREATE TYPE public.user_gender AS ENUM ('male', 'female', 'other');
CREATE TYPE public.profile_status AS ENUM ('onboarding', 'active', 'banned');
CREATE TYPE public.room_type AS ENUM ('direct', 'group');
CREATE TYPE public.message_type AS ENUM ('text', 'image', 'system');
CREATE TYPE public.report_status AS ENUM ('pending', 'resolved', 'dismissed');

-- 3. Profiles Table (Public Anonymous Identity)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nickname VARCHAR(50) UNIQUE NOT NULL,
    gender public.user_gender NOT NULL,
    avatar_emoji VARCHAR(8) NOT NULL,
    status public.profile_status DEFAULT 'onboarding'::public.profile_status NOT NULL,
    banned_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Indexing for profile lookups and status verification
CREATE INDEX idx_profiles_nickname ON public.profiles(nickname);
CREATE INDEX idx_profiles_status ON public.profiles(status);

-- 4. Registered Emails Table (SHA-256 Email Verification Ledger)
CREATE TABLE public.registered_emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email_hash VARCHAR(64) UNIQUE NOT NULL, -- Cryptographic SHA-256 hash
    profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX idx_registered_emails_hash ON public.registered_emails(email_hash);

-- 5. Chat Rooms Table
CREATE TABLE public.rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type public.room_type NOT NULL,
    name VARCHAR(100), -- Nullable for DMs
    avatar_emoji VARCHAR(8),
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 6. Room Participants Table (Many-to-Many junction)
CREATE TABLE public.room_participants (
    room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    last_read_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    is_muted BOOLEAN DEFAULT FALSE NOT NULL,
    PRIMARY KEY (room_id, profile_id)
);

CREATE INDEX idx_room_participants_profile ON public.room_participants(profile_id);

-- 7. Messages Table
CREATE TABLE public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE NOT NULL,
    sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    type public.message_type DEFAULT 'text'::public.message_type NOT NULL,
    media_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX idx_messages_room_id ON public.messages(room_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at DESC);

-- 8. Message Reactions Table
CREATE TABLE public.message_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE NOT NULL,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    emoji VARCHAR(8) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE (message_id, profile_id, emoji)
);

CREATE INDEX idx_reactions_message ON public.message_reactions(message_id);

-- 9. User Blocks Table
CREATE TABLE public.user_blocks (
    blocker_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    blocked_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    PRIMARY KEY (blocker_id, blocked_id),
    CONSTRAINT no_self_blocking CHECK (blocker_id <> blocked_id)
);

-- 10. User Reports Table
CREATE TABLE public.user_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reported_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
    reason TEXT NOT NULL,
    content_snapshot JSONB,
    status public.report_status DEFAULT 'pending'::public.report_status NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX idx_reports_status ON public.user_reports(status);

-- 11. Enable Row-Level Security (RLS) on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registered_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;

-- 12. Security RLS Policies

-- PROFILES Policies
CREATE POLICY "Users can create their own profile" 
ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Helper function to check if a user is active without triggering RLS infinite recursion loops
CREATE OR REPLACE FUNCTION public.is_profile_active(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = user_id AND status = 'active'::public.profile_status
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE POLICY "Profiles are viewable by active authenticated users" 
ON public.profiles FOR SELECT USING (
    auth.role() = 'authenticated' 
    AND (
      auth.uid() = id 
      OR 
      (status = 'active'::public.profile_status AND public.is_profile_active(auth.uid()))
    )
);

-- REGISTERED_EMAILS Policies (System-only read/write, users have no direct select access)
CREATE POLICY "System maintains registered emails ledger"
ON public.registered_emails FOR ALL USING (false);

-- ROOMS Policies
CREATE POLICY "Rooms viewable only by participants" 
ON public.rooms FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.room_participants 
        WHERE room_participants.room_id = id AND room_participants.profile_id = auth.uid()
    )
);

CREATE POLICY "Authenticated users can create rooms" 
ON public.rooms FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND created_by = auth.uid());

-- Helper function to check if a user is a participant of a room without triggering RLS loops
CREATE OR REPLACE FUNCTION public.is_room_participant(room_id UUID, user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.room_participants 
    WHERE room_participants.room_id = is_room_participant.room_id 
      AND room_participants.profile_id = is_room_participant.user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ROOM_PARTICIPANTS Policies
CREATE POLICY "View participants for joined rooms" 
ON public.room_participants FOR SELECT USING (
    profile_id = auth.uid()
    OR public.is_room_participant(room_id, auth.uid())
);

CREATE POLICY "Manage room participants" 
ON public.room_participants FOR ALL USING (auth.role() = 'authenticated');

-- MESSAGES Policies
CREATE POLICY "Messages readable by room participants" 
ON public.messages FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.room_participants 
        WHERE room_participants.room_id = messages.room_id AND room_participants.profile_id = auth.uid()
    )
);

CREATE POLICY "Messages insertable by active room participants" 
ON public.messages FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
        SELECT 1 FROM public.room_participants 
        WHERE room_participants.room_id = messages.room_id AND room_participants.profile_id = auth.uid()
    )
    AND NOT EXISTS (
        SELECT 1 FROM public.room_participants AS other_p
        JOIN public.user_blocks ON user_blocks.blocker_id = other_p.profile_id
        WHERE other_p.room_id = messages.room_id 
          AND other_p.profile_id <> auth.uid()
          AND user_blocks.blocked_id = auth.uid()
    )
);

-- MESSAGE_REACTIONS Policies
CREATE POLICY "Reactions readable by room participants"
ON public.message_reactions FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.room_participants
        JOIN public.messages ON messages.room_id = room_participants.room_id
        WHERE messages.id = message_reactions.message_id AND room_participants.profile_id = auth.uid()
    )
);

CREATE POLICY "Reactions insertable by room participants"
ON public.message_reactions FOR INSERT WITH CHECK (
    auth.uid() = profile_id
    AND EXISTS (
        SELECT 1 FROM public.room_participants
        JOIN public.messages ON messages.room_id = room_participants.room_id
        WHERE messages.id = message_reactions.message_id AND room_participants.profile_id = auth.uid()
    )
);

CREATE POLICY "Reactions deletable by owners"
ON public.message_reactions FOR DELETE USING (auth.uid() = profile_id);

-- USER_BLOCKS Policies
CREATE POLICY "Users can view their own blocks" 
ON public.user_blocks FOR SELECT USING (auth.uid() = blocker_id);

CREATE POLICY "Users can manage their blocks" 
ON public.user_blocks FOR ALL WITH CHECK (auth.uid() = blocker_id);

-- USER_REPORTS Policies
CREATE POLICY "Users can create reports"
ON public.user_reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);

-- 13. System Database Functions and Automation Triggers

-- Trigger Function: Auto-create onboarding profile when a new user registers via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, nickname, gender, avatar_emoji, status)
  VALUES (
    new.id,
    'Student_' || substring(new.id::text from 1 for 8), -- Unique temporary nickname placeholder
    'male'::public.user_gender, -- default enum
    '👤', -- default avatar
    'onboarding'::public.profile_status
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger Function: Cryptographically hash student email to verify registration uniqueness
CREATE OR REPLACE FUNCTION public.hash_registered_email()
RETURNS trigger AS $$
DECLARE
  user_email TEXT;
  hashed_email VARCHAR(64);
BEGIN
  -- We only execute this upon the user transitioning to 'active' status
  IF new.status = 'active'::public.profile_status AND old.status = 'onboarding'::public.profile_status THEN
    SELECT email INTO user_email FROM auth.users WHERE id = new.id;
    
    IF user_email IS NOT NULL THEN
      -- Lowercase email and compute standard SHA-256 hash
      hashed_email := encode(digest(lower(user_email), 'sha256'), 'hex');
      
      -- Insert hash into ledger. A unique constraint collision here blocks activation!
      INSERT INTO public.registered_emails (email_hash, profile_id)
      VALUES (hashed_email, new.id);
    END IF;
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_profile_activated_hash_email
  BEFORE UPDATE OF status ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.hash_registered_email();

-- Trigger Function: Auto-join Global AMU Chat and send standard join notification when profile is activated
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
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_profile_activated_join_global
  AFTER UPDATE OF status ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_join_global_room();

-- Seed: Populate default Global Room
INSERT INTO public.rooms (id, type, name, avatar_emoji)
VALUES ('00000000-0000-0000-0000-000000000000', 'group'::public.room_type, 'Global AMU Chat', '🎓')
ON CONFLICT (id) DO NOTHING;
