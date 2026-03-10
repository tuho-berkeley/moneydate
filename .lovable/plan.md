

## Plan: Change Question Bold Weight to Semibold

The `highlightQuestions()` function wraps question sentences in `**...**` markdown, which renders as `<strong>` (font-weight 700 / extrabold). We need to override this to semibold (600).

### Changes

**`src/index.css`** — Add a single Tailwind utility or base style:
- Add `prose-strong:font-semibold` class to all 4 prose containers, OR add a global CSS rule targeting `.prose strong { font-weight: 600; }` in the base layer.

The cleanest approach: add `prose-strong:font-semibold` to the prose class lists in:
1. `src/components/conversation/SoloChat.tsx` (line 414)
2. `src/components/conversation/TogetherChat.tsx` (line 508)
3. `src/components/conversation/FaceToFace.tsx` (line 381)
4. `src/components/conversation/TypewriterText.tsx` (line 85)

Each is a one-word class addition to the existing `prose` div.

