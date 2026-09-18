import { createClient } from "@insforge/sdk"

const baseUrl = import.meta.env.VITE_INSFORGE_BASE_URL || import.meta.env.NEXT_PUBLIC_INSFORGE_URL
const anonKey = import.meta.env.VITE_INSFORGE_ANON_KEY || import.meta.env.NEXT_PUBLIC_INSFORGE_ANON_KEY

export const insforgeConfigured = Boolean(baseUrl && anonKey)
export const insforge = insforgeConfigured ? createClient({ baseUrl, anonKey }) : null

function requireClient() {
  if (!insforge) {
    throw new Error("InsForge is not configured. Add VITE_INSFORGE_BASE_URL and VITE_INSFORGE_ANON_KEY to .env.local.")
  }
  return insforge
}

function unwrap(result) {
  if (result.error) throw result.error
  return result.data
}

export async function getCurrentUser() {
  const client = requireClient()
  const result = await client.auth.getCurrentUser()
  if (result.error) {
    const message = result.error.message || ""
    if (result.error.status === 401 || message.toLowerCase().includes("refresh token")) return null
    throw result.error
  }
  return result.data?.user || null
}

export async function signUp({ name, email, password }) {
  const client = requireClient()
  return unwrap(await client.auth.signUp({ name, email, password, redirectTo: window.location.origin }))
}

export async function signIn({ email, password }) {
  const client = requireClient()
  return unwrap(await client.auth.signInWithPassword({ email, password }))
}

export async function signInWithProvider(provider) {
  const client = requireClient()
  return unwrap(await client.auth.signInWithOAuth(provider, {
    redirectTo: window.location.origin,
    additionalParams: provider === "google" ? { prompt: "select_account" } : undefined,
  }))
}

export async function requestEmailCode(email) {
  const client = requireClient()
  return unwrap(await client.auth.signInWithOtp({ email }))
}

export async function verifyEmailCode(email, code) {
  const client = requireClient()
  // InsForge expects `otp`; passing `code` leaves the value empty and produces
  // the misleading "OTP required" response.
  return unwrap(await client.auth.verifyOtp({ email, otp: code }))
}

export async function signOut() {
  const client = requireClient()
  const result = await client.auth.signOut()
  if (result.error) throw result.error
}

export async function updateProfile(profile) {
  const client = requireClient()
  const { id, name, color } = profile
  if (!id) throw new Error("Your profile could not be identified. Please sign in again.")
  const changes = { name, avatar_url: color, updated_at: new Date().toISOString() }
  // OAuth users created before the profile trigger existed do not yet have a
  // public.profiles row. `maybeSingle` makes that normal case explicit.
  const existing = unwrap(await client.database.from("profiles").select("id").eq("id", id).maybeSingle())
  if (existing) return unwrap(await client.database.from("profiles").update(changes).eq("id", id).select().single())
  return unwrap(await client.database.from("profiles").insert([{ id, ...changes }]).select().single())
}

export async function listWorkspaces() {
  const client = requireClient()
  return unwrap(await client.database.from("workspaces").select().order("created_at", { ascending: false })) || []
}

export async function createWorkspace({ name, description, color }) {
  const client = requireClient()
  const created = unwrap(await client.database.rpc("create_workspace", {
    workspace_name: name,
    workspace_description: description,
    workspace_color: color,
  }))
  return Array.isArray(created) ? created[0] : created
}

export async function deleteWorkspace(workspaceId) {
  const client = requireClient()
  return unwrap(await client.database.from("workspaces").delete().eq("id", workspaceId))
}

export async function updateWorkspace(workspaceId, changes) {
  const client = requireClient()
  return unwrap(await client.database.from("workspaces").update({ ...changes, updated_at: new Date().toISOString() }).eq("id", workspaceId).select().single())
}

export async function listFiles(workspaceId) {
  const client = requireClient()
  return unwrap(await client.database.from("files").select().eq("workspace_id", workspaceId).order("created_at", { ascending: true })) || []
}

export async function saveFile(file) {
  const client = requireClient()
  return unwrap(await client.database.from("files").update({ name: file.name, language: file.language, content: file.content, updated_at: new Date().toISOString() }).eq("id", file.id).select().single())
}

export async function createFile(file) {
  const client = requireClient()
  return unwrap(await client.database.from("files").insert([file]).select().single())
}

export async function deleteFile(fileId) {
  const client = requireClient()
  return unwrap(await client.database.from("files").delete().eq("id", fileId))
}

export async function listMembers(workspaceId) {
  const client = requireClient()
  const memberships = unwrap(await client.database.from("workspace_members").select().eq("workspace_id", workspaceId).order("created_at", { ascending: true })) || []
  const userIds = memberships.map((member) => member.user_id)
  if (!userIds.length) return []
  const profiles = unwrap(await client.database.from("profiles").select("id, name, avatar_url").in("id", userIds)) || []
  return memberships.map((member) => ({ ...member, profile: profiles.find((profile) => profile.id === member.user_id) }))
}

export async function inviteMember({ workspaceId, email, role, invitedBy }) {
  const client = requireClient()
  const recipientEmail = email.trim().toLowerCase()
  if (!recipientEmail) throw new Error("Enter the collaborator's email address.")
  const result = unwrap(await client.database.rpc("send_workspace_invitation", {
    p_workspace_id: workspaceId,
    p_email: recipientEmail,
    p_role: role || "editor",
    p_invited_by: invitedBy
  }))
  // Send a magic-link / OTP to the invitee so they can log in and accept.
  // Ignore errors here — the invitation row is already created, and the user
  // can still find it if they log in with the same email.
  const invitation = Array.isArray(result) ? result[0] : result
  if (!invitation) throw new Error("The invitation could not be created. Please try again.")

  // Send a magic-link / OTP to the invitee if available
  await client.auth.signInWithOtp({ email: recipientEmail }).catch(() => undefined)
  return invitation
}

