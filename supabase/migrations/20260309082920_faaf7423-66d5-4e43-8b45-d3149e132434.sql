
-- Remove any duplicate user_activities (keep the latest one per user_id + activity_id)
DELETE FROM public.user_activities a
USING public.user_activities b
WHERE a.user_id = b.user_id
  AND a.activity_id = b.activity_id
  AND a.id < b.id;

-- Add unique constraint on (user_id, activity_id)
ALTER TABLE public.user_activities
ADD CONSTRAINT user_activities_user_activity_unique UNIQUE (user_id, activity_id);
