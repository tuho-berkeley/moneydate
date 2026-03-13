

# Fix: Completed Badges Not Showing on Activity Detail Page

## Root Cause

Two issues found:

1. **Both SoloChat and FaceToFace**: The `conversations.completed = true` database update is **fire-and-forget** (not awaited). The query invalidation for `completed-conversation-types` fires immediately, but the DB write may not have committed yet. When `Activity.tsx` re-queries, it reads stale data (`completed = false`).

2. **FaceToFace summary flow**: When generating the summary, `markInsightsGenerated()` is called but `conversations.completed` is already set by the earlier completion effect — so this part is fine. The issue is purely the race condition from (1).

## Changes

### `src/components/conversation/SoloChat.tsx`

**Two locations** where `conversations.completed = true` is set fire-and-forget:

- **Line ~132 (seed on load)**: `supabase.from("conversations").update(...)` — add `await`, then invalidate.
- **Line ~469 (on send)**: Same — add `await` before `queryClient.invalidateQueries`.

### `src/components/conversation/FaceToFace.tsx`

**Line ~429 (completion effect)**: The `supabase.from("conversations").update(...)` is fire-and-forget inside a `useEffect`. Since effects can't be async directly, wrap the update + invalidation in an async IIFE and `await` the update before invalidating.

Similarly for the revert at **line ~436** — `await` the update.

