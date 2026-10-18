import { useCallback, useEffect, useRef, useState } from "react"
import { deleteMessage, editMessage, listMessages, onChatEvents, sendMessage } from "../lib/chatApi"

export function useWorkspaceChat({ workspaceId, currentUser, isOpen }) {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [hasMore, setHasMore] = useState(false)
  const [unread, setUnread] = useState(0)
  const messagesRef = useRef(messages)
  const userRef = useRef(currentUser)
  const openRef = useRef(isOpen)
  const workspaceRef = useRef(workspaceId)
  messagesRef.current = messages
  userRef.current = currentUser
  openRef.current = isOpen
  workspaceRef.current = workspaceId

  const merge = useCallback((incoming) => {
    setMessages((previous) => {
      const byId = new Map(previous.map((message) => [message.id, message]))
      for (const message of incoming || []) {
        if (message?.id) byId.set(message.id, { ...byId.get(message.id), ...message })
      }
      return [...byId.values()].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    })
  }, [])

  const loadLatest = useCallback(async (id) => {
    if (!id) return
    try {
      const result = await listMessages(id)
      if (workspaceRef.current !== id) return
      merge(result)
      if (messagesRef.current.length === 0) setHasMore(result.length === 50)
    } catch (cause) {
      if (workspaceRef.current === id) setError(cause?.message || String(cause))
    }
  }, [merge])

  useEffect(() => {
    setMessages([])
    setLoading(Boolean(workspaceId))
    setError(null)
    setHasMore(false)
    setUnread(0)
    if (!workspaceId) return undefined
    let active = true
    const receive = (message) => {
      if (!message?.id) return
      const alreadyKnown = messagesRef.current.some((item) => item.id === message.id)
      const temp = messagesRef.current.find((item) => item.pending && item.user_id === message.user_id && item.body === message.body)
      merge([{ ...message, name: message.name || (message.user_id === userRef.current?.id ? userRef.current.name : undefined) }])
      if (temp) setMessages((items) => items.filter((item) => item.id !== temp.id))
      if (!alreadyKnown && message.user_id !== userRef.current?.id && (!openRef.current || document.hidden)) setUnread((n) => n + 1)
    }
    const unsubscribe = onChatEvents(workspaceId, {
      onMessage: receive,
      onUpdate: (message) => merge([message]),
      onDelete: (message) => setMessages((items) => items.filter((item) => item.id !== (message?.id || message))),
    })
    listMessages(workspaceId).then((result) => {
      if (!active) return
      merge(result)
      setHasMore(result.length === 50)
    }).catch((cause) => { if (active) setError(cause?.message || String(cause)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false; unsubscribe?.() }
  }, [workspaceId, merge])

  useEffect(() => { if (isOpen) setUnread(0) }, [isOpen])
  useEffect(() => {
    if (!workspaceId) return undefined
    const onFocus = () => loadLatest(workspaceId)
    window.addEventListener("focus", onFocus)
    return () => window.removeEventListener("focus", onFocus)
  }, [workspaceId, loadLatest])

  const send = useCallback(async (body) => {
    const user = userRef.current
    const temp = { id: `tmp-${Math.random().toString(36).slice(2)}`, pending: true, user_id: user?.id, name: user?.name, body, created_at: new Date().toISOString() }
    setError(null)
    merge([temp])
    try {
      const saved = await sendMessage({ workspaceId: workspaceRef.current, userId: user?.id, body })
      setMessages((items) => {
        const eventAlreadyAdded = items.some((item) => item.id === saved.id)
        return items.filter((item) => item.id !== temp.id).map((item) => item.id === saved.id ? { ...item, ...saved, name: user?.name } : item)
          .concat(eventAlreadyAdded ? [] : [{ ...saved, name: user?.name }])
          .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      })
      return saved
    } catch (cause) {
      setMessages((items) => items.map((item) => item.id === temp.id ? { ...item, failed: true, errorMessage: cause?.message || String(cause) } : item))
      setError(cause?.message || String(cause))
      return null
    }
  }, [merge])

  const retry = useCallback(async (tempId) => {
    const failed = messagesRef.current.find((item) => item.id === tempId && item.failed)
    if (!failed) return null
    const user = userRef.current
    setMessages((items) => items.map((item) => item.id === tempId ? { ...item, failed: false, pending: true, errorMessage: undefined } : item))
    try {
      const saved = await sendMessage({ workspaceId: workspaceRef.current, userId: user?.id, body: failed.body })
      setMessages((items) => items.filter((item) => item.id !== tempId).map((item) => item.id === saved.id ? { ...item, ...saved, name: user?.name } : item).concat(items.some((item) => item.id === saved.id) ? [] : [{ ...saved, name: user?.name }]).sort((a, b) => new Date(a.created_at) - new Date(b.created_at)))
      return saved
    } catch (cause) {
      setMessages((items) => items.map((item) => item.id === tempId ? { ...item, pending: false, failed: true, errorMessage: cause?.message || String(cause) } : item))
      setError(cause?.message || String(cause))
      return null
    }
  }, [])

  const edit = useCallback(async (id, body) => {
    try { const saved = await editMessage(id, body); merge([saved]); setError(null); return saved }
    catch (cause) { setError(cause?.message || String(cause)); return null }
  }, [merge])
  const remove = useCallback(async (id) => {
    try { await deleteMessage(id); setMessages((items) => items.filter((item) => item.id !== id)); setError(null); return true }
    catch (cause) { setError(cause?.message || String(cause)); return false }
  }, [])
  const loadEarlier = useCallback(async () => {
    const oldest = messagesRef.current[0]
    if (!workspaceRef.current || !oldest || loading) return
    setLoading(true)
    try {
      const result = await listMessages(workspaceRef.current, { before: oldest.created_at })
      merge(result)
      setHasMore(result.length === 50)
    } catch (cause) { setError(cause?.message || String(cause)) }
    finally { setLoading(false) }
  }, [loading, merge])
  const markRead = useCallback(() => setUnread(0), [])

  return { messages, loading, error, hasMore, unread, send, retry, edit, remove, loadEarlier, markRead }
}
