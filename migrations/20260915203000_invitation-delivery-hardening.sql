-- Ensure only the intended recipient sees a personal pending invitation,
-- while workspace members can still manage outgoing invitations.
create index if not exists invitations_pending_recipient_idx
  on public.invitations (lower(email), created_at desc)
  where status = 'pending';

create or replace function public.my_pending_workspace_invitations()
returns setof public.invitations
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.invitations
  where status = 'pending'
    and lower(email) = lower(auth.jwt() ->> 'email')
  order by created_at desc;
$$;

grant execute on function public.my_pending_workspace_invitations() to authenticated;
