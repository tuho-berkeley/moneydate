

## Fix: Streaming-to-Segment Split Glitch

### The Problem
During streaming, the UI shows all content before the first `---` separator. But the `---` hasn't arrived yet, so the user sees text that will later belong to segment 2. When streaming ends and segments are split, content visibly disappears from the first bubble — a jarring glitch.

### Solution: Buffer-then-Reveal

Stop showing raw streaming text to the user entirely. Instead:

1. **During AI generation**: Show only the thinking bubble while buffering the full response silently
2. **After generation completes**: Split into segments, then reveal each segment sequentially with:
   - **Fade-in** on the bubble background (the `message-appear` animation from the approved plan)
   - **Typewriter effect** on the text content (characters/words appear progressively)

This eliminates the glitch because the user never sees unsplit content.

### Technical Changes

**`src/components/conversation/SoloChat.tsx`** and **`TogetherChat.tsx`**:
- Remove `streamingMessage` state and `streamingDisplayContent` logic
- In `streamChat.onDelta`: only accumulate into a local `fullResponse` variable (no `setStreamingMessage`)
- Keep showing the thinking bubble throughout generation (already works via `isWaitingForAI`)
- After `onDone` splits and saves segments → staggered reveal with fade-in (existing `revealedIds` logic, 400ms delay)
- Add a `TypewriterText` component that progressively reveals text word-by-word for messages in `freshIds`

**`src/components/conversation/FaceToFace.tsx`**:
- Same buffer approach for summary generation — show thinking bubble, then fade-in the summary segments

**New component: `src/components/conversation/TypewriterText.tsx`**:
- Accepts `content: string` and `onComplete: () => void`
- Uses `useEffect` + interval to reveal words progressively (~30ms per word)
- Renders with `ReactMarkdown` at each step
- Calls `onComplete` when fully revealed (to clean up `freshIds`)

**`tailwind.config.ts`**:
- Add `message-appear` keyframe (opacity 0→1, translateY 8→0, 400ms) — from approved plan

### UX Flow
```text
User sends message
  → Thinking bubble appears
  → AI generates (buffered silently)
  → Generation complete, segments saved to DB
  → Thinking bubble disappears
  → Segment 1 fades in, text types out word-by-word
  → 400ms later, segment 2 fades in, text types out
  → All settled
```

### Files to modify
- `tailwind.config.ts` — add animation keyframe
- `src/components/conversation/TypewriterText.tsx` — new component
- `src/components/conversation/SoloChat.tsx` — remove streaming display, use buffer-then-reveal
- `src/components/conversation/TogetherChat.tsx` — same changes
- `src/components/conversation/FaceToFace.tsx` — same buffer approach for summary

