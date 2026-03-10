
-- Drop the restrictive policies
DROP POLICY IF EXISTS "Anyone authenticated can read couple by invite code" ON public.couples;
DROP POLICY IF EXISTS "Members can read own couple" ON public.couples;

-- Recreate as PERMISSIVE (default) so ANY one passing is sufficient
CREATE POLICY "Anyone authenticated can read couple by invite code"
  ON public.couples FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Members can read own couple"
  ON public.couples FOR SELECT
  TO authenticated
  USING (id = get_couple_id(auth.uid()));