export async function listInvitations(workspaceId) {
  const client = requireClient()
  return unwrap(await client.database.from("invitations").select().eq("workspace_id", workspaceId).order("created_at", { ascending: false })) || []
}

export async function listMyInvitations() {
  const client = requireClient()
  return unwrap(await client.database.rpc("my_pending_workspace_invitations")) || []
}

export async function acceptInvitation(invitationId) {
  const client = requireClient()
  return unwrap(await client.database.rpc("accept_workspace_invitation", { target_invitation: invitationId }))
}

export async function declineInvitation(invitationId) {
  const client = requireClient()
  return unwrap(await client.database.rpc("decline_workspace_invitation", { target_invitation: invitationId }))
}

export async function updateMemberRole(memberId, role) {
  const client = requireClient()
  return unwrap(await client.database.from("workspace_members").update({ role }).eq("id", memberId).select().single())
}

export async function removeMember(memberId) {
  const client = requireClient()
  return unwrap(await client.database.from("workspace_members").delete().eq("id", memberId))
}

export async function subscribeToWorkspace(workspaceId, handlers = {}) {
  const client = requireClient()
  await client.realtime.connect()
  const channel = `workspace:${workspaceId}`
  const subscription = await client.realtime.subscribe(channel)
  if (!subscription.ok) throw new Error(subscription.error?.message || "Unable to join workspace room")
  handlers.onPresenceSnapshot?.(subscription.presence?.members || [])
  const scoped = (callback, unwrapPayload = false) => (message) => {
    if (message?.meta?.channel === channel || !message?.meta?.channel) callback(unwrapPayload ? (message?.payload || message?.data || message) : message)
  }
  const handleFileChange = scoped(handlers.onFileChange, true)
  const handleFileCreated = scoped(handlers.onFileCreated, true)
  const handleFileDeleted = scoped(handlers.onFileDeleted, true)
  const handleCursorChange = scoped(handlers.onCursorChange, true)
  const handlePresence = scoped(handlers.onPresence, true)
  const handleJoin = scoped(handlers.onPresenceJoin)
  const handleLeave = scoped(handlers.onPresenceLeave)
  const handleFileLock = scoped(handlers.onFileLock, true)
  const handleFileUnlock = scoped(handlers.onFileUnlock, true)
  if (handlers.onFileChange) client.realtime.on("file_changed", handleFileChange)
  if (handlers.onFileCreated) client.realtime.on("file_created", handleFileCreated)
  if (handlers.onFileDeleted) client.realtime.on("file_deleted", handleFileDeleted)
  if (handlers.onCursorChange) client.realtime.on("cursor_changed", handleCursorChange)
  if (handlers.onPresence) client.realtime.on("presence", handlePresence)
  if (handlers.onPresenceJoin) client.realtime.on("presence:join", handleJoin)
  if (handlers.onPresenceLeave) client.realtime.on("presence:leave", handleLeave)
  if (handlers.onFileLock) client.realtime.on("file_locked", handleFileLock)
  if (handlers.onFileUnlock) client.realtime.on("file_unlocked", handleFileUnlock)
  return () => {
    if (handlers.onFileChange) client.realtime.off("file_changed", handleFileChange)
    if (handlers.onFileCreated) client.realtime.off("file_created", handleFileCreated)
    if (handlers.onFileDeleted) client.realtime.off("file_deleted", handleFileDeleted)
    if (handlers.onCursorChange) client.realtime.off("cursor_changed", handleCursorChange)
    if (handlers.onPresence) client.realtime.off("presence", handlePresence)
    if (handlers.onPresenceJoin) client.realtime.off("presence:join", handleJoin)
    if (handlers.onPresenceLeave) client.realtime.off("presence:leave", handleLeave)
    if (handlers.onFileLock) client.realtime.off("file_locked", handleFileLock)
    if (handlers.onFileUnlock) client.realtime.off("file_unlocked", handleFileUnlock)
    client.realtime.unsubscribe(channel)
  }
}

export async function publishFileChange(workspaceId, file) {
  const client = requireClient()
  await client.realtime.publish(`workspace:${workspaceId}`, "file_changed", file)
}

export async function publishFileCreated(workspaceId, file) {
  const client = requireClient()
  await client.realtime.publish(`workspace:${workspaceId}`, "file_created", file)
}

export async function publishFileDeleted(workspaceId, fileId) {
  const client = requireClient()
  await client.realtime.publish(`workspace:${workspaceId}`, "file_deleted", { id: fileId })
}

export async function publishCursorChange(workspaceId, cursor) {
  const client = requireClient()
  await client.realtime.publish(`workspace:${workspaceId}`, "cursor_changed", cursor)
}

export async function publishFileLock(workspaceId, lock) {
  const client = requireClient()
  await client.realtime.publish(`workspace:${workspaceId}`, "file_locked", lock)
}

export async function publishFileUnlock(workspaceId, lock) {
  const client = requireClient()
  await client.realtime.publish(`workspace:${workspaceId}`, "file_unlocked", lock)
}

export async function publishPresence(workspaceId, user) {
  const client = requireClient()
  await client.realtime.publish(`workspace:${workspaceId}`, "presence", user)
}
