DROP POLICY "Users send messages" ON public.messages;

CREATE POLICY "Users send messages" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    conversation_id IN (
      SELECT id FROM conversations WHERE user_id = auth.uid()
    )
    AND (sender_id = auth.uid() OR sender_id IS NULL)
  );