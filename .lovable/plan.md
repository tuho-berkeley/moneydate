

## Plan: Add Activity Outcome Column and Integrate into AI Prompts

### 1. Database Migration
Add an `outcome` text column (nullable) to the `activities` table:
```sql
ALTER TABLE public.activities ADD COLUMN outcome text;
```

### 2. Populate Outcomes for All 20 Activities
Use the insert tool to UPDATE each activity with a generated outcome based on its title and description. Examples:

| Activity | Outcome |
|---|---|
| Your Money Story | Understand how your upbringing shaped your current money beliefs and habits |
| Right Ways For Couples To Talk About Money | Learn a practical framework for having productive money conversations with your partner |
| Spender or Saver? | Identify your spending personality and understand how it complements your partner's |
| What Does Financial Security Mean to You? | Clarify your personal definition of financial security and discover where you and your partner align |
| How We Spend Our "Fun Money" | Understand each other's spending joys and find ways to respect both partners' fun priorities |
| How Couples Structure Their Finances | Explore account structures and find a system that works for your relationship |
| Our Spending Boundaries | Agree on a spending threshold for when purchases need a joint discussion |
| Our First Money Agreement | Create your first set of shared money rules covering spending, bills, and check-ins |
| Talking About Debt | Build comfort and openness around discussing debt without shame or judgment |
| Sharing Our Financial Snapshot | Get a clear, honest picture of your combined financial situation |
| The Big 3 Financial Foundations | Assess your readiness across emergency savings, insurance, and retirement |
| Emergency Fund Plan | Define a concrete emergency fund target, contribution plan, and timeline |
| Our Life Dreams | Share your big life aspirations and discover which dreams you want to pursue together |
| Top 3 Financial Priorities | Align on the goals that matter most to each of you right now |
| How Couples Set Financial Goals | Learn a simple framework for balancing short-term wants with long-term goals |
| Our Shared Goals Plan | Walk away with 3 concrete shared goals and realistic timelines |
| How Should We Manage Money Together? | Decide on a money management system that respects both partners' needs |
| Our First Couple Budget | Build a simple shared budget covering income, expenses, and savings |
| How Couples Handle Financial Conflict | Develop healthy strategies for navigating money disagreements |
| Our Money Vision | Articulate a shared vision for the financial life you want to build together |

### 3. Update Edge Function (`supabase/functions/chat/index.ts`)
- Add `activityOutcome` to the destructured request body (line 20)
- Interpolate it into every prompt that currently uses `activityTitle` and `activityDescription`, adding a line like:
  `The desired outcome is: "${activityOutcome}"`
- This affects: `generate_prompts`, `generate_one_prompt`, `solo`, `together`, `face_to_face`, `pre_closure`, `solo_insights`, `together_insights` prompts

### 4. Update `streamChat` Helper (`src/lib/streamChat.ts`)
- Add `activityOutcome` parameter to the function signature and pass it in the request body

### 5. Update All Callers
- **`Conversation.tsx`**: Pass `activityOutcome` from the fetched activity data as a prop
- **`SoloChat.tsx`**, **`TogetherChat.tsx`**, **`FaceToFace.tsx`**: Accept `activityOutcome` prop and pass it through every `streamChat` call

### 6. Update `FaceToFace.tsx` Direct Fetch Calls
The FaceToFace component calls the chat endpoint directly (not via `streamChat`) for `generate_prompts` and `generate_one_prompt` — these also need `activityOutcome` added to their request bodies.

