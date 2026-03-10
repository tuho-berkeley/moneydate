

## Plan: Dynamic Face-to-Face Questions via AI

### Problem
The 5 flashcard questions and guidance hints in Face-to-Face mode are hardcoded (`defaultPrompts` array, lines 39-60 of `FaceToFace.tsx`). Every activity shows the same questions regardless of topic.

### Solution
Add a `generate_prompts` conversation type to the existing `chat` edge function that generates 5 topic-specific questions + guidance based on the activity title and description. Load them when the component mounts.

### Changes

**1. Edge function (`supabase/functions/chat/index.ts`)**
- Add a `generate_prompts` branch (non-streaming, like `validate_answer`)
- System prompt instructs the model to return exactly 5 JSON objects with `question` and `guidance` fields, tailored to the activity
- Use `google/gemini-2.5-flash-lite` (fast, cheap — this is a simple generation task)
- Use tool calling to extract structured output (array of 5 prompts)

**2. Frontend (`src/components/conversation/FaceToFace.tsx`)**
- Add a `useQuery` to fetch prompts on mount by calling the chat function with `conversationType: "generate_prompts"`
- Show a loading state while prompts are being generated
- Fall back to `defaultPrompts` if the request fails
- Replace all references to `defaultPrompts` with the dynamic prompts

**3. Client helper (`src/lib/streamChat.ts` or inline)**
- Use `supabase.functions.invoke` for the non-streaming prompt generation call (simpler than streaming)

