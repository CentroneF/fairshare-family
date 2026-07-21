-- Run in Supabase SQL Editor.
-- Replace both placeholders. This removes only a non-creator parent membership;
-- the family, children, and creator membership remain intact.

delete from public.family_members as member
using auth.users as user_account,
      public.families as family
where member.user_id = user_account.id
  and member.family_id = family.id
  and user_account.email = 'second-parent@example.com'
  and family.name = 'Your Family Name'
  and member.user_id <> family.created_by
returning member.id, member.family_id, member.user_id;
