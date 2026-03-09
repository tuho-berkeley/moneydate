

## Problem Analysis

Three UX issues in Together Chat (and likely Solo Chat too):

1. **Empty bubble flash**: `setStreamingMessage("")` on line 233 immediately renders an empty AI bubble before any content arrives
2. **Brief thinking bubble**: The thinking bubble condition (`isAIResponding && streamingMessage === null`) is only true for a split second between setting `isAIResponding=true` and `setStreamingMessage("")`
3. **All messages appear at once**: After streaming, `setStreamingMessage(null)` removes the preview, then DB inserts + query invalidation cause all segments to pop in simultaneously

## Plan

### 1. Show thinking bubble until real content arrives (TogetherChat + SoloChat)

- Change the thinking bubble condition to: `isAIResponding && (!streamingMessage || streamingMessage === "")`  
- This means: show thinking dots from the moment AI starts until actual text chunks arrive
- Remove the initial `setStreamingMessage("")` call — keep it `null` until the first `onDelta` fires

### 2. Remove the initial loading spinner

- Replace `isLoadingStart` spinner (line 390-394) with the thinking bubble — since `isAIResponding` will be true during seeding, the thinking bubble handles this case already

### 3. Stagger multiple AI messages after save

- After streaming completes and segments are saved to DB, instead of showing all at once, introduce a `revealedCount` state
- When new AI messages appear in `dbMessages` that weren't there before, use a `setTimeout`-based reveal to show them one by one with ~600ms delay
- Alternatively (simpler): keep the existing `animationDelay` on messages but use a dedicated state tracking "newly inserted AI message IDs" so their fade-in animations are staggered from the moment they appear, not from page load

**Simpler approach chosen**: Track a `newMessageIds` set. When `dbMessages` changes and new AI messages appear, add them to the set with a staggered reveal timer. Messages not yet revealed are hidden. This avoids complex animation logic — just controls when each message enters the DOM.

### Files to modify

- **`src/components/conversation/TogetherChat.tsx`**:
  - Remove `setStreamingMessage("")` from `triggerAI`, keep `null` until first delta
  - Update thinking bubble condition to `isAIResponding && !streamingMessage`
  - Remove `isLoadingStart` spinner — thinking bubble covers it
  - Add staggered reveal for newly inserted AI messages using a ref + setTimeout pattern

- **`src/components/conversation/SoloChat.tsx`**: Apply the same fixes (thinking bubble condition, no empty streaming init, staggered reveal)

