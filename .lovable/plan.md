

## Pre-Closure AI Message Before Completion Buttons

### What changes

When `completionReached` becomes true (quality answer threshold met), instead of immediately showing the "Generate Insights" / "Continue Conversation" buttons:

1. **Trigger one final AI call** with a special `conversationType: "pre_closure"` that instructs the AI to reply with a brief comment/feedback/insight about the user's last message — **no questions allowed**.
2. **Display that message** with the normal typewriter animation.
3. **After the pre-closure message finishes rendering**, show the two buttons.

### Files to modify

| File | Change |
|------|--------|
| `supabase/functions/chat/index.ts` | Add `pre_closure` system prompt: "Respond with a brief, warm reflection on what the user just shared. Do NOT ask any questions. 1-2 sentences max." |
| `src/components/conversation/SoloChat.tsx` | When quality count hits 3: set `completionReached`, call the pre-closure AI, then show buttons after pre-closure message is revealed |
| `src/components/conversation/TogetherChat.tsx` | Same pattern — after both partners hit 3 quality answers, trigger pre-closure AI, then show buttons |

### Flow

```text
User sends 3rd quality answer
  → completionReached = true
  → AI call with conversationType "pre_closure"
  → Pre-closure message appears (typewriter)
  → Typewriter completes
  → Show "Generate Insights" + "Continue Conversation" buttons
```

If user picks "Continue Conversation", the flow resets and normal questions resume. The next time completion is reached again, another pre-closure message fires before showing buttons again.

