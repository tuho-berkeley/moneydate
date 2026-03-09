CREATE POLICY "Users delete own conversation messages"
ON public.messages
FOR DELETE
TO authenticated
USING (
  conversation_id IN (
    SELECT id FROM conversations WHERE user_id = auth.uid()
  )
);