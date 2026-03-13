

## Plan: Persistent Face-to-Face with Partner Sync & Multiple Recordings

### Overview

Four changes to Face-to-Face mode:
1. **Save prompts** to the database so they persist across sessions
2. **Save transcribed answers** per question (already partially done)
3. **Sync to partner** via `couple_id` on the conversation (like Together Chat)
4. **Multiple recordings per question** with individual delete buttons; final answer = all combined

### Database Changes

**Migration**: Update the `conversations` RLS policy for `face_to_face` type to allow partner access (already handled — the existing SELECT policy uses `couple_id = get_couple_id(auth.uid())`). Need to also add an INSERT policy for partner messages in `face_to_face` conversations (similar to the existing "Partners send messages in couple conversations" policy for `together` type).

**New RLS policy on `messages`**:
```sql
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
```

**New RLS policy on `messages`** for partner deletes in f2f:
```sql
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
```

### Data Model for Stored Prompts

Store prompts as a single message with `role: "ai"` and JSON content:
```json
{"type": "prompts", "data": [{"question": "...", "guidance": "..."}, ...]}
```

When loading, check for this message first. If found, use those prompts instead of calling the AI.

### Data Model for Multiple Answers

Currently each response is one message per (promptIndex, partner). Change to support multiple:
- Each recording saves a separate message: `{"promptIndex": 0, "transcript": "...", "recordingIndex": 0}`
- `responses` state becomes an array where multiple entries can exist for the same (promptIndex, partner)
- `getResponse` returns all responses for a (promptIndex, partner) pair
- Final combined answer = all transcripts joined with a space

### Code Changes: `src/components/conversation/FaceToFace.tsx`

1. **Add couple_id to conversation creation** (like TogetherChat):
   - Fetch user profile to get `couple_id`
   - Query conversations by `couple_id` instead of `user_id` so both partners find the same conversation
   - Create conversation with `couple_id` set

2. **Save prompts after generation**:
   - After prompts are generated (in the query), save them as an AI message with `{"type":"prompts","data":[...]}`
   - On mount, check saved messages for a prompts message; if found, return those instead of calling AI
   - Refactor prompt loading to first check DB, then generate if missing

3. **Multiple recordings per question**:
   - Change `hasResponse` / `getResponse` to work with arrays
   - `getResponses(promptIdx, partner)` returns all matching responses
   - Remove quality gate that blocks saving (save all recordings, quality check still shows toast)
   - After recording, always save to DB and add to local state
   - Show list of transcripts with individual delete (X) buttons
   - Show combined text label above the list

4. **Partner sync**:
   - Both partners see the same conversation via `couple_id`
   - Partner's recordings appear in real-time (or on refresh) under "Your Partner" tab
   - Use realtime subscription or query invalidation for live updates

5. **UI for multiple recordings**:
   - Replace single transcript display with a scrollable list
   - Each item shows the transcript text + a delete (trash) icon button
   - Delete removes from local state + deletes the DB message
   - Recording button always says "Record" (not "Record Again") since multiple are allowed
   - The checkmark on the partner tab appears when at least one recording exists

### Completion Logic Update

- Completion threshold: each partner needs at least 2 questions with recordings (unchanged logic, but now counts questions that have any recording rather than quality-checked single responses)

### File Changes Summary

| File | Change |
|------|--------|
| `src/components/conversation/FaceToFace.tsx` | Major refactor: couple_id conversation, prompt persistence, multiple recordings UI, partner sync |
| Migration SQL | Add RLS policies for f2f partner message insert/delete |

