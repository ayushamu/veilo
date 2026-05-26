-- Migration: Add is_forwarded flag to messages table
-- Description: Adds a boolean column is_forwarded to indicate if a message was forwarded from another room.

ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS is_forwarded BOOLEAN DEFAULT false NOT NULL;
