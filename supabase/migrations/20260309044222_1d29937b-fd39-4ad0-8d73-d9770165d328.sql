-- Create stages table
CREATE TABLE public.stages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  goal TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  icon TEXT NOT NULL DEFAULT '📍'
);

-- Add stage_id to activities
ALTER TABLE public.activities 
ADD COLUMN stage_id UUID REFERENCES public.stages(id);

-- Enable RLS on stages
ALTER TABLE public.stages ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read stages
CREATE POLICY "Authenticated can read stages" 
ON public.stages 
FOR SELECT 
TO authenticated 
USING (true);