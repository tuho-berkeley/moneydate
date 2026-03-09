

## Update Solo Chat AI System Prompt

### What changes
One file: `supabase/functions/chat/index.ts` — replace the `solo` system prompt with the new tone and guidelines.

### Updated solo prompt
The new prompt will:
- Set the tone as "a wise, supportive friend" — warm, non-judgmental, curious, practical, emotionally safe
- Define the role as a personal reflection guide (not financial advisor)
- Include clear guidelines: one question at a time, encourage reflection, summarize insights, normalize discomfort
- Add explicit "never provide" guardrails (investment, tax, legal advice)
- Incorporate the activity context dynamically via `activityTitle` and `activityDescription`
- Avoid finance jargon, long explanations, judgmental language

### Scope
- Only the `solo` key in the `systemPrompts` object changes
- Together and face-to-face prompts unchanged in this step (will update separately)
- No database or frontend changes needed

