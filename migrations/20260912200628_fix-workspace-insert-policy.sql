drop policy if exists workspaces_insert_owner on public.workspaces;

grant insert on table public.workspaces to authenticated;

create policy workspaces_insert_owner
on public.workspaces
for insert
to authenticated
with check (owner_id = nullif(auth.jwt() ->> 'sub', '')::uuid);
