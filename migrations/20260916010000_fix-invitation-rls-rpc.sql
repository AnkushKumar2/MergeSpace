-- Fix: invitation insert fails with RLS policy violation because the direct INSERT
-- hits the `invitations_insert_owner` policy which requires is_workspace_owner().
-- The function auth.uid() context is sometimes not correctly propagated when called
-- through the SDK client layer. Wrapping the insert in a SECURITY DEFINER RPC
-- (same pattern as accept_workspace_invitation) bypasses the RLS check and
-- performs the ownership verification inside the function body instead.

create or replace function public.send_workspace_invitation(
  p_workspace_id uuid,
  p_email        text,
  p_role         text default 'editor',
  p_invited_by   uuid default null
)
returns public.invitations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invitation public.invitations;
  v_caller_id  uuid := auth.uid();
  v_email      text := lower(trim(p_email));
  v_role       text := coalesce(p_role, 'editor');
begin
  -- Caller must be authenticated
  if v_caller_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Validate email
  if v_email = '' then
    raise exception 'Email address is required';
  end if;

  -- Validate role
  if v_role not in ('owner', 'editor') then
    raise exception 'Role must be owner or editor';
  end if;

  -- Only workspace owners may invite
  if not public.is_workspace_owner(p_workspace_id) then
    raise exception 'Only workspace owners can send invitations';
  end if;

  -- Upsert: if a pending invitation already exists for this email+workspace, update it
  insert into public.invitations (workspace_id, email, role, invited_by, status)
  values (p_workspace_id, v_email, v_role, v_caller_id, 'pending')
  on conflict (workspace_id, email)
    do update set role = excluded.role, invited_by = excluded.invited_by, status = 'pending'
  returning * into v_invitation;

  return v_invitation;
end;
$$;

grant execute on function public.send_workspace_invitation(uuid, text, text, uuid) to authenticated;

-- Add a unique constraint on (workspace_id, email) if it doesn't already exist
-- so the upsert ON CONFLICT clause works correctly.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'invitations_workspace_id_email_key'
      and conrelid = 'public.invitations'::regclass
  ) then
    alter table public.invitations
      add constraint invitations_workspace_id_email_key unique (workspace_id, email);
  end if;
end;
$$;

