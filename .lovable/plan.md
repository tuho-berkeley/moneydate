
Goal
Fix Face-to-Face so both partners always see the same prompt set, every recording is stored/displayed with quality labeling, completion is reliable, and insights use only quality responses.

What I found
- Prompt mismatch root cause: prompt generation runs before saved messages finish loading, so each device can generate a different set and cache it.
- Non-quality recordings are currently blocked from saving (early return).
- Completion check only runs on newly accepted recordings, not reliably on hydrated/realtime/deleted data.
- Insights currently use all combined recordings, not quality-only.

Implementation plan

1) Stabilize prompt persistence (same questions on both devices)
- In `FaceToFace.tsx`, gate prompt generation behind `messagesLoaded` (query success), not just `conversation`.
- Build prompts from DB first:
  - Parse all AI messages with `type: "prompts"`.
  - Choose one canonical prompt set (oldest by `created_at`) and use it.
- Only call `generate_prompts` if no canonical prompt exists after messages load.
- Before inserting newly generated prompts, re-check once for an existing prompts message to avoid race duplicates.
- After insert, invalidate messages and resolve prompts from DB (single source of truth).

2) Save every recording + show quality status inline
- Update stored response payload to include quality:
  - `{"promptIndex": n, "transcript": "...", "quality": true|false}`
- In `stopRecording`:
  - Run quality check.
  - Always save transcript (quality or not).
  - Always append to local `responses`.
- UI change in response list:
  - Quality=true: normal card.
  - Quality=false: show label badge `Say a bit more...` on that transcript row.
- Backward compatibility:
  - For older saved messages without `quality`, infer with `passesPreFilter` so old data still renders.

3) Make completion logic deterministic
- Add derived completion computation from `responses` (not just the latest recording):
  - Per partner, count unique prompt indices with at least one recording.
  - Completion = both partners have >=2 unique prompts.
- Trigger `markCompleted()` once when threshold is reached.
- Recompute on:
  - initial hydrate from DB,
  - realtime updates,
  - delete actions.
- Gate “Get Insights” button by this completion state (not merely “both have any response”).

4) Post-completion insights: quality-only input
- In summary generation, build each partner’s answer from only `quality === true` transcripts.
- Non-quality recordings remain visible in UI/history but excluded from AI payload.
- If a partner has no quality transcript for a question, send placeholder like `(no quality response)` for that side.
- After insights are saved, call `markInsightsGenerated()` so progress state is correct on return.

Technical details
- Primary file: `src/components/conversation/FaceToFace.tsx`
  - Prompt loading flow refactor (DB-first + race-safe generation)
  - `PromptResponse` model extended with `quality`
  - Recording save path changed to always persist
  - Inline badge rendering for low-quality entries
  - Derived completion state + reliable `markCompleted`
  - Insights formatter switched to quality-only
  - Call `markInsightsGenerated` after successful summary generation
- No database schema migration required for this fix.

Validation checklist
1. Device A starts F2F and leaves before recording; Device B opens same activity → identical question set.
2. Record low-quality response → transcript appears with `Say a bit more...` label and remains stored after refresh.
3. Record quality response(s) → normal display.
4. Completion reaches when each partner has recordings on 2+ prompts (including low-quality if intended for completion).
5. Tap Get Insights → AI input includes only quality transcripts.
6. Reopen completed conversation → completion/insights state persists correctly.
