-- Migration: Enable Realtime for core tables
-- Description: Adds messages, message_reactions, and room_participants to the supabase_realtime publication and sets REPLICA IDENTITY FULL on message_reactions.

DO $$
BEGIN
  -- Create supabase_realtime publication if it does not exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  -- Add public.messages to supabase_realtime if not already added
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;

  -- Add public.message_reactions to supabase_realtime if not already added
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'message_reactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
  END IF;

  -- Add public.room_participants to supabase_realtime if not already added
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'room_participants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.room_participants;
  END IF;
END
$$;

-- Set REPLICA IDENTITY FULL on message_reactions so that all columns (including message_id) are present in DELETE payloads
ALTER TABLE public.message_reactions REPLICA IDENTITY FULL;
