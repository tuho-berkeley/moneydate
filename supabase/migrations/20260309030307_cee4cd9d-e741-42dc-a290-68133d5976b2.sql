
-- Enums
CREATE TYPE public.activity_type AS ENUM ('conversation', 'lesson', 'planning');
CREATE TYPE public.activity_status AS ENUM ('locked', 'available', 'in_progress', 'completed');
CREATE TYPE public.conversation_type AS ENUM ('solo', 'together', 'face_to_face');
CREATE TYPE public.message_role AS ENUM ('user', 'partner', 'ai');

-- Couples table
CREATE TABLE public.couples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_code TEXT NOT NULL UNIQUE DEFAULT substr(md5(random()::text), 1, 8),
  partner_since TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.couples ENABLE ROW LEVEL SECURITY;

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  couple_id UUID REFERENCES public.couples(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Activities table
CREATE TABLE public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  type activity_type NOT NULL,
  order_index INT NOT NULL DEFAULT 0,
  icon TEXT NOT NULL DEFAULT '💬'
);
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

-- User activities
CREATE TABLE public.user_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  status activity_status NOT NULL DEFAULT 'locked',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  UNIQUE(user_id, activity_id)
);
ALTER TABLE public.user_activities ENABLE ROW LEVEL SECURITY;

-- Financial plans
CREATE TABLE public.financial_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  target_amount NUMERIC NOT NULL DEFAULT 0,
  current_amount NUMERIC NOT NULL DEFAULT 0,
  icon TEXT NOT NULL DEFAULT '💰',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.financial_plans ENABLE ROW LEVEL SECURITY;

-- Conversations
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id UUID REFERENCES public.couples(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_id UUID REFERENCES public.activities(id),
  type conversation_type NOT NULL DEFAULT 'solo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- Messages
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  role message_role NOT NULL DEFAULT 'user',
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- Security definer function to get couple_id for a user
CREATE OR REPLACE FUNCTION public.get_couple_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT couple_id FROM public.profiles WHERE id = _user_id
$$;

-- RLS: profiles
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "Users can read partner profile" ON public.profiles FOR SELECT TO authenticated USING (couple_id IS NOT NULL AND couple_id = public.get_couple_id(auth.uid()));

-- RLS: couples
CREATE POLICY "Members can read own couple" ON public.couples FOR SELECT TO authenticated USING (id = public.get_couple_id(auth.uid()));
CREATE POLICY "Members can update own couple" ON public.couples FOR UPDATE TO authenticated USING (id = public.get_couple_id(auth.uid()));

-- RLS: activities (readable by all authenticated)
CREATE POLICY "Authenticated can read activities" ON public.activities FOR SELECT TO authenticated USING (true);

-- RLS: user_activities
CREATE POLICY "Users manage own activities" ON public.user_activities FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- RLS: financial_plans
CREATE POLICY "Couple members manage plans" ON public.financial_plans FOR ALL TO authenticated USING (couple_id = public.get_couple_id(auth.uid())) WITH CHECK (couple_id = public.get_couple_id(auth.uid()));

-- RLS: conversations
CREATE POLICY "Users read own conversations" ON public.conversations FOR SELECT TO authenticated USING (user_id = auth.uid() OR couple_id = public.get_couple_id(auth.uid()));
CREATE POLICY "Users create conversations" ON public.conversations FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- RLS: messages
CREATE POLICY "Users read conversation messages" ON public.messages FOR SELECT TO authenticated USING (
  conversation_id IN (SELECT id FROM public.conversations WHERE user_id = auth.uid() OR couple_id = public.get_couple_id(auth.uid()))
);
CREATE POLICY "Users send messages" ON public.messages FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid());

-- Trigger: auto-create profile and couple on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_couple_id UUID;
BEGIN
  INSERT INTO public.couples DEFAULT VALUES RETURNING id INTO new_couple_id;
  INSERT INTO public.profiles (id, display_name, couple_id)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', ''), new_couple_id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
