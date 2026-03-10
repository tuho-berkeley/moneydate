
ALTER TABLE public.activities ADD COLUMN slug text;

UPDATE public.activities SET slug = CASE id
  WHEN 'a1111111-1111-1111-1111-111111111111' THEN 'your-money-story'
  WHEN 'a1111111-1111-1111-1111-111111111112' THEN 'right-ways-to-talk-about-money'
  WHEN 'a1111111-1111-1111-1111-111111111113' THEN 'spender-or-saver'
  WHEN 'a1111111-1111-1111-1111-111111111114' THEN 'financial-security-meaning'
  WHEN 'a2222222-2222-2222-2222-222222222221' THEN 'fun-money'
  WHEN 'a2222222-2222-2222-2222-222222222222' THEN 'how-couples-structure-finances'
  WHEN 'a2222222-2222-2222-2222-222222222223' THEN 'spending-boundaries'
  WHEN 'a2222222-2222-2222-2222-222222222224' THEN 'first-money-agreement'
  WHEN 'a3333333-3333-3333-3333-333333333331' THEN 'talking-about-debt'
  WHEN 'a3333333-3333-3333-3333-333333333332' THEN 'financial-snapshot'
  WHEN 'a3333333-3333-3333-3333-333333333333' THEN 'big-3-financial-foundations'
  WHEN 'a3333333-3333-3333-3333-333333333334' THEN 'emergency-fund-plan'
  WHEN 'a4444444-4444-4444-4444-444444444441' THEN 'our-life-dreams'
  WHEN 'a4444444-4444-4444-4444-444444444442' THEN 'top-3-financial-priorities'
  WHEN 'a4444444-4444-4444-4444-444444444443' THEN 'how-couples-set-financial-goals'
  WHEN 'a4444444-4444-4444-4444-444444444444' THEN 'shared-goals-plan'
  WHEN 'a5555555-5555-5555-5555-555555555551' THEN 'manage-money-together'
  WHEN 'a5555555-5555-5555-5555-555555555552' THEN 'first-couple-budget'
  WHEN 'a5555555-5555-5555-5555-555555555553' THEN 'handling-financial-conflict'
  WHEN 'a5555555-5555-5555-5555-555555555554' THEN 'our-money-vision'
END;

ALTER TABLE public.activities ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX activities_slug_key ON public.activities (slug);
