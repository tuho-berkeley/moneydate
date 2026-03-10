DROP POLICY "Partners send messages in couple conversations" ON public.messages;
CREATE POLICY "Partners send messages in couple conversations" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    (conversation_id IN (
      SELECT conversations.id FROM conversations
      WHERE conversations.couple_id = get_couple_id(auth.uid())
        AND conversations.type = 'together'::conversation_type
    ))
    AND (sender_id = auth.uid() OR sender_id IS NULL)
  );