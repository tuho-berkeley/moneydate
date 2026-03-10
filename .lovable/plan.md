

## Plan: Full Partner Connection Flow

### Current State
- `couples` table exists with `invite_code` (auto-generated 8-char hash)
- `profiles` has `couple_id` linking users to a couple
- `handle_new_user` trigger creates a new couple for every new user
- Onboarding `PartnerConnectionStep` has invite/join UI but join logic updates `couple_id` to the partner's couple — this works
- TogetherChat already queries partner profile via `couple_id` and uses realtime subscriptions
- RLS on `couples` only allows SELECT/UPDATE for members, not INSERT (new couples created by trigger)

### What Needs to Change

**1. Profile Screen — Show Partner Name + Share Button**

In `Profile.tsx`:
- Fetch partner profile (query profiles where `couple_id` matches and `id != user.id`)
- Display partner name + avatar initial next to user's profile card
- Add a **Share** button next to the invite code that uses `navigator.share()` (with fallback to clipboard). The share message will include a deeplink: `https://moneydate.lovable.app/onboarding?code=XXXXXX`
- If no partner connected yet, show a "Connect Partner" button that navigates to a partner connection dialog

**2. Deeplink Support in Onboarding**

In `Onboarding.tsx`:
- Read `?code=XXXXXX` from URL search params on mount
- If a code is present and user reaches `PartnerConnectionStep`, auto-populate the join code and switch to "join" mode
- Pass the code down as a prop to `PartnerConnectionStep`

In `PartnerConnectionStep.tsx`:
- Accept optional `initialCode` prop
- If provided, auto-set mode to "join" and pre-fill `joinCode`

**3. Profile Screen — Partner Connection Section**

Add a new section in Profile for partner management:
- If connected: show partner's display name and avatar
- If not connected: show invite/join options (reuse same UI pattern as onboarding step, but in a dialog/sheet)

**4. Together Chat — Realtime Partner Messages**

The TogetherChat already has:
- Realtime subscription on messages table for the conversation
- Partner profile query
- Turn-based logic with `[ASKING:name]` tags

What needs fixing/enhancing:
- Enable realtime on the `messages` table (migration: `ALTER PUBLICATION supabase_realtime ADD TABLE public.messages`)
- Verify RLS allows partner to read/write messages in shared conversations (current RLS checks `conversation.user_id = auth.uid()` for insert — partner can't insert). Need to update messages INSERT RLS to also allow couple members.
- Update conversations INSERT RLS to allow couple members to create together conversations

### Database Changes (Migration)

```sql
-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- Allow couple partners to insert messages into shared (together) conversations
CREATE POLICY "Partners send messages in couple conversations"
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (
  conversation_id IN (
    SELECT id FROM conversations
    WHERE couple_id = get_couple_id(auth.uid())
    AND type = 'together'
  )
  AND sender_id = auth.uid()
);
```

### File Changes Summary

| File | Change |
|------|--------|
| `src/pages/Profile.tsx` | Add partner name display, share button with `navigator.share()`, connect partner dialog |
| `src/pages/Onboarding.tsx` | Read `?code=` from URL, pass to PartnerConnectionStep |
| `src/components/onboarding/PartnerConnectionStep.tsx` | Accept `initialCode` prop, auto-set join mode |
| Migration | Enable realtime on messages, add partner INSERT policy on messages |

### Share Link Format

Share message: *"Join me on MoneyDate! Use my invite code: XXXXXX or tap here: https://moneydate.lovable.app/onboarding?code=XXXXXX"*

The share button will use the Web Share API with clipboard fallback.

