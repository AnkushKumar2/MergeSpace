create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text not null default '',
  color text not null default 'coral',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'editor' check (role in ('owner', 'editor')),
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  language text not null check (language in ('html', 'css', 'javascript')),
  content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, name)
);

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  role text not null default 'editor' check (role in ('owner', 'editor')),
  invited_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now()
);

create or replace function public.is_workspace_member(target_workspace uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = target_workspace and user_id = auth.uid()
  );
$$;

create or replace function public.is_workspace_owner(target_workspace uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = target_workspace and user_id = auth.uid() and role = 'owner'
  );
$$;

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.files enable row level security;
alter table public.invitations enable row level security;

create policy profiles_read on public.profiles for select to authenticated using (true);
create policy profiles_update_self on public.profiles for all to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy workspaces_read_member on public.workspaces for select to authenticated using (public.is_workspace_member(id));
create policy workspaces_insert_owner on public.workspaces for insert to authenticated with check (owner_id = auth.uid());
create policy workspaces_update_owner on public.workspaces for update to authenticated using (public.is_workspace_owner(id));
create policy workspaces_delete_owner on public.workspaces for delete to authenticated using (public.is_workspace_owner(id));

create policy members_read_member on public.workspace_members for select to authenticated using (public.is_workspace_member(workspace_id));
create policy members_insert_owner on public.workspace_members for insert to authenticated with check (public.is_workspace_owner(workspace_id));
create policy members_update_owner on public.workspace_members for update to authenticated using (public.is_workspace_owner(workspace_id));
create policy members_delete_owner on public.workspace_members for delete to authenticated using (public.is_workspace_owner(workspace_id));

create policy files_read_member on public.files for select to authenticated using (public.is_workspace_member(workspace_id));
create policy files_insert_member on public.files for insert to authenticated with check (public.is_workspace_member(workspace_id));
create policy files_update_member on public.files for update to authenticated using (public.is_workspace_member(workspace_id));
create policy files_delete_member on public.files for delete to authenticated using (public.is_workspace_member(workspace_id));

create policy invitations_read_member on public.invitations for select to authenticated using (public.is_workspace_member(workspace_id));
create policy invitations_insert_owner on public.invitations for insert to authenticated with check (public.is_workspace_owner(workspace_id) and invited_by = auth.uid());
create policy invitations_update_owner on public.invitations for update to authenticated using (public.is_workspace_owner(workspace_id));

create or replace function public.create_owner_membership()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role) values (new.id, new.owner_id, 'owner');
  insert into public.files (workspace_id, name, language, content) values
    (new.id, 'index.html', 'html', '<main class="welcome">\n  <h1>Build together.</h1>\n</main>'),
    (new.id, 'styles.css', 'css', '.welcome { font-family: sans-serif; }'),
    (new.id, 'app.js', 'javascript', 'console.log("Hello, MergeSpace");');
  return new;
end;
$$;

 drop trigger if exists workspace_owner_setup on public.workspaces;
 create trigger workspace_owner_setup after insert on public.workspaces for each row execute function public.create_owner_membership();
