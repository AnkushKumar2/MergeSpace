-- Workspace owners administer people and file structure. Editors may change
-- the contents of existing files, but cannot rename, move, create, or delete
-- them (nor manage membership through a direct REST request).

drop policy if exists files_insert_member on public.files;
drop policy if exists files_delete_member on public.files;
drop policy if exists files_update_member on public.files;

create policy files_insert_owner on public.files
  for insert to authenticated
  with check (public.is_workspace_owner(workspace_id));

create policy files_delete_owner on public.files
  for delete to authenticated
  using (public.is_workspace_owner(workspace_id));

create policy files_update_member on public.files
  for update to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create or replace function public.restrict_editor_file_changes()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if not public.is_workspace_owner(old.workspace_id)
     and (new.workspace_id is distinct from old.workspace_id
       or new.name is distinct from old.name
       or new.language is distinct from old.language) then
    raise exception 'Editors may edit file content only';
  end if;
  return new;
end;
$$;

drop trigger if exists files_restrict_editor_changes on public.files;
create trigger files_restrict_editor_changes
  before update on public.files
  for each row execute function public.restrict_editor_file_changes();
