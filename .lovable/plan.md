

## Plan: Simplify Stage Unlock Logic

**Change in `src/hooks/useActivities.ts`**

In the `useStagesWithActivities` query, replace the current unlock logic (which checks previous stage completion) with a simple rule based on `order_index`:

- Stages with `order_index` 0, 1, 2 (stages 1-3) → always unlocked
- Stages with `order_index` 3, 4 (stages 4-5) → always locked

This is roughly a 5-line change in the stage mapping logic, replacing the existing `isUnlocked` calculation block.

