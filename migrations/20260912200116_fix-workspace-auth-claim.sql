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
	authenticated_user uuid;
begin
	authenticated_user := nullif(auth.jwt() ->> 'sub', '')::uuid;
	if authenticated_user is null then
		raise exception 'You must be signed in to create a workspace';
	end if;

	insert into public.workspaces (name, description, color, owner_id)
	values (workspace_name, workspace_description, workspace_color, authenticated_user)
	returning * into created_workspace;

	return created_workspace;
end;
$$;
