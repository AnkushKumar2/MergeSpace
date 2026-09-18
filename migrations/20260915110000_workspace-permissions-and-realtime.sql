-- Owner-only people management, invitation responses, and the live workspace channel.
create or replace function public.decline_workspace_invitation(target_invitation uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.invitations
  set status = 'declined'
  where id = target_invitation
    and status = 'pending'
    and lower(email) = lower(auth.jwt() ->> 'email');
  if not found then raise exception 'Invitation not found or it does not belong to this account'; end if;
end;
$$;
grant execute on function public.decline_workspace_invitation(uuid) to authenticated;

-- Editors cannot add, remove, promote, or otherwise manage people.
drop policy if exists members_insert_owner on public.workspace_members;
drop policy if exists members_update_owner on public.workspace_members;
drop policy if exists members_delete_owner on public.workspace_members;
create policy members_insert_owner on public.workspace_members for insert to authenticated
  with check (public.is_workspace_owner(workspace_id));
create policy members_update_owner on public.workspace_members for update to authenticated
  using (public.is_workspace_owner(workspace_id)) with check (public.is_workspace_owner(workspace_id));
create policy members_delete_owner on public.workspace_members for delete to authenticated
  using (public.is_workspace_owner(workspace_id));

insert into realtime.channels (pattern, description, enabled)
values ('workspace:%', 'Live MergeSpace editing and presence', true)
on conflict (pattern) do update set enabled = true, description = excluded.description;

alter table realtime.channels enable row level security;
alter table realtime.messages enable row level security;
drop policy if exists workspace_members_subscribe on realtime.channels;
create policy workspace_members_subscribe on realtime.channels for select to authenticated using (
  pattern = 'workspace:%' and public.is_workspace_member(nullif(split_part(realtime.channel_name(), ':', 2), '')::uuid)
);
drop policy if exists workspace_members_publish on realtime.messages;
create policy workspace_members_publish on realtime.messages for insert to authenticated with check (
  channel_name like 'workspace:%' and public.is_workspace_member(nullif(split_part(channel_name, ':', 2), '')::uuid)
);
