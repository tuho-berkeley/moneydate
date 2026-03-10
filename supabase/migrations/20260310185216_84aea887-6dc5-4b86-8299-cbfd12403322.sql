
DROP POLICY "Users delete own conversation messages" ON public.messages;

CREATE POLICY "Users delete own conversation messages" ON public.messages
FOR DELETE TO authenticated
USING (
  conversation_id IN (
    SELECT id FROM conversations
    WHERE user_id = auth.uid()
       OR (couple_id = get_couple_id(auth.uid()) AND type = 'together')
  )
);
