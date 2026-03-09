

## Improve AI Message UX: Loading, Animations, and Question Highlighting

### 1. Better "Thinking" Indicator

**Current:** Simple bouncing dots (Solo) or a lone spinner (Together). Both feel generic.

**Proposed:** A consistent, polished thinking indicator across all chat types — an animated pill with a subtle shimmer effect and contextual text:

```text
┌──────────────────────────────┐
│  ●●●  Reflecting on that...  │
└──────────────────────────────┘
```

- Rotating contextual labels: "Thinking...", "Reflecting on that...", "Preparing a question..."
- Three dots with a wave animation (staggered scale, not just bounce)
- Extract into a shared `<AIThinkingBubble />` component used by SoloChat, TogetherChat, and FaceToFace

### 2. Smoother Message Animations

**Current:** All messages use the same `animate-fade-in` with a simple translateY. Messages from split responses (multi-bubble) all appear at once.

**Proposed:**
- **Staggered multi-bubble entry:** When split AI responses are saved to DB, they appear with increasing delays (e.g., 0ms, 400ms, 800ms) to simulate the AI "typing" multiple messages — a lightweight sequential reveal without actual typing simulation
- **Smoother transition:** Update the `fade-in` keyframe to use a slightly longer duration for AI messages (0.5s) with an ease-out-cubic curve, and add a subtle scale-up from 0.97
- **Scroll behavior:** After each bubble appears, smooth-scroll to it so the user follows along naturally

### 3. Question Call-to-Action Highlighting

**Current:** AI questions look identical to AI commentary — same bubble, same styling.

**Proposed:** Detect the last AI message that ends with a `?` and give it a distinct visual treatment:

```text
Regular AI bubble:
┌─────────────────────────────────────┐
│  That's really insightful — you     │
│  both value stability.              │
└─────────────────────────────────────┘

Question bubble (highlighted):
┌─────────────────────────────────────┐
│  What would a "financially secure   │  ← border-left accent
│  life together" look like?          │     + slightly different bg
└─────────────────────────────────────┘
```

- Only the **last AI message** in a sequence gets the highlight treatment (the actionable question the user should respond to)
- Styling: a left border accent in primary color + slightly warmer background (`bg-primary/5 border-l-2 border-primary`)
- For Together Chat: when it's your turn, the question bubble gets an extra subtle pulse animation to draw attention

### Files to Modify

1. **New: `src/components/conversation/AIThinkingBubble.tsx`** — shared thinking indicator component with wave-animated dots and rotating labels
2. **`src/components/conversation/SoloChat.tsx`** — use `AIThinkingBubble`, add question highlighting to last AI message, improve fade-in stagger
3. **`src/components/conversation/TogetherChat.tsx`** — same changes, replace spinner with `AIThinkingBubble`
4. **`src/components/conversation/FaceToFace.tsx`** — use `AIThinkingBubble` for summary loading state
5. **`tailwind.config.ts`** — add a `wave` keyframe for the dots animation
6. **`src/index.css`** — add utility class for the question-highlight bubble style

