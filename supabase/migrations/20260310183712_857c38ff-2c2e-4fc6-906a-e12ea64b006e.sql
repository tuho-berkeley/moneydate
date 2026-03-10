
-- Drop all existing SELECT policies on couples
DROP POLICY IF EXISTS "Anyone authenticated can read couple by invite code" ON public.couples;
DROP POLICY IF EXISTS "Members can read own couple" ON public.couples;

-- Create a single PERMISSIVE SELECT policy that allows any authenticated user to read
CREATE POLICY "Authenticated can read couples"
  ON public.couples FOR SELECT
  TO authenticated
  USING (true);
