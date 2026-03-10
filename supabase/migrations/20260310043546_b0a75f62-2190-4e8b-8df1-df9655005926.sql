
-- Allow couple partners to insert messages into shared (together) conversations
CREATE POLICY "Partners send messages in couple conversations"
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (
  conversation_id IN (
    SELECT id FROM conversations
    WHERE couple_id = get_couple_id(auth.uid())
    AND type = 'together'
  )
  AND sender_id = auth.uid()
);

-- Allow any authenticated user to read couples by invite_code (for joining)
CREATE POLICY "Anyone authenticated can read couple by invite code"
ON public.couples
FOR SELECT
TO authenticated
USING (true);
