

## Plan: Add slugs to activity URLs

### Problem
Activity URLs use raw UUIDs like `/activity/550e8400-e29b-41d4-a716-...` which are ugly.

### Solution
Add a `slug` text column to the `activities` table, populate it from existing titles, and use slugs in routes instead of UUIDs.

### Changes

**1. Database migration**
- Add `slug` column (unique, not null) to `activities` table
- Populate from existing activity titles (e.g., "Money & Childhood" → `money-and-childhood`)
- Same for `stages` if used in URLs (not currently)

**2. Routes (`App.tsx`)**
- Change `/activity/:id` → `/activity/:slug`
- Change `/conversation/:activityId` → `/conversation/:slug`  
- Change `/lesson/:id` → `/lesson/:slug`

**3. Pages (`Activity.tsx`, `Conversation.tsx`, `Lesson.tsx`)**
- Query activities by `slug` instead of `id`
- Update all `navigate()` calls to use `activity.slug` instead of `activity.id`

**4. Components (`ActivityPath.tsx`, `UpNextCard.tsx`, etc.)**
- Update navigation links to use slug

**5. Conversation/message creation**
- Still use `activity.id` (UUID) internally for foreign keys — slug is only for URLs
- Fetch activity by slug first, then use `activity.id` for DB operations

### Result
URLs like `/activity/money-and-childhood` and `/conversation/money-and-childhood?mode=solo`

