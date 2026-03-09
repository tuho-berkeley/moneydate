
-- Add onboarding_completed flag to profiles
ALTER TABLE public.profiles ADD COLUMN onboarding_completed boolean NOT NULL DEFAULT false;

-- Create user_preferences table for onboarding answers
CREATE TABLE public.user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_intent text, -- 'exploring_alone', 'in_relationship', 'preparing_marriage'
  relationship_duration text, -- 'less_1', '1_3', '3_5', '5_plus'
  money_talk_frequency text, -- 'not_really', 'a_little', 'yes_often'
  help_topics text[] DEFAULT '{}', -- array of selected topics
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own preferences"
  ON public.user_preferences FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
