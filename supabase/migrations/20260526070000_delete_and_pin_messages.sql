-- 1. Alter rooms table to add pinned_message_id reference with set null cascade
ALTER TABLE public.rooms 
ADD COLUMN IF NOT EXISTS pinned_message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL;

-- Create index for pinned messages lookup
CREATE INDEX IF NOT EXISTS idx_rooms_pinned_message ON public.rooms(pinned_message_id);

-- 2. Add RLS policy for message deletion (users can delete their own messages)
CREATE POLICY "Users can delete their own messages" 
ON public.messages FOR DELETE 
USING (auth.uid() = sender_id);

-- 3. Add RLS policy for room updates (participants can update room settings such as pinned_message_id)
CREATE POLICY "Users can update rooms they participate in" 
ON public.rooms FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM public.room_participants 
        WHERE room_participants.room_id = rooms.id 
          AND room_participants.profile_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.room_participants 
        WHERE room_participants.room_id = rooms.id 
          AND room_participants.profile_id = auth.uid()
    )
);
