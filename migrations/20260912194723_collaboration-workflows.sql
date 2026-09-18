create or replace function public.accept_workspace_invitation(target_invitation uuid)
returns public.workspace_members
language plpgsql
security definer
set search_path = public
as $$
declare
	invitation public.invitations;
	membership public.workspace_members;
begin
	select * into invitation
	from public.invitations
	where id = target_invitation
		and status = 'pending'
		and lower(email) = lower(auth.jwt() ->> 'email')
	for update;

	if invitation.id is null then
		raise exception 'Invitation not found or it does not belong to this account';
	end if;

	insert into public.workspace_members (workspace_id, user_id, role)
	values (invitation.workspace_id, auth.uid(), invitation.role)
	on conflict (workspace_id, user_id) do update set role = excluded.role
	returning * into membership;

	update public.invitations
	set status = 'accepted'
	where id = invitation.id;

	return membership;
end;
$$;

grant execute on function public.accept_workspace_invitation(uuid) to authenticated;

create policy invitations_read_invitee
on public.invitations
for select
to authenticated
using (lower(email) = lower(auth.jwt() ->> 'email'));
