import { insforge } from "./insforge"

export const MAX_MESSAGE_LENGTH = 2000

function client() {
  if (!insforge) throw new Error("InsForge is not configured.")
  return insforge
}

function unwrap(result) {
  if (result.error) throw result.error
  return result.data
}

function cleanBody(body) {
  const text = String(body ?? "").trim()
  if (!text) throw new Error("Write a message first.")
  if (text.length > MAX_MESSAGE_LENGTH) throw new Error(`Messages are limited to ${MAX_MESSAGE_LENGTH} characters.`)
  return text
}

// Returns messages oldest -> newest. Pass `before` (an ISO timestamp) to load older ones.
export async function listMessages(workspaceId, { before = null, limit = 50 } = {}) {
  const rows = unwrap(await client().database.rpc("list_workspace_messages", {
    target_workspace: workspaceId,
    before_ts: before,
    page_size: limit,
  })) || []
  return rows.slice().reverse()
}

export async function sendMessage({ workspaceId, userId, body }) {
  return unwrap(await client().database.from("messages")
    .insert([{ workspace_id: workspaceId, user_id: userId, body: cleanBody(body) }])
    .select().single())
}

export async function editMessage(id, body) {
  return unwrap(await client().database.from("messages")
    .update({ body: cleanBody(body) }).eq("id", id).select().single())
}

export async function deleteMessage(id) {
  return unwrap(await client().database.from("messages").delete().eq("id", id))
}

// Listens for chat events on the workspace channel. It does NOT join or leave the channel:
// the live WorkspaceEditor already calls subscribeToWorkspace() for the whole time the
// workspace is open, and that is what keeps the channel joined.
export function onChatEvents(workspaceId, handlers = {}) {
  const realtime = client().realtime
  const channel = `workspace:${workspaceId}`
  const wrap = (callback) => (message) => {
    if (message?.meta?.channel && message.meta.channel !== channel) return
    callback?.(message?.payload || message?.data || message)
  }
  const added = wrap(handlers.onMessage)
  const updated = wrap(handlers.onUpdate)
  const removed = wrap(handlers.onDelete)
  realtime.on("chat_message", added)
  realtime.on("chat_message_updated", updated)
  realtime.on("chat_message_deleted", removed)
  return () => {
    realtime.off("chat_message", added)
    realtime.off("chat_message_updated", updated)
    realtime.off("chat_message_deleted", removed)
  }
}