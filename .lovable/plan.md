

# Simplify "Completed" Status by Using `user_activities.status` Directly

## Problem

The Activity detail page (`Activity.tsx`) uses an expensive message-counting approach to determine per-mode completion badges. It:
1. Fetches all conversations for the activity
2. Loops through each conversation and counts messages individually
3. Compares against thresholds (3 for solo/f2f, 6 for together)

This causes noticeable loading delay because it makes N+1 database queries (one per conversation). Meanwhile, the `user_activities` table already tracks `completed` and `insights_generated` statuses, and the homepage (`ActivityPath.tsx`) already uses these statuses correctly.

## What Already Works

- **Homepage / ActivityPath**: Uses `userStatus` from `user_activities` — fast, single query. No change needed.
- **Chat/F2F screens**: Use `useConversationCompletion` hook to mark completion — these set the status. No change needed for how they display completion internally.

## What Needs to Change

**`src/pages/Activity.tsx`** — Replace the `completedTypes` query (message-counting logic) with a simpler approach that checks whether conversations of each type exist with the activity already marked as completed/insights_generated in `user_activities`.

Since `user_activities` tracks activity-level completion (not per-mode), we have two options:

### Recommended Approach

Instead of counting messages per conversation, check if a conversation of that type exists at all for this activity. The completion badge on the Activity detail page is a per-mode indicator, so we check:
- Does a conversation of type X exist for this activity?
- Does it have any user messages (i.e., was it actually used)?

This replaces N+1 queries with just 2 queries (conversations + a single messages count grouped query), but still gives per-mode granularity.

Actually, simpler: since the completion flow already sets `user_activities.status` to `completed` or `insights_generated` when thresholds are met, and the activity detail page just needs to show whether each mode was "done enough," we can check if conversations of each type have enough messages using a single query with conversation IDs, rather than looping.

### Changes

1. **`src/pages/Activity.tsx`** — Rewrite the `completedTypes` query to fetch conversations and count messages in a single batch query instead of looping per conversation. Use `.in("conversation_id", conversationIds)` with a group-by approach, or simply check `user_activities.status` for the overall activity and show per-mode badges based on conversation existence + the activity being completed.

   Simplest viable approach: If the activity's `user_activities.status` is `completed` or `insights_generated`, show "Completed" for any conversation mode that has at least 1 user message. This removes the per-conversation message counting loop entirely.

   ```
   // Instead of N+1 queries:
   // 1. Check if activity is completed/insights_generated (already fetched as lessonCompleted query)
   // 2. Get conversation types that exist with user messages (single query)
   ```

2. Remove the sequential `for...of` loop that makes individual message count queries per conversation.

