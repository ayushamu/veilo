-- WhatsApp-style replies: store a stable anonymous snapshot of the quoted message.

ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS reply_to_message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS reply_to_content TEXT,
ADD COLUMN IF NOT EXISTS reply_to_sender_nickname VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_messages_reply_to_message_id
ON public.messages(reply_to_message_id);
