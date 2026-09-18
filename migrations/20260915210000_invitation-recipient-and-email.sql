-- Keep recipient invitations independent from the inviter's workspace visibility.
create or replace function public.my_pending_workspace_invitations()
returns setof public.invitations
language sql
stable
security definer
set search_path = public
as $$
  select invitation.*
  from public.invitations invitation
  where invitation.status = 'pending'
    and lower(invitation.email) = lower(coalesce(
      auth.jwt() ->> 'email',
      (select email from auth.users where id = auth.uid())
    ))
  order by invitation.created_at desc;
$$;

grant execute on function public.my_pending_workspace_invitations() to authenticated;

create or replace function public.accept_workspace_invitation(target_invitation uuid)
returns public.workspace_members
language plpgsql
security definer
set search_path = public
as $$
declare
  invitation public.invitations;
  membership public.workspace_members;
  recipient_email text := lower(coalesce(
    auth.jwt() ->> 'email',
    (select email from auth.users where id = auth.uid())
  ));
begin
  select * into invitation
  from public.invitations
  where id = target_invitation
    and status = 'pending'
    and lower(email) = recipient_email
  for update;

  if invitation.id is null then
    raise exception 'Invitation not found or it does not belong to this account';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (invitation.workspace_id, auth.uid(), invitation.role)
  on conflict (workspace_id, user_id) do update set role = excluded.role
  returning * into membership;

  update public.invitations set status = 'accepted' where id = invitation.id;
  return membership;
end;
$$;

grant execute on function public.accept_workspace_invitation(uuid) to authenticated;