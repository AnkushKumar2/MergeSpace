-- Return the inviter identity to the recipient without exposing arbitrary auth rows.
drop function if exists public.my_pending_workspace_invitations();

create function public.my_pending_workspace_invitations()
returns table (
  id uuid,
  workspace_id uuid,
  email text,
  role text,
  invited_by uuid,
  status text,
  created_at timestamptz,
  inviter_email text,
  workspace_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select invitation.id,
    invitation.workspace_id,
    invitation.email,
    invitation.role,
    invitation.invited_by,
    invitation.status,
    invitation.created_at,
    (select account.email from auth.users account where account.id = invitation.invited_by),
    workspace.name
  from public.invitations invitation
  join public.workspaces workspace on workspace.id = invitation.workspace_id
  where invitation.status = 'pending'
    and lower(invitation.email) = lower(coalesce(
      auth.jwt() ->> 'email',
      (select account.email from auth.users account where account.id = auth.uid())
    ))
  order by invitation.created_at desc;
$$;

grant execute on function public.my_pending_workspace_invitations() to authenticated;