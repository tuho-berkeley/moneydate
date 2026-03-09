
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_couple_id UUID;
  resolved_name TEXT;
BEGIN
  resolved_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'display_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'name', ''),
    ''
  );
  INSERT INTO public.couples DEFAULT VALUES RETURNING id INTO new_couple_id;
  INSERT INTO public.profiles (id, display_name, avatar_url, couple_id)
  VALUES (
    NEW.id,
    resolved_name,
    NEW.raw_user_meta_data->>'avatar_url',
    new_couple_id
  );
  RETURN NEW;
END;
$$;
