create or replace function public.create_workspace(
	workspace_name text,
	workspace_description text default '',
	workspace_color text default 'coral'
)
returns public.workspaces
language plpgsql
security definer
set search_path = public
as $$
declare
	created_workspace public.workspaces;
begin
	if auth.uid() is null then
		raise exception 'You must be signed in to create a workspace';
	end if;

	insert into public.workspaces (name, description, color, owner_id)
	values (workspace_name, workspace_description, workspace_color, auth.uid())
	returning * into created_workspace;

	return created_workspace;
end;
$$;

grant execute on function public.create_workspace(text, text, text) to authenticated;
