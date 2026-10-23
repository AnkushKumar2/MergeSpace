-- Workspace chat: messages table, RLS, guards, rate limit, realtime events.

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  edited_at timestamptz
);

create index if not exists messages_workspace_created_idx
  on public.messages (workspace_id, created_at desc);

alter table public.messages enable row level security;
grant select, insert, update, delete on public.messages to authenticated;

drop policy if exists messages_read_member on public.messages;
create policy messages_read_member on public.messages
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists messages_insert_member on public.messages;
create policy messages_insert_member on public.messages
  for insert to authenticated
  with check (public.is_workspace_member(workspace_id) and user_id = auth.uid());

drop policy if exists messages_update_own on public.messages;
create policy messages_update_own on public.messages
  for update to authenticated
  using (user_id = auth.uid() and public.is_workspace_member(workspace_id))
  with check (user_id = auth.uid() and public.is_workspace_member(workspace_id));

drop policy if exists messages_delete_own_or_owner on public.messages;
create policy messages_delete_own_or_owner on public.messages
  for delete to authenticated
  using (user_id = auth.uid() or public.is_workspace_owner(workspace_id));

-- Only the text may change on update; stamp edited_at.
create or replace function public.messages_guard_update()
returns trigger language plpgsql
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if new.workspace_id is distinct from old.workspace_id
     or new.user_id is distinct from old.user_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Only the message text can be edited';
  end if;
  if new.body is distinct from old.body then
    new.edited_at := now();
  end if;
  return new;
end;
$$;
drop trigger if exists messages_guard_update on public.messages;
create trigger messages_guard_update before update on public.messages
  for each row execute function public.messages_guard_update();

-- Rate limit: at most 10 messages per user per workspace per 10 seconds.
create or replace function public.messages_rate_limit()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if (select count(*) from public.messages m
        where m.user_id = new.user_id
          and m.workspace_id = new.workspace_id
          and m.created_at > now() - interval '10 seconds') >= 10 then
    raise exception 'You are sending messages too quickly. Please wait a moment.';
  end if;
  return new;
end;
$$;
drop trigger if exists messages_rate_limit on public.messages;
create trigger messages_rate_limit before insert on public.messages
  for each row execute function public.messages_rate_limit();

-- Realtime: same pattern as notify_workspace_membership_changed.
create or replace function public.notify_chat_message_changed()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  ws uuid;
  evt text;
  payload jsonb;
begin
  if tg_op = 'DELETE' then
    ws := old.workspace_id;
    evt := 'chat_message_deleted';
    payload := jsonb_build_object('id', old.id, 'workspace_id', old.workspace_id);
  else
    ws := new.workspace_id;
    evt := case when tg_op = 'INSERT' then 'chat_message' else 'chat_message_updated' end;
    payload := jsonb_build_object(
      'id', new.id,
      'workspace_id', new.workspace_id,
      'user_id', new.user_id,
      'body', new.body,
      'created_at', new.created_at,
      'edited_at', new.edited_at,
      'name', (select p.name from public.profiles p where p.id = new.user_id),
      'avatar_url', (select p.avatar_url from public.profiles p where p.id = new.user_id)
    );
  end if;
  begin
    perform realtime.publish('workspace:' || ws::text, evt, payload);
  exception when others then
    null; -- never fail the message because realtime is unavailable
  end;
  return coalesce(new, old);
end;
$$;
drop trigger if exists messages_notify on public.messages;
create trigger messages_notify after insert or update or delete on public.messages
  for each row execute function public.notify_chat_message_changed();

-- History with sender names, newest first, paged. Runs with the caller's rights (RLS applies).
create or replace function public.list_workspace_messages(
  target_workspace uuid,
  before_ts timestamptz default null,
  page_size int default 50
)
returns table (
  id uuid, workspace_id uuid, user_id uuid, body text,
  created_at timestamptz, edited_at timestamptz, name text, avatar_url text
)
language sql stable security invoker
set search_path = pg_catalog, public, pg_temp
as $$
  select m.id, m.workspace_id, m.user_id, m.body, m.created_at, m.edited_at, p.name, p.avatar_url
  from public.messages m
  left join public.profiles p on p.id = m.user_id
  where m.workspace_id = target_workspace
    and (before_ts is null or m.created_at < before_ts)
  order by m.created_at desc
  limit least(greatest(page_size, 1), 100)
$$;
grant execute on function public.list_workspace_messages(uuid, timestamptz, int) to authenticated;