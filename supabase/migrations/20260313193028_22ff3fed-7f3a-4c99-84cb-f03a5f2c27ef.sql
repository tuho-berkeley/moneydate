
-- Allow partners to insert messages in face_to_face couple conversations
CREATE POLICY "Partners send messages in f2f conversations"
ON public.messages FOR INSERT TO authenticated
WITH CHECK (
  conversation_id IN (
    SELECT id FROM conversations
    WHERE couple_id = get_couple_id(auth.uid())
    AND type = 'face_to_face'
  )
  AND (sender_id = auth.uid() OR sender_id IS NULL)
);

-- Allow partners to delete messages in face_to_face couple conversations
CREATE POLICY "Partners delete messages in f2f conversations"
ON public.messages FOR DELETE TO authenticated
USING (
  conversation_id IN (
    SELECT id FROM conversations
    WHERE couple_id = get_couple_id(auth.uid())
    AND type = 'face_to_face'
  )
);
