-- Add avatar_config column to public.profiles if it does not already exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_config JSONB DEFAULT '{}'::jsonb NOT NULL;

-- Comment for developer documentation
COMMENT ON COLUMN public.profiles.avatar_config IS 'Stores the customizer visual options for DiceBear client-side avatar rendering (e.g. hairstyle, colors, accessories).';
