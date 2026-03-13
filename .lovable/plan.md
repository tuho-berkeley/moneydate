

# Fix: Per-Mode Completion Badges on Activity Detail Page

## Root Cause

`user_activities.status` tracks completion at the **activity level**, not per conversation mode. When Solo chat completes and sets status to `completed`, the Activity detail page then shows all modes with existing conversations as completed.

## Solution: Track completion per conversation, not per activity

The conversations table already has rows per mode. We should store a `completed` flag (or equivalent) on the **conversation** itself, so we can show per-mode badges without re-counting messages.

### Option A — Use conversation existence + a `completed` column (requires migration)
Add a `completed` boolean to `conversations` table, set it when `markCompleted` fires. Activity detail page just checks `conversations.completed = true` grouped by type.

### Option B — No migration, derive from `user_activities` + conversation type tracking
Store which conversation type triggered the completion. But `user_activities` is per-activity, not per-mode, so this gets messy.

### Recommended: Option A — Add `completed` column to `conversations`

**1. Database migration**
```sql
ALTER TABLE public.conversations ADD COLUMN completed boolean NOT NULL DEFAULT false;
```

**2. `src/components/conversation/SoloChat.tsx`**
When `markCompleted()` succeeds, also update the current conversation's `completed` flag to `true`.

**3. `src/components/conversation/TogetherChat.tsx`**
Same — set `conversations.completed = true` when completion threshold is met.

**4. `src/components/conversation/FaceToFace.tsx`**
Same — set `conversations.completed = true` when `isCompleted` becomes true. Revert to `false` when recordings are deleted below threshold.

**5. `src/pages/Activity.tsx`**
Simplify `completedTypes` query: fetch conversations where `activity_id = X` and `completed = true`, return their types as a Set. No message counting, no dependency on `user_activities.status`. Single fast query.

```typescript
const { data: completedTypes } = useQuery({
  queryKey: ["completed-conversation-types", id, user?.id],
  queryFn: async () => {
    const { data } = await supabase
      .from("conversations")
      .select("type")
      .eq("activity_id", id)
      .eq("completed", true);
    return new Set(data?.map(c => c.type) || []);
  },
  enabled: !!id && !!user
});
```

**6. `src/hooks/useConversationCompletion.ts`**
- `resetCompletion`: also set `conversations.completed = false` for the relevant conversation.
- Invalidate `completed-conversation-types` query key on changes.

This gives instant per-mode badges with a single query and no threshold re-checking on the detail page.

