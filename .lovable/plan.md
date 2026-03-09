

# Plan: Database Schema & User Authentication for MoneyDate

## Database Schema

We'll create the following tables to support user data, couple linking, activities, plans, conversations, and insights.

### Tables

1. **profiles** — User profile data (linked to auth.users)
   - `id` (uuid, PK, references auth.users)
   - `display_name` (text)
   - `avatar_url` (text, nullable)
   - `couple_id` (uuid, nullable, references couples)
   - `created_at`, `updated_at`

2. **couples** — Linked couple entity
   - `id` (uuid, PK)
   - `invite_code` (text, unique) — for partner linking
   - `partner_since` (timestamptz, nullable)
   - `created_at`

3. **activities** — Guided journey activities (conversations, lessons, plans)
   - `id` (uuid, PK)
   - `title`, `description`, `type` (enum: conversation, lesson, planning)
   - `order_index` (int)
   - `icon` (text)

4. **user_activities** — Per-user activity progress
   - `id` (uuid, PK)
   - `user_id` (uuid, references auth.users)
   - `activity_id` (uuid, references activities)
   - `status` (enum: locked, available, in_progress, completed)
   - `started_at`, `completed_at`

5. **financial_plans** — Couple's financial plans
   - `id` (uuid, PK)
   - `couple_id` (uuid, references couples)
   - `title`, `target_amount`, `current_amount`, `icon`
   - `created_at`, `updated_at`

6. **conversations** — Chat conversations
   - `id` (uuid, PK)
   - `couple_id` (uuid, nullable)
   - `user_id` (uuid) — creator
   - `activity_id` (uuid, nullable)
   - `type` (enum: solo, together, face_to_face)
   - `created_at`

7. **messages** — Chat messages (with realtime)
   - `id` (uuid, PK)
   - `conversation_id` (uuid, references conversations)
   - `sender_id` (uuid, nullable) — null for AI
   - `role` (enum: user, partner, ai)
   - `content` (text)
   - `created_at`

### RLS Policies
- Profiles: users read/update own profile; read partner's profile if in same couple
- Couples: members can read their own couple
- User activities: users manage their own progress
- Financial plans: couple members can CRUD their plans
- Conversations/messages: participants can read/write their own conversations

### Trigger
- Auto-create profile + generate invite code on user signup

## Authentication

- **Auth pages**: Login and Signup pages with email/password
- **Auth context**: `AuthProvider` wrapping the app with `onAuthStateChange` listener
- **Protected routes**: Redirect unauthenticated users to `/login`
- **Partner linking**: Generate invite code on signup; enter partner's code to link accounts
- **Password reset**: Forgot password flow + `/reset-password` page

## UI Changes

- New pages: `/login`, `/signup`, `/reset-password`
- `App.tsx`: Add `AuthProvider`, protect main routes, show auth routes when logged out
- `BottomNav`: Only show when authenticated
- `Profile.tsx`: Show real user data from profiles table
- `Index.tsx`: Show real user name from profile

## File Structure (new/modified)

```
src/
  contexts/AuthContext.tsx        — auth state management
  pages/Login.tsx                 — login form
  pages/Signup.tsx                — signup form  
  pages/ResetPassword.tsx         — password reset
  components/ProtectedRoute.tsx   — route guard
  App.tsx                         — add auth provider + routes
```

## Migration Order
1. Create database tables, enums, triggers, and RLS policies (single migration)
2. Build AuthContext and auth pages
3. Wire up protected routes
4. Connect profile data to UI

