

## Align Together Chat and Face-to-Face with Solo Chat standard

### Misalignments found

**Together Chat:**
1. **AI bubble color** (line 478): `bg-accent/50 text-foreground border border-accent` → should be `bg-secondary/50 text-foreground` (no border)
2. **User max-width** (line 465): `max-w-[80%]` → should be `max-w-[85%]`
3. **Empty-state thinking bubble** (lines 443-448): wrapped in "Guide" label with Sparkles icon → should be bare `<AIThinkingBubble />` like Solo
4. **Mid-conversation thinking bubble** (lines 508-514): wrapped in "Guide" label with Sparkles icon → should be bare `<AIThinkingBubble />` like Solo

**Face-to-Face summary view:**
5. **Summary bubble styling** (line 287): `bg-accent/30 border border-accent rounded-2xl p-5` → should be `bg-secondary/50 rounded-2xl p-4`
6. **Empty summary bubble** (line 306): same `bg-accent/30 border border-accent rounded-2xl p-5` → same fix
7. **Custom "AI Insights" label** (lines 289-295, 307-312): uses Sparkles + custom markup → should use `<AIMessageLabel type="insight" />` component
8. **Prose spacing** (line 297): `prose-p:my-2 prose-ul:my-2 prose-li:my-0.5` → should be `prose-p:my-1 prose-ul:my-1 prose-li:my-0`

### Changes

**`src/components/conversation/TogetherChat.tsx`:**
- Line 465: change `max-w-[80%]` to `max-w-[85%]` for non-AI messages
- Lines 477-478: change AI bubble from `bg-accent/50 text-foreground border border-accent` to `bg-secondary/50 text-foreground`
- Lines 443-448: remove the "Guide" label div wrapper, render bare `<AIThinkingBubble />`
- Lines 508-514: remove the "Guide" label div wrapper, render bare `<AIThinkingBubble />`
- Remove unused `Sparkles` import

**`src/components/conversation/FaceToFace.tsx`:**
- Add import for `AIMessageLabel` from `./AIMessageLabel`
- Lines 287: change to `bg-secondary/50 rounded-2xl p-4`
- Lines 289-295: replace custom Sparkles label with `<AIMessageLabel type="insight" />`
- Line 297: change prose spacing to match Solo (`prose-p:my-1 prose-ul:my-1 prose-li:my-0`)
- Lines 306: change to `bg-secondary/50 rounded-2xl p-4`
- Lines 307-312: replace custom label with `<AIMessageLabel type="insight" />`
- Remove unused `Sparkles` import (if no longer used elsewhere)

