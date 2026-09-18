create table public.sample_items (
	id uuid primary key default gen_random_uuid(),
	name text not null,
	description text not null default '',
	status text not null default 'planned' check (status in ('planned', 'in_progress', 'done')),
	created_at timestamptz not null default now()
);

create index sample_items_status_idx on public.sample_items (status);

alter table public.sample_items enable row level security;

grant select on table public.sample_items to authenticated;

create policy sample_items_read_authenticated
on public.sample_items
for select
to authenticated
using (true);

insert into public.sample_items (name, description, status)
values
	('Shared workspace', 'A place for the team to build together.', 'done'),
	('Live preview', 'Render HTML, CSS, and JavaScript changes instantly.', 'in_progress'),
	('Invite collaborators', 'Add teammates to a workspace with editor access.', 'planned');
