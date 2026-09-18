-- Ensure owner check recognizes workspaces.owner_id as well as workspace_members.role = 'owner'
CREATE OR REPLACE FUNCTION public.is_workspace_owner(target_workspace uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspaces
    WHERE id = target_workspace AND owner_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = target_workspace AND user_id = auth.uid() AND role = 'owner'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_member(target_workspace uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspaces
    WHERE id = target_workspace AND owner_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = target_workspace AND user_id = auth.uid()
  );
$$;

-- Allow direct invitations insert for workspace owner
DROP POLICY IF EXISTS invitations_insert_owner ON public.invitations;
CREATE POLICY invitations_insert_owner ON public.invitations FOR INSERT TO authenticated
WITH CHECK (public.is_workspace_owner(workspace_id));

-- Ensure all workspace creators have role = 'owner' in workspace_members
INSERT INTO public.workspace_members (workspace_id, user_id, role)
SELECT id, owner_id, 'owner'
FROM public.workspaces
ON CONFLICT (workspace_id, user_id)
DO UPDATE SET role = 'owner';

