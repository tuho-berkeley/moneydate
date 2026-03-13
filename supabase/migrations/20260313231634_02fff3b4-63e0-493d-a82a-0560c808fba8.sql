
-- Add completed flag to conversations table
ALTER TABLE public.conversations ADD COLUMN completed boolean NOT NULL DEFAULT false;

-- Allow users to update their own conversations or couple conversations
CREATE POLICY "Users update own or couple conversations"
ON public.conversations
FOR UPDATE
TO authenticated
USING ((user_id = auth.uid()) OR (couple_id = get_couple_id(auth.uid())))
WITH CHECK ((user_id = auth.uid()) OR (couple_id = get_couple_id(auth.uid())));
