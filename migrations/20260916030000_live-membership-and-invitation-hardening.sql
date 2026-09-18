create or replace function public.notify_workspace_membership_changed()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  perform realtime.publish('workspace:' || coalesce(new.workspace_id, old.workspace_id)::text, 'workspace_members_changed', jsonb_build_object('workspace_id', coalesce(new.workspace_id, old.workspace_id)));
  return coalesce(new, old);
end;
$$;
drop trigger if exists workspace_members_membership_changed on public.workspace_members;
create trigger workspace_members_membership_changed after insert or update of role or delete on public.workspace_members for each row execute function public.notify_workspace_membership_changed();
alter function public.is_workspace_owner(uuid) set search_path = pg_catalog, public, pg_temp;
alter function public.is_workspace_member(uuid) set search_path = pg_catalog, public, pg_temp;
alter function public.send_workspace_invitation(uuid, text, text, uuid) set search_path = pg_catalog, public, pg_temp;
